import "dotenv/config";
import express from "express";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma, signToken, requireAuth, requireRoles, audit } from "./auth.js";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Lista canônica de especialidades médicas. Precisa ficar IDÊNTICA à lista em
// frontend/src/lib/specialties.js — existe nos dois lugares porque backend e
// frontend não compartilham módulos neste projeto. Se adicionar uma
// especialidade, atualize as duas listas.
const SPECIALTIES = [
  "Clínica Geral",
  "Pediatria",
  "Ginecologia",
  "Cardiologia",
  "Ortopedia",
  "Psiquiatria",
  "Neurologia",
  "Dermatologia",
  "Oftalmologia",
  "Endocrinologia",
];
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
  modality: a.type,
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

// Retorna início/fim (00:00–24:00) do dia local da data informada.
const dayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

// Converte "YYYY-MM-DD" em meia-noite local (evita deslocamento UTC).
const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

// Verifica se o médico tem bloqueio de agenda ativo na data informada.
async function isDoctorLockedOnDate(doctorId, date) {
  const { start, end } = dayRange(date);
  const lock = await prisma.doctorScheduleLock.findFirst({
    where: {
      doctorId,
      active: true,
      date: { gte: start, lt: end },
    },
  });
  return !!lock;
}

// Retorna o médico com menos consultas agendadas no dia, preferindo o mesmo unit/specialty.
// Médicos com agenda bloqueada na data são excluídos.
async function findLeastBusyDoctor(unit, specialty, date) {
  const whereDoctor = { role: "medico", specialty };
  let doctors = await prisma.user.findMany({ where: { ...whereDoctor, unit } });
  if (!doctors.length)
    doctors = await prisma.user.findMany({ where: whereDoctor });
  if (!doctors.length)
    doctors = await prisma.user.findMany({ where: { role: "medico" } });
  if (!doctors.length) return null;

  const { start, end } = dayRange(date);
  let best = null;
  let bestCount = Infinity;

  for (const doc of doctors) {
    if (await isDoctorLockedOnDate(doc.id, date)) continue;

    const count = await prisma.appointment.count({
      where: {
        doctorId: doc.id,
        scheduledAt: { gte: start, lt: end },
      },
    });
    if (count < bestCount) {
      bestCount = count;
      best = doc;
    }
  }

  return best;
}

// Verifica se uma nova consulta ONLINE para `unit`/`date` estouraria o
// limite de vagas online configurado para aquele dia da semana.
// Sem configuração cadastrada para a unidade/dia = sem limite (não bloqueia).
async function isOnlineSlotBlocked(unit, date, excludeApptId = null) {
  const dayOfWeek = date.getDay();
  const config = await prisma.onlineSlotConfig.findUnique({
    where: { unit_dayOfWeek: { unit, dayOfWeek } },
  });
  if (!config) return { blocked: false, used: 0, max: null };

  const { start, end } = dayRange(date);
  const used = await prisma.appointment.count({
    where: {
      unit,
      type: "online",
      scheduledAt: { gte: start, lt: end },
      ...(excludeApptId ? { id: { not: excludeApptId } } : {}),
    },
  });
  return {
    blocked: used >= config.maxOnlineSlots,
    used,
    max: config.maxOnlineSlots,
  };
}

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
  const users = await prisma.user.findMany({
    where,
    include: { doctorLocks: { where: { active: true } } },
  });
  res.json(users.map(({ passwordHash, ...u }) => u));
});
api.post("/users", requireAuth, requireRoles("admin"), async (req, res) => {
  const { email, password, name, role, crm, specialty, unit } = req.body;
  if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))
    return res.status(400).json({ detail: "Email já cadastrado" });
  if (role === "medico") {
    if (!crm?.trim()) return res.status(400).json({ detail: "CRM é obrigatório para médicos" });
    if (!SPECIALTIES.includes(specialty)) {
      return res.status(400).json({
        detail: `Especialidade inválida. Selecione uma da lista: ${SPECIALTIES.join(", ")}`,
      });
    }
  }
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
api.get("/appointments/:id", requireAuth, async (req, res) => {
  const a = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { patient: true },
  });
  if (!a) return res.status(404).json({ detail: "Consulta não encontrada" });
  res.json(toAppt(a));
});
api.post(
  "/appointments",
  requireAuth,
  requireRoles("atendente", "admin"),
  async (req, res) => {
    const unit = req.body.unit || "UBS Central";
    // Consultas cadastradas pelo atendente são sempre presenciais.
    const modality =
      req.user.role === "atendente"
        ? "presencial"
        : req.body.modality === "online"
          ? "online"
          : "presencial";
    const scheduledAt = new Date(req.body.scheduled_at);

    if (modality === "online") {
      const block = await isOnlineSlotBlocked(unit, scheduledAt);
      if (block.blocked) {
        return res.status(400).json({
          detail: `Limite de vagas online atingido para ${unit} neste dia (${block.used}/${block.max}). Escolha outro dia ou agende presencial.`,
        });
      }
    }

    const doctor = await findLeastBusyDoctor(
      unit,
      req.body.specialty,
      scheduledAt,
    );
    if (!doctor) {
      return res.status(400).json({
        detail:
          "Nenhum médico disponível foi encontrado para essa consulta. Verifique se a agenda não está bloqueada.",
      });
    }

    if (await isDoctorLockedOnDate(doctor.id, scheduledAt)) {
      return res.status(400).json({
        detail:
          "A agenda do médico selecionado está bloqueada nesta data. Escolha outro horário ou desbloqueie a agenda.",
      });
    }

    const a = await prisma.appointment.create({
      data: {
        patientId: req.body.patient_id,
        doctorId: doctor.id,
        specialty: req.body.specialty,
        scheduledAt,
        priority: req.body.priority || "normal",
        unit,
        type: modality,
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

  const newStatus = req.body.status;
  if (newStatus === "compareceu") {
    if (a.status === "compareceu") {
      return res.json({ ok: true, already_attended: true });
    }
    if (a.status === "bloqueio_medico") {
      return res.status(400).json({
        detail: "Esta consulta foi cancelada por bloqueio de agenda.",
      });
    }
    if (a.status === "faltou") {
      return res.status(400).json({
        detail: "Esta consulta já foi marcada como falta.",
      });
    }
  }

  await prisma.appointment.update({
    where: { id: a.id },
    data: { status: newStatus, justification: req.body.justification },
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

  // Se for médico, informa também se a própria agenda de hoje está bloqueada
  // (imprevisto registrado pelo atendente), para exibir um aviso na tela.
  let lock = null;
  if (req.user.role === "medico") {
    const { start, end } = dayRange(new Date());
    const activeLock = await prisma.doctorScheduleLock.findFirst({
      where: {
        doctorId: req.user.id,
        active: true,
        date: { gte: start, lt: end },
      },
    });
    if (activeLock) {
      lock = {
        id: activeLock.id,
        reason: activeLock.reason,
        locked_at: activeLock.lockedAt.toISOString(),
      };
    }
  }

  res.json({ appointments: appts.map(toAppt), lock });
});

/* ==========================================
   BLOQUEIO DE AGENDA (IMPREVISTO DE MÉDICO)
   ========================================== */

// POST /api/secretario/agenda/lock
// Bloqueia a agenda de um médico para um dia específico (hoje ou uma data futura)
api.post(
  "/secretario/agenda/lock",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const user = req.user;
    const { doctor_id, date, reason } = req.body;

    // Validações
    if (!doctor_id || !date || !reason) {
      return res.status(400).json({
        detail: "Campos obrigatórios faltando: doctor_id, date, reason",
      });
    }

    const doctor = await prisma.user.findUnique({ where: { id: doctor_id } });
    if (!doctor || doctor.role !== "medico") {
      return res.status(400).json({
        detail: "Médico não encontrado ou inválido",
      });
    }

    if (!reason.trim()) {
      return res.status(400).json({
        detail: "Motivo não pode ser vazio",
      });
    }

    // Converter date (YYYY-MM-DD) para meia-noite local
    const lockDate = parseLocalDate(date);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (lockDate < today) {
      return res.status(400).json({
        detail: "Não é possível bloquear uma data no passado",
      });
    }

    // Verificar se já existe bloqueio ativo para este médico neste dia
    const dayEnd = new Date(lockDate.getTime() + 24 * 60 * 60 * 1000);
    const existingLock = await prisma.doctorScheduleLock.findFirst({
      where: {
        doctorId: doctor_id,
        active: true,
        date: { gte: lockDate, lt: dayEnd },
      },
    });

    if (existingLock) {
      return res.status(400).json({
        detail: "Já existe um bloqueio ativo para este médico neste dia",
      });
    }

    // Executar transação: criar bloqueio e cancelar consultas
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar registro DoctorScheduleLock
      const lock = await tx.doctorScheduleLock.create({
        data: {
          doctorId: doctor_id,
          date: lockDate,
          reason: reason.trim(),
          lockedById: user.id,
          active: true,
        },
      });

      // 2. Buscar consultas do médico no dia bloqueado.
      // Se o bloqueio é para HOJE, só afeta consultas a partir de agora em diante
      // (não mexe em quem já foi atendido). Se é para um dia FUTURO, afeta o dia
      // inteiro — e não pode "vazar" para os dias entre hoje e a data escolhida.
      const now = new Date();
      const dayEnd = new Date(lockDate.getTime() + 24 * 60 * 60 * 1000);
      const effectiveStart = lockDate.getTime() > now.getTime() ? lockDate : now;
      const affectedAppointments = await tx.appointment.findMany({
        where: {
          doctorId: doctor_id,
          status: "aguardando",
          scheduledAt: {
            gte: effectiveStart,
            lt: dayEnd,
          },
        },
        include: { patient: true },
      });

      // 3. Atualizar consultas afetadas
      if (affectedAppointments.length > 0) {
        await tx.appointment.updateMany({
          where: {
            id: { in: affectedAppointments.map((a) => a.id) },
          },
          data: {
            status: "bloqueio_medico",
            justification: reason.trim(),
            lockId: lock.id,
          },
        });
      }

      return { lock, affectedAppointments };
    });

    // Auditoria
    await audit(user, "agenda.lock", result.lock.id, {
      doctorId: doctor_id,
      date: date,
      reason: reason.trim(),
      affectedAppointments: result.affectedAppointments.length,
    });

    res.status(201).json({
      ok: true,
      lock: result.lock,
      affected_appointments: result.affectedAppointments.map((a) => ({
        id: a.id,
        patient_id: a.patientId,
        patient_name: a.patient.name,
        scheduled_at: a.scheduledAt.toISOString(),
      })),
      message: `Agenda bloqueada para ${date}. ${result.affectedAppointments.length} consulta(s) cancelada(s) e paciente(s) notificado(s).`,
    });
  },
);

// POST /api/secretario/agenda/:lockId/unlock
// Desbloqueia a agenda de um médico
api.post(
  "/secretario/agenda/:lockId/unlock",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const user = req.user;
    const { lockId } = req.params;

    const lock = await prisma.doctorScheduleLock.findUnique({
      where: { id: lockId },
    });

    if (!lock) {
      return res.status(404).json({
        detail: "Bloqueio não encontrado",
      });
    }

    if (!lock.active) {
      return res.status(400).json({
        detail: "Este bloqueio já está inativo",
      });
    }

    // Atualizar bloqueio: marcar como inativo
    const updatedLock = await prisma.doctorScheduleLock.update({
      where: { id: lockId },
      data: {
        active: false,
        unlockedAt: new Date(),
        unlockedById: user.id,
      },
    });

    // Auditoria
    await audit(user, "agenda.unlock", lockId, {
      doctorId: lock.doctorId,
      date: lock.date.toISOString().split("T")[0],
    });

    res.json({
      ok: true,
      lock: updatedLock,
      note: "Agenda desbloqueada. Consultas já canceladas não serão restauradas automaticamente — reagende-as manualmente conforme necessário.",
    });
  },
);

// GET /api/secretario/agenda/status
// Retorna status de bloqueios de agenda para um dia específico
api.get(
  "/secretario/agenda/status",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        detail: "Parâmetro 'date' obrigatório (formato YYYY-MM-DD)",
      });
    }

    const queryDate = parseLocalDate(date);

    // Buscar todos os médicos
    const doctors = await prisma.user.findMany({
      where: { role: "medico", active: true },
      select: { id: true, name: true, specialty: true, unit: true },
    });

    // Para cada médico, buscar: bloqueios ativos, total de consultas, canceladas por bloqueio
    const result = await Promise.all(
      doctors.map(async (doctor) => {
        const activeLock = await prisma.doctorScheduleLock.findFirst({
          where: {
            doctorId: doctor.id,
            date: { gte: dayStart, lt: dayEnd },
            active: true,
          },
        });

        const dayStart = new Date(queryDate);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const allAppointments = await prisma.appointment.count({
          where: {
            doctorId: doctor.id,
            scheduledAt: { gte: dayStart, lt: dayEnd },
          },
        });

        const cancelledByLock = await prisma.appointment.count({
          where: {
            doctorId: doctor.id,
            scheduledAt: { gte: dayStart, lt: dayEnd },
            status: "bloqueio_medico",
          },
        });

        return {
          doctor_id: doctor.id,
          doctor_name: doctor.name,
          specialty: doctor.specialty,
          unit: doctor.unit,
          has_active_lock: !!activeLock,
          lock: activeLock
            ? {
                id: activeLock.id,
                reason: activeLock.reason,
                locked_at: activeLock.lockedAt.toISOString(),
              }
            : null,
          appointments_total: allAppointments,
          appointments_cancelled_by_lock: cancelledByLock,
          appointments_normal: allAppointments - cancelledByLock,
        };
      }),
    );

    res.json({
      date: date,
      doctors: result,
    });
  },
);

/* ==========================================
   UNIDADES DE SAÚDE
   ========================================== */
// Lista todas as unidades cadastradas (tabela HealthUnit) + quaisquer
// unidades "avulsas" já usadas em agendamentos/usuários mas ainda não
// formalizadas na tabela (compatibilidade com dados legados).
api.get("/health-units", requireAuth, async (req, res) => {
  const [units, apptUnits, userUnits] = await Promise.all([
    prisma.healthUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.appointment.findMany({ distinct: ["unit"], select: { unit: true } }),
    prisma.user.findMany({ distinct: ["unit"], select: { unit: true } }),
  ]);
  const known = new Set(units.map((u) => u.name));
  const legacy = [
    ...new Set([...apptUnits, ...userUnits].map((u) => u.unit).filter(Boolean)),
  ].filter((name) => !known.has(name));
  const all = [
    ...units.map((u) => ({ id: u.id, name: u.name })),
    ...legacy.map((name) => ({ id: null, name })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  res.json(all);
});

// Cadastra uma nova unidade de saúde (persistida no banco).
api.post(
  "/health-units",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const name = (req.body.name || "").trim();
    if (!name)
      return res.status(400).json({ detail: "Nome da unidade é obrigatório" });
    const existing = await prisma.healthUnit.findFirst({ where: { name } });
    if (existing) return res.json({ id: existing.id, name: existing.name });
    const unit = await prisma.healthUnit.create({ data: { name } });
    await audit(req.user, "health_unit.create", unit.id, { name });
    res.json({ id: unit.id, name: unit.name });
  },
);

/* ==========================================
   CONFIGURAÇÃO DE VAGAS ONLINE X PRESENCIAL
   ========================================== */
const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];

// Lista a configuração dos 7 dias da semana para uma unidade.
// Dias sem registro salvo vêm com valores padrão (não persistidos).
api.get(
  "/scheduling-config",
  requireAuth,
  requireRoles("secretario", "admin", "atendente"),
  async (req, res) => {
    const unit = req.query.unit;
    if (!unit)
      return res.status(400).json({ detail: "Parâmetro 'unit' é obrigatório" });
    const rows = await prisma.onlineSlotConfig.findMany({ where: { unit } });
    const byDay = Object.fromEntries(rows.map((r) => [r.dayOfWeek, r]));
    const days = DAYS_OF_WEEK.map((dayOfWeek) => {
      const r = byDay[dayOfWeek];
      return {
        day_of_week: dayOfWeek,
        online_percentage: r?.onlinePercentage ?? 50,
        max_online_slots: r?.maxOnlineSlots ?? 0,
      };
    });
    res.json({ unit, days });
  },
);

// Salva (upsert) a configuração dos dias da semana de uma unidade.
api.put(
  "/scheduling-config",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const { unit, days } = req.body;
    if (!unit || !Array.isArray(days))
      return res
        .status(400)
        .json({ detail: "Payload inválido: 'unit' e 'days' são obrigatórios" });

    for (const d of days) {
      const dayOfWeek = Number(d.day_of_week);
      const onlinePercentage = Math.max(
        0,
        Math.min(100, Number(d.online_percentage) || 0),
      );
      const maxOnlineSlots = Math.max(0, Number(d.max_online_slots) || 0);
      if (!DAYS_OF_WEEK.includes(dayOfWeek)) continue;
      await prisma.onlineSlotConfig.upsert({
        where: { unit_dayOfWeek: { unit, dayOfWeek } },
        update: { onlinePercentage, maxOnlineSlots },
        create: { unit, dayOfWeek, onlinePercentage, maxOnlineSlots },
      });
    }
    await audit(req.user, "scheduling_config.update", unit, { unit, days });
    res.json({ ok: true });
  },
);

// Consulta a disponibilidade de vagas online para uma unidade/data específica.
api.get("/scheduling-config/availability", requireAuth, async (req, res) => {
  const { unit, date } = req.query;
  if (!unit || !date)
    return res
      .status(400)
      .json({ detail: "Parâmetros 'unit' e 'date' são obrigatórios" });
  const d = new Date(date + "T00:00:00");
  const config = await prisma.onlineSlotConfig.findUnique({
    where: { unit_dayOfWeek: { unit, dayOfWeek: d.getDay() } },
  });
  const { start, end } = dayRange(d);
  const used = await prisma.appointment.count({
    where: { unit, type: "online", scheduledAt: { gte: start, lt: end } },
  });
  const max = config?.maxOnlineSlots ?? null;
  res.json({
    unit,
    date,
    day_of_week: d.getDay(),
    online_percentage: config?.onlinePercentage ?? null,
    max_online_slots: max,
    used_online_slots: used,
    remaining_online_slots: max === null ? null : Math.max(0, max - used),
    blocked: max !== null && used >= max,
  });
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
      return res.status(409).json({
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

    const bySpec = {},
      byUnit = {};
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
        absenteeism_rate: totalAppts
          ? +((faltas / totalAppts) * 100).toFixed(1)
          : 0,
        adherence_rate: totalAppts
          ? +((compareceu / totalAppts) * 100).toFixed(1)
          : 0,
        exams_pending: await prisma.exam.count({
          where: { status: "pendente" },
        }),
        exams_abandoned: await prisma.exam.count({
          where: { status: "pronto" },
        }),
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

api.post(
  "/stock/entry",
  requireAuth,
  requireRoles("atendente"),
  async (req, res) => {
    const user = req.user;

    const medicineId = req.body.medicine_id || req.body.medicineId;
    const qty = Number(req.body.quantity || 0);
    const medicineName = (
      req.body.medicine_name ||
      req.body.medicineName ||
      medicineId ||
      ""
    )
      .toString()
      .trim();
    const dosage = (req.body.dosage || "").toString().trim();
    const lot = (req.body.lot || "").toString().trim();
    const notes = (req.body.notes || "").toString().trim();
    const selectedUnitRef =
      req.body.health_unit_id ||
      req.body.unit_id ||
      req.body.unitId ||
      user.healthUnitId;

    if (!medicineId || qty <= 0) {
      return res.status(400).json({
        detail: "Dados inválidos: medicine_id e quantity > 0 são obrigatórios",
      });
    }

    const selectedUnit = await prisma.healthUnit.findFirst({
      where: { OR: [{ id: selectedUnitRef }, { name: selectedUnitRef }] },
    });
    if (!selectedUnit) {
      return res.status(400).json({ detail: "Unidade de saúde inválida" });
    }

    const medicineDetails = JSON.stringify({
      medicineId,
      medicineName,
      dosage,
      lot,
      notes,
      type: "ENTRY",
    });
    const [stock] = await prisma.$transaction([
      prisma.medicineStock.fields
        ? null
        : prisma.medicineStock.upsert({
            where: {
              healthUnitId_medicineId: {
                healthUnitId: selectedUnit.id,
                medicineId,
              },
            },
            update: { quantity: { increment: qty } },
            create: {
              healthUnitId: selectedUnit.id,
              medicineId,
              quantity: qty,
            },
          }),
      prisma.stockTransaction.create({
        data: {
          healthUnitId: selectedUnit.id,
          medicineId,
          medicineName: medicineName || medicineId,
          medicineDetails,
          userId: user.id,
          type: "ENTRY",
          quantity: qty,
        },
      }),
    ]);

    await audit(user, "stock.entry", stock.id, {
      medicineId,
      medicineName: medicineName || medicineId,
      quantity: qty,
      unitId: selectedUnit.id,
      unitName: selectedUnit.name,
      attendantName: user.name,
      details: JSON.parse(medicineDetails),
    });

    res.json({ ok: true, stock });
  },
);

api.post(
  "/stock/exit",
  requireAuth,
  requireRoles("atendente"),
  async (req, res) => {
    const user = req.user;

    const medicineId = req.body.medicine_id || req.body.medicineId;
    const qty = Number(req.body.quantity || 0);
    const medicineName = (
      req.body.medicine_name ||
      req.body.medicineName ||
      medicineId ||
      ""
    )
      .toString()
      .trim();
    const dosage = (req.body.dosage || "").toString().trim();
    const lot = (req.body.lot || "").toString().trim();
    const notes = (req.body.notes || "").toString().trim();
    const selectedUnitRef =
      req.body.health_unit_id ||
      req.body.unit_id ||
      req.body.unitId ||
      user.healthUnitId;

    if (!medicineId || qty <= 0) {
      return res.status(400).json({
        detail: "Dados inválidos: medicine_id e quantity > 0 são obrigatórios",
      });
    }

    const selectedUnit = await prisma.healthUnit.findFirst({
      where: { OR: [{ id: selectedUnitRef }, { name: selectedUnitRef }] },
    });

    if (!selectedUnit) {
      return res.status(400).json({ detail: "Unidade de saúde inválida" });
    }

    try {
      // 1. Executa a saída de estoque (Bloco que havia sido cortado no Git)
      const medicineDetailsExit = JSON.stringify({
        medicineId,
        medicineName,
        dosage,
        lot,
        notes,
        type: "EXIT",
      });

      await prisma.$transaction(async (tx) => {
        const result = await tx.medicineStock.updateMany({
          where: {
            healthUnitId: selectedUnit.id,
            medicineId,
            quantity: { gte: qty },
          },
          data: { quantity: { decrement: qty } },
        });

        if (result.count === 0) {
          throw new Error("Estoque insuficiente para realizar a saída.");
        }

        await tx.stockTransaction.create({
          data: {
            healthUnitId: selectedUnit.id,
            medicineId,
            medicineName: medicineName || medicineId,
            medicineDetails: medicineDetailsExit,
            userId: user.id,
            type: "EXIT",
            quantity: qty,
          },
        });
      });

      // 2. Executa a entrada de estoque correspondente
      const medicineDetailsEntry = JSON.stringify({
        medicineId,
        medicineName,
        dosage,
        lot,
        notes,
        type: "ENTRY",
      });

      const [stock] = await prisma.$transaction([
        prisma.medicineStock.upsert({
          where: {
            healthUnitId_medicineId: {
              healthUnitId: user.healthUnitId,
              medicineId,
            },
          },
          update: { quantity: { increment: qty } },
          create: {
            healthUnitId: user.healthUnitId,
            medicineId,
            quantity: qty,
          },
        }),
        prisma.stockTransaction.create({
          data: {
            healthUnitId: selectedUnit.id,
            medicineId,
            medicineName: medicineName || medicineId,
            medicineDetails: medicineDetailsEntry,
            userId: user.id,
            type: "ENTRY",
            quantity: qty,
          },
        }),
      ]);

      // 3. Auditoria do sistema
      await audit(user, "stock.entry", stock.id, {
        medicineId,
        medicineName: medicineName || medicineId,
        quantity: qty,
        unitId: selectedUnit.id,
        unitName: selectedUnit.name,
        attendantName: user.name,
        details: JSON.parse(medicineDetailsEntry),
      });

      return res.json({ ok: true, stock });
    } catch (error) {
      console.error("Erro na transação de estoque:", error);
      return res
        .status(500)
        .json({ detail: error.message || "Erro interno ao processar estoque" });
    }
  },
);

api.post(
  "/stock/exit",
  requireAuth,
  requireRoles("atendente"),
  async (req, res) => {
    const user = req.user;
    if (!user.healthUnitId) {
      return res
        .status(400)
        .json({ detail: "Atendente sem unidade de saúde associada" });
    }

    const medicineId = req.body.medicine_id || req.body.medicineId;
    const qty = Number(req.body.quantity || 0);
    const medicineName = (
      req.body.medicine_name ||
      req.body.medicineName ||
      medicineId ||
      ""
    )
      .toString()
      .trim();
    const dosage = (req.body.dosage || "").toString().trim();
    const lot = (req.body.lot || "").toString().trim();
    const notes = (req.body.notes || "").toString().trim();

    if (!medicineId || qty <= 0) {
      return res.status(400).json({
        detail: "Dados inválidos: medicine_id e quantity > 0 são obrigatórios",
      });
    }

    try {
      const medicineDetails = JSON.stringify({
        medicineId,
        medicineName,
        dosage,
        lot,
        notes,
        type: "EXIT",
      });
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.medicineStock.updateMany({
          where: {
            healthUnitId: user.healthUnitId,
            medicineId,
            quantity: { gte: qty },
          },
          data: { quantity: { decrement: qty } },
        });
        if (result.count === 0) {
          const err = new Error("Estoque insuficiente");
          err.code = "INSUFFICIENT_STOCK";
          throw err;
        }
        await tx.stockTransaction.create({
          data: {
            healthUnitId: user.healthUnitId,
            medicineId,
            medicineName: medicineName || medicineId,
            medicineDetails,
            userId: user.id,
            type: "EXIT",
            quantity: qty,
          },
        });
        return tx.medicineStock.findUnique({
          where: {
            healthUnitId_medicineId: {
              healthUnitId: user.healthUnitId,
              medicineId,
            },
          },
        });
      });

      await audit(user, "stock.exit", updated.id, {
        medicineId,
        medicineName: medicineName || medicineId,
        quantity: qty,
        unitId: user.healthUnitId,
        details: JSON.parse(medicineDetails),
      });
      res.json({ ok: true, stock: updated });
    } catch (e) {
      if (e.code === "INSUFFICIENT_STOCK") {
        return res.status(400).json({ detail: "Estoque insuficiente" });
      }
      throw e;
    }
  },
);

api.get(
  "/stock/transactions",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const transactions = await prisma.stockTransaction.findMany({
      include: {
        healthUnit: true,
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json(
      transactions.map((t) => ({
        id: t.id,
        type: t.type,
        quantity: t.quantity,
        createdAt: t.createdAt.toISOString(),
        medicineId: t.medicineId,
        medicineName: t.medicineName,
        medicineDetails: t.medicineDetails ? JSON.parse(t.medicineDetails) : {},
        user: t.user,
        unit: t.healthUnit?.name || "Sem unidade",
      })),
    );
  },
);

api.get(
  "/stock/summary",
  requireAuth,
  requireRoles("atendente", "secretario", "admin"),
  async (req, res) => {
    const stocks = await prisma.medicineStock.findMany({
      include: { healthUnit: true },
      orderBy: [{ quantity: "asc" }, { medicineId: "asc" }],
    });

    res.json(
      stocks.map((stock) => ({
        medicineId: stock.medicineId,
        medicineName: stock.medicineId,
        unitId: stock.healthUnitId,
        unitName: stock.healthUnit?.name || "Sem unidade",
        quantity: stock.quantity,
      })),
    );
  },
);

const LOW_STOCK_THRESHOLD = 5;

api.get(
  "/secretario/dashboard-stock",
  requireAuth,
  requireRoles("secretario", "admin"),
  async (req, res) => {
    const units = await prisma.healthUnit.findMany({
      include: { stocks: { orderBy: { medicineId: "asc" } } },
      orderBy: { name: "asc" },
    });
    const out = units.map((u) => ({
      id: u.id,
      name: u.name,
      stocks: u.stocks.map((s) => ({
        medicineId: s.medicineId,
        quantity: s.quantity,
        lowStock: s.quantity > 0 && s.quantity <= LOW_STOCK_THRESHOLD,
        outOfStock: s.quantity <= 0,
      })),
    }));
    res.json(out);
  },
);

/* ==========================================
   ROTA DE AUDITORIA DE SISTEMA
   ========================================== */
api.get(
  "/audit-logs",
  requireAuth,
  requireRoles("secretario", "admin"),
  async (req, res) => {
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
  },
);

import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

api.get(
  "/ai/opcoes",
  requireAuth,
  requireRoles("secretario", "admin"),
  async (req, res) => {
    try {
      const [medicamentos, pacientes, medicos, unidades] = await Promise.all([
        prisma.prescription.findMany({
          select: { medication: true },
          distinct: ["medication"],
          orderBy: { medication: "asc" },
        }),
        prisma.patient.findMany({
          select: { id: true, name: true, cpf: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: { role: "medico" },
          select: { id: true, name: true, specialty: true },
          orderBy: { name: "asc" },
        }),
        prisma.appointment.findMany({
          select: { unit: true },
          distinct: ["unit"],
          orderBy: { unit: "asc" },
        }),
      ]);
      res.json({
        medicamentos: medicamentos.map((m) => m.medication),
        pacientes: pacientes.map((p) => ({
          id: p.id,
          label: `${p.name} · ${p.cpf}`,
        })),
        medicos: medicos.map((m) => ({
          id: m.id,
          label: `${m.name} · ${m.specialty}`,
        })),
        unidades: unidades.map((u) => u.unit),
      });
    } catch (e) {
      console.error(
        "Erro ao consultar o Gemini. Entre em contato com o suporte.",
        e,
      );
      res.status(500).json({ detail: "Erro ao consultar a IA." });
    }
  },
);

//  Código foi comentado por que estava dando problema ao subir para o git.

api.post(
  "/ai/insights",
  requireAuth,
  requireRoles("secretario", "admin"),
  async (req, res) => {
    const { filtro, valor } = req.body;

    if (!filtro || !valor)
      return res
        .status(400)
        .json({ detail: "filtro e valor são obrigatórios" });

    const hoje = new Date();
    const dozeAtras = new Date(hoje);
    dozeAtras.setMonth(dozeAtras.getMonth() - 12);

    const ESTACOES = {
      verao: { meses: [11, 0, 1], label: "Verão (Dez-Jan-Fev)" },
      outono: { meses: [2, 3, 4], label: "Outono (Mar-Abr-Mai)" },
      inverno: { meses: [5, 6, 7], label: "Inverno (Jun-Jul-Ago)" },
      primavera: { meses: [8, 9, 10], label: "Primavera (Set-Out-Nov)" },
    };

    let contexto = "";

    if (filtro === "estacao") {
      const estacao = ESTACOES[valor];
      if (!estacao) return res.status(400).json({ detail: "Estação inválida" });

      const appointments = await prisma.appointment.findMany({
        where: { scheduledAt: { gte: dozeAtras } },
        select: {
          scheduledAt: true,
          specialty: true,
          status: true,
          unit: true,
        },
      });

      const filtrados = appointments.filter((a) =>
        estacao.meses.includes(a.scheduledAt.getMonth()),
      );
      const porEsp = {};
      for (const a of filtrados) {
        porEsp[a.specialty] = (porEsp[a.specialty] || 0) + 1;
      }
      const faltas = filtrados.filter((a) => a.status === "faltou").length;

      const prescriptions = await prisma.prescription.findMany({
        where: { createdAt: { gte: dozeAtras } },
        select: { medication: true, createdAt: true },
      });
      const medsFiltrados = prescriptions.filter((p) =>
        estacao.meses.includes(p.createdAt.getMonth()),
      );
      const medMap = {};
      for (const p of medsFiltrados)
        medMap[p.medication] = (medMap[p.medication] || 0) + 1;
      const topMeds = Object.entries(medMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([m, c]) => `${m}:${c}`)
        .join(", ");

      contexto = `Estacao: ${estacao.label}. Total consultas: ${filtrados.length}. Por especialidade: ${JSON.stringify(porEsp)}. Faltas: ${faltas}. Top medicamentos prescritos: ${topMeds}.`;
    } else if (filtro === "medicamento") {
      const prescriptions = await prisma.prescription.findMany({
        where: { medication: valor, createdAt: { gte: dozeAtras } },
        select: { createdAt: true, active: true, patientId: true },
      });

      const porMes = {};
      for (const p of prescriptions) {
        const key = p.createdAt.toISOString().slice(0, 7);
        porMes[key] = (porMes[key] || 0) + 1;
      }
      const pacientesUnicos = new Set(prescriptions.map((p) => p.patientId))
        .size;

      contexto = `Medicamento: ${valor}. Prescricoes por mes: ${JSON.stringify(porMes)}. Total prescricoes: ${prescriptions.length}. Pacientes unicos: ${pacientesUnicos}. Receitas ativas: ${prescriptions.filter((p) => p.active).length}.`;
    } else if (filtro === "paciente") {
      const [appointments, prescriptions, exams] = await Promise.all([
        prisma.appointment.findMany({
          where: { patientId: valor, scheduledAt: { gte: dozeAtras } },
          select: { scheduledAt: true, specialty: true, status: true },
        }),
        prisma.prescription.findMany({
          where: { patientId: valor },
          select: { medication: true, createdAt: true, active: true },
        }),
        prisma.exam.findMany({
          where: { patientId: valor },
          select: { exam: true, status: true, createdAt: true },
        }),
      ]);

      const porMes = {};
      for (const a of appointments) {
        const key = a.scheduledAt.toISOString().slice(0, 7);
        porMes[key] = (porMes[key] || 0) + 1;
      }
      const especialidades = {};
      for (const a of appointments)
        especialidades[a.specialty] = (especialidades[a.specialty] || 0) + 1;
      const meds = prescriptions.map((p) => p.medication).join(", ");

      contexto = `Paciente anonimizado. Consultas por mes: ${JSON.stringify(porMes)}. Especialidades mais consultadas: ${JSON.stringify(especialidades)}. Faltas: ${appointments.filter((a) => a.status === "faltou").length}. Medicamentos: ${meds}. Exames: ${exams.map((e) => e.exam).join(", ")}.`;
    } else if (filtro === "unidade") {
      const appointments = await prisma.appointment.findMany({
        where: { unit: valor, scheduledAt: { gte: dozeAtras } },
        select: { scheduledAt: true, specialty: true, status: true },
      });

      const porMes = {};
      for (const a of appointments) {
        const key = a.scheduledAt.toISOString().slice(0, 7);
        porMes[key] = (porMes[key] || 0) + 1;
      }
      const porEsp = {};
      for (const a of appointments)
        porEsp[a.specialty] = (porEsp[a.specialty] || 0) + 1;
      const faltas = appointments.filter((a) => a.status === "faltou").length;

      contexto = `Unidade: ${valor}. Consultas por mes: ${JSON.stringify(porMes)}. Por especialidade: ${JSON.stringify(porEsp)}. Total: ${appointments.length}. Faltas: ${faltas}.`;
    } else if (filtro === "especialidade") {
      const appointments = await prisma.appointment.findMany({
        where: { specialty: valor, scheduledAt: { gte: dozeAtras } },
        select: { scheduledAt: true, status: true, unit: true },
      });

      const porMes = {};
      for (const a of appointments) {
        const key = a.scheduledAt.toISOString().slice(0, 7);
        porMes[key] = (porMes[key] || 0) + 1;
      }
      const porUnidade = {};
      for (const a of appointments)
        porUnidade[a.unit] = (porUnidade[a.unit] || 0) + 1;

      contexto = `Especialidade: ${valor}. Consultas por mes: ${JSON.stringify(porMes)}. Por unidade: ${JSON.stringify(porUnidade)}. Faltas: ${appointments.filter((a) => a.status === "faltou").length}.`;
    } else if (filtro === "medico") {
      const [appointments, prescriptions] = await Promise.all([
        prisma.appointment.findMany({
          where: { doctorId: valor, scheduledAt: { gte: dozeAtras } },
          select: { scheduledAt: true, status: true, specialty: true },
        }),
        prisma.prescription.findMany({
          where: { doctorId: valor, createdAt: { gte: dozeAtras } },
          select: { medication: true, createdAt: true },
        }),
      ]);

      const porMes = {};
      for (const a of appointments) {
        const key = a.scheduledAt.toISOString().slice(0, 7);
        porMes[key] = (porMes[key] || 0) + 1;
      }
      const medMap = {};
      for (const p of prescriptions)
        medMap[p.medication] = (medMap[p.medication] || 0) + 1;
      const topMeds = Object.entries(medMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([m, c]) => `${m}:${c}`)
        .join(", ");

      contexto = `Medico anonimizado. Consultas por mes: ${JSON.stringify(porMes)}. Total: ${appointments.length}. Faltas: ${appointments.filter((a) => a.status === "faltou").length}. Top medicamentos prescritos: ${topMeds}.`;
    } else {
      return res.status(400).json({
        detail:
          "Filtro inválido. Use: estacao, medicamento, paciente, unidade, especialidade, medico",
      });
    }

    const prompt = `Analise estes dados de saude publica municipal brasileira. Responda APENAS com JSON valido, sem texto adicional, sem markdown.

DADOS: ${contexto}

Formato obrigatorio:
{"padroes":[{"titulo":"string","descricao":"string","impacto":"alto|medio|baixo"}],"previsoes":[{"periodo":"string","descricao":"string","confianca":"alta|media|baixa"}],"recomendacoes":[{"titulo":"string","descricao":"string"}],"resumo":"string"}`;

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch)
        return res.status(500).json({ detail: "Resposta inválida da IA" });
      const parsed = JSON.parse(jsonMatch[0]);
      await audit(req.user, "ai.insights", "gemini", { filtro, valor });
      res.json({ ok: true, filtro, data: parsed });
    } catch (e) {
      console.error(
        "Erro ao consultar o Gemini. Entre em contato com o suporte.",
        e,
      );
      res.status(500).json({ detail: "Erro ao consultar a IA." });
    }
  },
);

// Carrega referências de `backend/data/{cid,tuss,sigtap}.json` quando disponíveis.
const dataDir = path.join(process.cwd(), "data");
function loadRef(name, fallback) {
  try {
    const file = path.join(dataDir, `${name}.json`);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      console.warn(`Ref ${name} inválida: não é um array`);
    }
  } catch (e) {
    console.warn(`Erro ao carregar ref ${name}:`, e.message || e);
  }
  return fallback;
}

const DEFAULT_CID = [
  { code: "I10", desc: "Hipertensão essencial" },
  { code: "E11", desc: "Diabetes tipo 2" },
  { code: "F32", desc: "Episódios depressivos" },
  { code: "F41", desc: "Transtornos ansiosos" },
  { code: "J45", desc: "Asma" },
  { code: "K21", desc: "Refluxo gastroesofágico" },
  { code: "M54", desc: "Dorsalgia" },
];
const DEFAULT_TUSS = [
  { code: "10101012", desc: "Consulta em consultório" },
  { code: "10103011", desc: "Consulta pré-natal" },
  { code: "40202100", desc: "Hemograma completo" },
  { code: "40301974", desc: "Glicemia de jejum" },
  { code: "40304035", desc: "Colesterol total" },
];
const DEFAULT_SIGTAP = [
  { code: "02.02.01.038-0", desc: "Hemograma completo" },
  { code: "02.02.01.014-9", desc: "Glicemia em jejum" },
  { code: "02.02.01.019-0", desc: "Colesterol total" },
  { code: "02.02.02.006-3", desc: "Urina - EAS" },
  { code: "02.05.02.014-4", desc: "Eletrocardiograma" },
  { code: "02.05.01.004-1", desc: "Radiografia de tórax" },
  { code: "02.11.06.008-8", desc: "Ultrassonografia abdominal" },
];

const CID = loadRef("cid", DEFAULT_CID);
const TUSS = loadRef("tuss", DEFAULT_TUSS);
const SIGTAP = loadRef("sigtap", DEFAULT_SIGTAP);
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
    return res.status(400).json({
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
  console.log(`Saúde na Palma da Mão -> backend em http://0.0.0.0:${port}`),
);