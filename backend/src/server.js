import "dotenv/config";
import express from "express";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma, signToken, requireAuth, requireRoles, audit } from "./auth.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
const api = express.Router();

const toPatient = (p) => ({
  id: p.id,
  name: p.name,
  cpf: p.cpf,
  birth_date: p.birthDate,
  phone: p.phone,
  address: p.address,
  lgpd_accepted: p.lgpdAccepted,
  missed_count: p.missedCount,
  blocked_online: p.blockedOnline,
});
const toAppt = (a) => ({
  id: a.id,
  patient_id: a.patientId,
  doctor_id: a.doctorId,
  specialty: a.specialty,
  priority: a.priority,
  unit: a.unit,
  status: a.status,
  scheduled_at: a.scheduledAt.toISOString(),
  patient: a.patient
    ? {
        name: a.patient.name,
        cpf: a.patient.cpf,
        birth_date: a.patient.birthDate,
      }
    : {},
});
const parseJson = (value, fallback = []) => {
  if (!value) return fallback;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};
const toPrescription = (r) => ({
  id: r.id,
  patient_id: r.patientId,
  medication: r.medication,
  active_substance: r.activeSubstance,
  dosage: r.dosage,
  frequency: r.frequency,
  doctor_name: r.doctorName,
  validation_code: r.validationCode,
  active: r.active,
  schedule: parseJson(r.schedule, []),
  adherence_logs: parseJson(r.adherenceLogs, []),
  created_at: r.createdAt?.toISOString(),
});

api.post("/auth/login", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email?.toLowerCase() },
  });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash)))
    return res.status(401).json({ detail: "Credenciais inválidas" });
  const token = signToken(user);
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 86400_000,
  });
  const { passwordHash, ...safe } = user;
  res.json({ ...safe, token });
});
api.post("/auth/logout", (req, res) => {
  res.clearCookie("access_token");
  res.json({ ok: true });
});
api.get("/auth/me", requireAuth, (req, res) => {
  const { passwordHash, ...s } = req.user;
  res.json(s);
});

api.get("/users", requireAuth, async (req, res) => {
  const r = req.user.role;
  if (!["admin", "secretario", "atendente"].includes(r))
    return res.status(403).json({ detail: "Acesso negado" });
  const where = ["admin", "secretario"].includes(r) ? {} : { role: "medico" };
  const users = await prisma.user.findMany({ where });
  res.json(users.map(({ passwordHash, ...u }) => u));
});
api.post("/users", requireAuth, requireRoles("admin"), async (req, res) => {
  const { email, password, name, role, crm, specialty, unit } = req.body;
  if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))
    return res.status(400).json({ detail: "Email já cadastrado" });
  const u = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      name,
      role,
      crm,
      specialty,
      unit,
    },
  });
  await audit(req.user, "user.create", u.id, { role });
  const { passwordHash, ...safe } = u;
  res.json(safe);
});

api.get("/patients", requireAuth, async (req, res) => {
  const q = req.query.q;
  const where = q
    ? { OR: [{ name: { contains: q } }, { cpf: { contains: q } }] }
    : {};
  res.json((await prisma.patient.findMany({ where })).map(toPatient));
});
api.get("/patients/:id", requireAuth, async (req, res) => {
  const p = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ detail: "Paciente não encontrado" });
  const base = toPatient(p);
  if (!p.lgpdAccepted)
    return res.json({
      ...base,
      history_hidden: true,
      prescriptions_history: [],
      appointments_history: [],
    });
  const [prescs, appointments] = await Promise.all([
    prisma.prescription.findMany({
      where: { patientId: p.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { patientId: p.id },
      include: { doctor: true },
      orderBy: { scheduledAt: "desc" },
    }),
  ]);
  res.json({
    ...base,
    prescriptions_history: prescs.map(toPrescription),
    appointments_history: appointments.map((a) => ({
      id: a.id,
      specialty: a.specialty,
      priority: a.priority,
      status: a.status,
      scheduled_at: a.scheduledAt.toISOString(),
      unit: a.unit,
      doctor_name: a.doctor?.name || "—",
    })),
  });
});
api.post(
  "/patients",
  requireAuth,
  requireRoles("atendente", "admin", "medico"),
  async (req, res) => {
    try {
      const p = await prisma.patient.create({
        data: {
          name: req.body.name,
          cpf: req.body.cpf,
          birthDate: req.body.birth_date,
          phone: req.body.phone,
          address: req.body.address,
          lgpdAccepted: !!req.body.lgpd_accepted,
        },
      });
      res.json(toPatient(p));
    } catch {
      res.status(400).json({ detail: "CPF já cadastrado" });
    }
  },
);

api.get("/appointments", requireAuth, async (req, res) => {
  const where = {};
  if (req.query.date) {
    const d = new Date(req.query.date + "T00:00:00");
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    where.scheduledAt = { gte: d, lt: end };
  }
  if (req.query.doctor_id) where.doctorId = req.query.doctor_id;
  else if (req.user.role === "medico") where.doctorId = req.user.id;
  const appts = await prisma.appointment.findMany({
    where,
    include: { patient: true },
    orderBy: { scheduledAt: "asc" },
  });
  res.json(appts.map(toAppt));
});
api.post(
  "/appointments",
  requireAuth,
  requireRoles("atendente", "admin"),
  async (req, res) => {
    const a = await prisma.appointment.create({
      data: {
        patientId: req.body.patient_id,
        doctorId: req.body.doctor_id,
        specialty: req.body.specialty,
        scheduledAt: new Date(req.body.scheduled_at),
        priority: req.body.priority || "normal",
        unit: req.body.unit || "UBS Central",
      },
    });
    res.json(toAppt(a));
  },
);
api.patch("/appointments/:id", requireAuth, async (req, res) => {
  const a = await prisma.appointment.findUnique({
    where: { id: req.params.id },
  });
  if (!a) return res.status(404).json({ detail: "Consulta não encontrada" });
  await prisma.appointment.update({
    where: { id: a.id },
    data: { status: req.body.status, justification: req.body.justification },
  });
  if (req.body.status === "faltou" && !req.body.justification) {
    const p = await prisma.patient.update({
      where: { id: a.patientId },
      data: { missedCount: { increment: 1 } },
    });
    if (p.missedCount >= 2)
      await prisma.patient.update({
        where: { id: p.id },
        data: { blockedOnline: true },
      });
  }
  await audit(req.user, "appointment.update", a.id, {
    status: req.body.status,
  });
  res.json({ ok: true });
});
api.get("/queue/today", requireAuth, async (req, res) => {
  if (!["medico", "atendente", "admin"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Acesso negado" });
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const where = { scheduledAt: { gte: start, lt: end } };
  if (req.user.role === "medico") where.doctorId = req.user.id;
  const appts = await prisma.appointment.findMany({
    where,
    include: { patient: true },
  });
  const order = { urgente: 0, preferencial: 1, normal: 2 };
  appts.sort(
    (a, b) =>
      order[a.priority] - order[b.priority] || a.scheduledAt - b.scheduledAt,
  );
  res.json(appts.map(toAppt));
});

api.get("/prescriptions", requireAuth, async (req, res) => {
  const where = {};
  if (req.query.patient_id) where.patientId = req.query.patient_id;
  else if (req.user.role === "medico") where.doctorId = req.user.id;
  const ps = await prisma.prescription.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(ps.map(toPrescription));
});
api.post("/prescriptions/:id/adherence", requireAuth, async (req, res) => {
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params.id },
  });
  if (!prescription)
    return res.status(404).json({ detail: "Receita não encontrada" });
  const current = parseJson(prescription.adherenceLogs, []);
  current.push({
    timestamp: new Date().toISOString(),
    status: req.body.status || "taken",
    note: req.body.note || "Confirmado pelo profissional",
  });
  const updated = await prisma.prescription.update({
    where: { id: prescription.id },
    data: { adherenceLogs: JSON.stringify(current) },
  });
  await audit(req.user, "prescription.adherence", updated.id, {
    status: req.body.status || "taken",
  });
  res.json({ ok: true, adherence_logs: parseJson(updated.adherenceLogs, []) });
});
api.post(
  "/prescriptions",
  requireAuth,
  requireRoles("medico"),
  async (req, res) => {
    const { patient_id, active_substance, justification } = req.body;
    const existing = await prisma.prescription.findFirst({
      where: {
        patientId: patient_id,
        activeSubstance: active_substance,
        active: true,
      },
    });
    if (existing && !justification)
      return res
        .status(409)
        .json({
          detail: {
            error: "conflict",
            message: `Paciente já possui receita ativa para ${active_substance}. Selecione uma justificativa.`,
          },
        });
    if (existing && justification)
      await prisma.prescription.update({
        where: { id: existing.id },
        data: { active: false },
      });
    const p = await prisma.prescription.create({
      data: {
        patientId: patient_id,
        doctorId: req.user.id,
        doctorName: req.user.name,
        doctorCrm: req.user.crm,
        medication: req.body.medication,
        activeSubstance: active_substance,
        dosage: req.body.dosage,
        frequency: req.body.frequency,
        durationDays: req.body.duration_days,
        route: req.body.route || "Oral",
        schedule: JSON.stringify(req.body.schedule || []),
        validationCode: `GOVBR-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      },
    });
    await audit(req.user, "prescription.create", p.id, {
      medication: p.medication,
      override: !!justification,
    });
    res.json({
      ...p,
      validation_code: p.validationCode,
      active_substance: p.activeSubstance,
    });
  },
);

api.get("/exams", requireAuth, async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.patient_id) where.patientId = req.query.patient_id;
  if (req.query.q) {
    const q = req.query.q.trim();
    where.OR = [
      { lab_externo: { contains: q } },
      { patient: { name: { contains: q } } },
    ];
  }
  const exams = await prisma.exam.findMany({
    where,
    include: { patient: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    exams.map((e) => ({
      id: e.id,
      exam: e.exam,
      status: e.status,
      urgent: e.urgent,
      preparation_notes: e.preparationNotes,
      patient_id: e.patientId,
      lab_externo: e.lab_externo,
      created_at: e.createdAt.toISOString(),
      delivered_at: e.deliveredAt?.toISOString(),
      patient: { name: e.patient.name, cpf: e.patient.cpf },
    })),
  );
});
api.post("/exams", requireAuth, requireRoles("medico"), async (req, res) => {
  const isExternal = !!req.body.external;
  if (isExternal && !String(req.body.lab_externo || "").trim())
    return res
      .status(400)
      .json({ detail: "Informe o nome do laboratório externo" });
  const created = [];
  for (const ex of req.body.exams) {
    const labValue = isExternal ? req.body.lab_externo || null : null;
    created.push(
      await prisma.exam.create({
        data: {
          patientId: req.body.patient_id,
          exam: ex,
          preparationNotes: req.body.preparation_notes,
          urgent: !!req.body.urgent,
          lab_externo: labValue,
          requestedById: req.user.id,
        },
      }),
    );
  }
  await audit(req.user, "exam.request", req.body.patient_id, {
    count: created.length,
    external: isExternal,
  });
  res.json(created);
});
api.patch(
  "/exams/:id/status",
  requireAuth,
  requireRoles("atendente", "admin"),
  async (req, res) => {
    const status = req.query.status;
    if (!["pendente", "pronto", "retirado"].includes(status))
      return res.status(400).json({ detail: "Status inválido" });
    const data = { status };
    if (status === "retirado") {
      data.deliveredAt = new Date();
      data.deliveredById = req.user.id;
    }
    await prisma.exam.update({ where: { id: req.params.id }, data });
    await audit(req.user, "exam.status", req.params.id, { status });
    res.json({ ok: true });
  },
);

api.get("/waiting-list", requireAuth, async (req, res) => {
  const where = { status: "waiting" };
  if (req.query.specialty) where.specialty = req.query.specialty;
  const wl = await prisma.waitingList.findMany({
    where,
    include: { patient: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    wl.map((w) => ({
      id: w.id,
      patient_id: w.patientId,
      specialty: w.specialty,
      patient: { name: w.patient.name },
    })),
  );
});
api.get("/vacancies/active", requireAuth, async (req, res) => {
  const now = new Date();
  const vacs = await prisma.vacancy.findMany({
    where: { status: { in: ["notified", "waiting_response"] } },
  });
  const out = [];
  for (const v of vacs) {
    const remaining = Math.max(0, Math.floor((v.deadline - now) / 1000));
    if (remaining <= 0 && v.status === "waiting_response") {
      await prisma.vacancy.update({
        where: { id: v.id },
        data: { status: "expired" },
      });
    } else
      out.push({
        id: v.id,
        patient_id: v.patientId,
        patient_name: v.patientName,
        specialty: v.specialty,
        unit: v.unit,
        deadline: v.deadline.toISOString(),
        remaining_seconds: remaining,
        status: v.status,
      });
  }
  res.json(out);
});

api.get(
  "/dashboard/secretario",
  requireAuth,
  requireRoles("secretario", "admin"),
  async (req, res) => {
    const all = await prisma.appointment.findMany();
    const recentActivity = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 8,
    });
    
    const totalAppts = all.length;
    const faltas = all.filter((a) => a.status === "faltou").length;
    const compareceu = all.filter((a) => a.status === "compareceu").length;
    
    const bySpec = {}, byUnit = {};
    for (const a of all) {
      bySpec[a.specialty] ??= { total: 0, faltas: 0 };
      bySpec[a.specialty].total++;
      if (a.status === "faltou") bySpec[a.specialty].faltas++;
      
      byUnit[a.unit] ??= { total: 0, faltas: 0 };
      byUnit[a.unit].total++;
      if (a.status === "faltou") byUnit[a.unit].faltas++;
    }
    
    const prescs = await prisma.prescription.findMany({
      where: { active: true },
    });
    
    const medMap = {};
    for (const p of prescs) {
      medMap[p.medication] = (medMap[p.medication] || 0) + 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekly = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 1);
      const dayAppts = all.filter(
        (a) => a.scheduledAt >= d && a.scheduledAt < nd,
      );
      const f = dayAppts.filter((a) => a.status === "faltou").length;
      weekly.push({
        date: d.toISOString().slice(0, 10),
        total: dayAppts.length,
        faltas: f,
        compareceu: dayAppts.length - f,
      });
    }

    const scores = Array.from(
      { length: 50 },
      () => 6 + Math.floor(Math.random() * 5),
    );
    const nps = Math.round(
      ((scores.filter((s) => s >= 9).length -
        scores.filter((s) => s <= 6).length) /
        scores.length) *
        100,
    );

    res.json({
      kpis: {
        total_patients: await prisma.patient.count(),
        total_appointments: totalAppts,
        absenteeism_rate: totalAppts ? +((faltas / totalAppts) * 100).toFixed(1) : 0,
        adherence_rate: totalAppts ? +((compareceu / totalAppts) * 100).toFixed(1) : 0,
        exams_pending: await prisma.exam.count({ where: { status: "pendente" } }),
        exams_abandoned: await prisma.exam.count({ where: { status: "pronto" } }),
        total_prescriptions: await prisma.prescription.count(),
        nps,
      },
      by_specialty: Object.entries(bySpec).map(([s, v]) => ({
        specialty: s,
        total: v.total,
        faltas: v.faltas,
        absenteeism: v.total ? +((v.faltas / v.total) * 100).toFixed(1) : 0,
      })),
      med_demand: Object.entries(medMap)
        .map(([m, c]) => ({ medication: m, patients: c }))
        .sort((a, b) => b.patients - a.patients)
        .slice(0, 8),
      unit_ranking: Object.entries(byUnit)
        .map(([u, v]) => ({
          unit: u,
          total: v.total,
          absenteeism: v.total ? +((v.faltas / v.total) * 100).toFixed(1) : 0,
        }))
        .sort((a, b) => a.absenteeism - b.absenteeism),
      weekly_trend: weekly,
      recent_activity: recentActivity.map((item) => ({
        id: item.id,
        action: item.action,
        target: item.target,
        user_name: item.userName,
        timestamp: item.timestamp.toISOString(),
      })),
    });
  },
);

/* ==========================================
   MÓDULO DE CONTROLE DE ESTOQUE (MEDICAMENTOS)
   ========================================== */

api.post("/stock/entry", requireAuth, requireRoles("atendente"), async (req, res) => {
  const user = req.user;
  if (!user.healthUnitId) {
    return res.status(400).json({ detail: "Atendente sem unidade de saúde associada" });
  }

  const medicineId = req.body.medicine_id;
  const qty = Number(req.body.quantity || 0);

  if (!medicineId || qty <= 0) {
    return res.status(400).json({ detail: "Dados inválidos: medicine_id e quantity > 0 são obrigatórios" });
  }

  let stock = await prisma.medicineStock.findFirst({
    where: { healthUnitId: user.healthUnitId, medicineId }
  });

  if (stock) {
    stock = await prisma.medicineStock.update({
      where: { id: stock.id },
      data: { quantity: { increment: qty } }
    });
  } else {
    stock = await prisma.medicineStock.create({
      data: { healthUnitId: user.healthUnitId, medicineId, quantity: qty }
    });
  }

  await prisma.stockTransaction.create({
    data: { healthUnitId: user.healthUnitId, medicineId, userId: user.id, type: "ENTRY", quantity: qty }
  });

  res.json({ ok: true, stock });
});

api.post("/stock/exit", requireAuth, requireRoles("atendente"), async (req, res) => {
  const user = req.user;
  if (!user.healthUnitId) {
    return res.status(400).json({ detail: "Atendente sem unidade de saúde associada" });
  }

  const medicineId = req.body.medicine_id;
  const qty = Number(req.body.quantity || 0);

  if (!medicineId || qty <= 0) {
    return res.status(400).json({ detail: "Dados inválidos: medicine_id e quantity > 0 são obrigatórios" });
  }

  const stock = await prisma.medicineStock.findFirst({
    where: { healthUnitId: user.healthUnitId, medicineId }
  });

  if (!stock || stock.quantity < qty) {
    return res.status(400).json({ detail: "Estoque insuficiente" });
  }

  const updated = await prisma.medicineStock.update({
    where: { id: stock.id },
    data: { quantity: { decrement: qty } }
  });

  await prisma.stockTransaction.create({
    data: { healthUnitId: user.healthUnitId, medicineId, userId: user.id, type: "EXIT", quantity: qty }
  });

  res.json({ ok: true, stock: updated });
});

api.get("/secretario/dashboard-stock", requireAuth, requireRoles("secretario", "admin"), async (req, res) => {
  const units = await prisma.healthUnit.findMany({ include: { stocks: true } });
  const out = units.map(u => ({
    id: u.id,
    name: u.name,
    stocks: u.stocks.map(s => ({ medicineId: s.medicineId, quantity: s.quantity }))
  }));
  res.json(out);
});

/* ==========================================
   ROTA DE AUDITORIA DE SISTEMA
   ========================================== */
api.get("/audit-logs", requireAuth, requireRoles("secretario", "admin"), async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  res.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      target: l.target,
      user_name: l.userName,
      user_role: l.userRole,
      timestamp: l.timestamp.toISOString(),
      details: l.details ? JSON.parse(l.details) : {},
    })),
  );
});

const CID = [
  { code: "I10", desc: "Hipertensão essencial" },
  { code: "E11", desc: "Diabetes tipo 2" },
  { code: "F32", desc: "Episódios depressivos" },
  { code: "F41", desc: "Transtornos ansiosos" },
  { code: "J45", desc: "Asma" },
  { code: "K21", desc: "Refluxo gastroesofágico" },
  { code: "M54", desc: "Dorsalgia" },
];
const TUSS = [
  { code: "10101012", desc: "Consulta em consultório" },
  { code: "10103011", desc: "Consulta pré-natal" },
  { code: "40202100", desc: "Hemograma completo" },
  { code: "40301974", desc: "Glicemia de jejum" },
  { code: "40304035", desc: "Colesterol total" },
];
const SIGTAP = [
  { code: "02.02.01.038-0", desc: "Hemograma completo" },
  { code: "02.02.01.014-9", desc: "Glicemia em jejum" },
  { code: "02.02.01.019-0", desc: "Colesterol total" },
  { code: "02.02.02.006-3", desc: "Urina - EAS" },
  { code: "02.05.02.014-4", desc: "Eletrocardiograma" },
  { code: "02.05.01.004-1", desc: "Radiografia de tórax" },
  { code: "02.11.06.008-8", desc: "Ultrassonografia abdominal" },
];
const search = (arr, q) =>
  !q
    ? arr
    : arr.filter(
        (c) =>
          c.code.toLowerCase().includes(q.toLowerCase()) ||
          c.desc.toLowerCase().includes(q.toLowerCase()),
      );
api.get("/refs/cid", (req, res) => res.json(search(CID, req.query.q)));
api.get("/refs/tuss", (req, res) => res.json(search(TUSS, req.query.q)));
api.get("/refs/sigtap", (req, res) => res.json(search(SIGTAP, req.query.q)));

app.use("/api", api);

// Global error handler — impede crash em payloads inválidos e retorna 400/422
app.use((err, req, res, next) => {
  console.error("API error:", err?.name, err?.message);
  const name = err?.name || "";
  if (
    name.includes("PrismaClientValidation") ||
    name.includes("PrismaClientKnownRequest")
  )
    return res
      .status(400)
      .json({
        detail: err.message?.split("\n").pop()?.trim() || "Dados inválidos",
      });
  res.status(500).json({ detail: err?.message || "Erro interno" });
});

process.on("unhandledRejection", (r) =>
  console.error("unhandledRejection:", r),
);
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

const port = process.env.PORT || 8001;
app.listen(port, "0.0.0.0", () =>
  console.log(`SaúdeConecta backend em http://0.0.0.0:${port}`),
);
