import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const hash = (pw) => bcrypt.hash(pw, 10);
const validationCode = () => `GOVBR-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

async function limparBanco() {
  console.log("LIMPANDO BANCO...");
  await prisma.appointment.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.stockTransaction.deleteMany();
  await prisma.medicineStock.deleteMany();
  await prisma.waitingList.deleteMany();
  await prisma.vacancy.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.doctorScheduleLock.deleteMany();
  await prisma.user.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.healthUnit.deleteMany();
  await prisma.appointmentConfig.deleteMany();
  await prisma.onlineSlotConfig.deleteMany();
  console.log("BANCO LIMPO OK");
}

async function criarUnidades() {
  console.log("CRIANDO UNIDADES...");
  const nomes = ["UBS Central", "UBS Zona Sul", "UBS Zona Norte"];
  const unidades = [];
  for (const name of nomes) {
    unidades.push(await prisma.healthUnit.create({ data: { name } }));
  }
  console.log("UNIDADES OK:", unidades.length);
  return unidades;
}

async function criarUsuarios(unidades) {
  console.log("CRIANDO USUARIOS...");
  const [central, zonaSul, zonaNorte] = unidades;

  const defs = [
    { email: "admin@saudeconecta.gov.br", name: "Administrador SUS", role: "admin", pw: "admin123" },
    { email: "secretario@saudeconecta.gov.br", name: "Carlos Mendes", role: "secretario", pw: "senha123" },
    { email: "atendente@saudeconecta.gov.br", name: "Marta Silva", role: "atendente", unit: "UBS Central", healthUnitId: central.id, pw: "senha123" },
    { email: "medico@saudeconecta.gov.br", name: "Dra. Ana Ribeiro", role: "medico", crm: "CRM-SP 12345", specialty: "Clínica Geral", unit: "UBS Central", healthUnitId: central.id, pw: "senha123" },
    { email: "atendente.sul@saudeconecta.gov.br", name: "Jussara Pinto", role: "atendente", unit: "UBS Zona Sul", healthUnitId: zonaSul.id, pw: "senha123" },
    { email: "atendente.norte@saudeconecta.gov.br", name: "Vanessa Rocha", role: "atendente", unit: "UBS Zona Norte", healthUnitId: zonaNorte.id, pw: "senha123" },
    { email: "cardio@saudeconecta.gov.br", name: "Dr. Bruno Alves", role: "medico", crm: "CRM-SP 22333", specialty: "Cardiologia", unit: "UBS Zona Sul", healthUnitId: zonaSul.id, pw: "senha123" },
    { email: "pediatra@saudeconecta.gov.br", name: "Dra. Camila Torres", role: "medico", crm: "CRM-SP 33221", specialty: "Pediatria", unit: "UBS Central", healthUnitId: central.id, pw: "senha123" },
    { email: "gineco@saudeconecta.gov.br", name: "Dra. Débora Nunes", role: "medico", crm: "CRM-SP 44556", specialty: "Ginecologia", unit: "UBS Zona Norte", healthUnitId: zonaNorte.id, pw: "senha123" },
    { email: "ortopedista@saudeconecta.gov.br", name: "Dr. Eduardo Farias", role: "medico", crm: "CRM-SP 55667", specialty: "Ortopedia", unit: "UBS Zona Sul", healthUnitId: zonaSul.id, pw: "senha123" },
    { email: "endocrino@saudeconecta.gov.br", name: "Dra. Fernanda Lopes", role: "medico", crm: "CRM-SP 66778", specialty: "Endocrinologia", unit: "UBS Central", healthUnitId: central.id, pw: "senha123" },
    { email: "psiquiatra@saudeconecta.gov.br", name: "Dr. Gabriel Souza", role: "medico", crm: "CRM-SP 77889", specialty: "Psiquiatria", unit: "UBS Zona Norte", healthUnitId: zonaNorte.id, pw: "senha123", active: false },
  ];

  const users = [];
  for (const d of defs) {
    const { pw, ...rest } = d;
    users.push(await prisma.user.create({ data: { ...rest, passwordHash: await hash(pw) } }));
  }
  console.log("USUARIOS OK:", users.length);
  return users;
}

async function criarPacientes() {
  console.log("CRIANDO PACIENTES...");
  const nomes = [
    "João Souza", "Maria Oliveira", "Pedro Santos", "Ana Costa", "Luiza Pereira",
    "Carlos Lima", "Beatriz Fernandes", "Rafael Almeida", "Sofia Rodrigues", "Miguel Barbosa",
    "Camila Nunes", "Lucas Martins", "Isabela Ramos", "Gustavo Duarte", "Helena Cardoso",
    "Tiago Ferreira", "Larissa Melo", "Diego Araújo", "Patrícia Rocha", "Fernando Castro",
    "Juliana Teixeira", "Rodrigo Batista", "Amanda Correia", "Bruno Guimarães", "Vanessa Moreira",
    "Felipe Cavalcanti", "Renata Xavier", "Thiago Monteiro", "Priscila Andrade", "Vinícius Pinto",
    "Aline Barros", "Leonardo Vieira", "Débora Campos", "Marcelo Dias", "Natália Freitas",
    "André Gonçalves", "Cristina Machado", "Rogério Tavares", "Elaine Ribeiro", "Sérgio Neves",
  ];

  const patients = [];
  for (let i = 0; i < nomes.length; i++) {
    patients.push(await prisma.patient.create({
      data: {
        name: nomes[i],
        cpf: `${String(100 + i).padStart(3, "0")}.${String(200 + i).padStart(3, "0")}.${String(300 + i).padStart(3, "0")}-${String(i).padStart(2, "0")}`,
        birthDate: `19${50 + (i % 45)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
        phone: `(11) 9${8000 + i}-${1000 + i}`,
        address: `Rua das Flores, ${100 + i * 3} - Bairro ${rand(["Centro", "Jardim América", "Vila Nova", "Cidade Alta"])}`,
        lgpdAccepted: i % 6 !== 0,
        missedCount: i % 8 === 0 ? randInt(2, 4) : i % 4 === 0 ? 1 : 0,
        blockedOnline: i % 8 === 0,
        active: i !== 39,
      }
    }));
  }
  console.log("PACIENTES OK:", patients.length);
  return patients;
}

async function criarAppointments(patients, medicos) {
  console.log("CRIANDO CONSULTAS...");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prioridades = ["normal", "normal", "normal", "preferencial", "urgente"];
  const unidadesNome = ["UBS Central", "UBS Zona Sul", "UBS Zona Norte"];
  let count = 0;

  for (let d = -90; d < 0; d++) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() + d);
    const qtdNoDia = randInt(2, 6);
    for (let i = 0; i < qtdNoDia; i++) {
      const medico = rand(medicos);
      const paciente = rand(patients);
      const dt = new Date(dia);
      dt.setHours(randInt(8, 17), rand([0, 30]), 0, 0);
      await prisma.appointment.create({
        data: {
          patientId: paciente.id, doctorId: medico.id, specialty: medico.specialty || "Clínica Geral",
          scheduledAt: dt, priority: rand(prioridades), unit: medico.unit || rand(unidadesNome),
          status: rand(["compareceu", "compareceu", "compareceu", "faltou", "cancelado"]),
          checkedIn: true, type: rand(["presencial", "presencial", "online"]),
          justification: Math.random() < 0.1 ? "Paciente remarcado por solicitação própria" : null,
          createdAt: new Date(dt.getTime() - 1000 * 60 * 60 * 24 * randInt(1, 10)),
        }
      });
      count++;
    }
  }

  for (let d = 0; d <= 14; d++) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() + d);
    const qtdNoDia = randInt(3, 8);
    for (let i = 0; i < qtdNoDia; i++) {
      const medico = rand(medicos);
      const paciente = rand(patients);
      const dt = new Date(dia);
      dt.setHours(randInt(8, 17), rand([0, 30]), 0, 0);
      await prisma.appointment.create({
        data: {
          patientId: paciente.id, doctorId: medico.id, specialty: medico.specialty || "Clínica Geral",
          scheduledAt: dt, priority: rand(prioridades), unit: medico.unit || rand(unidadesNome),
          status: "aguardando", checkedIn: false, type: rand(["presencial", "presencial", "online"]),
        }
      });
      count++;
    }
  }
  console.log("CONSULTAS OK:", count);
}

async function criarPrescricoes(patients, medicos) {
  console.log("CRIANDO PRESCRICOES...");
  const meds = [
    ["Losartana 50mg", "Losartana Potássica", "1 comprimido", "1x ao dia", ["08:00"]],
    ["Metformina 850mg", "Metformina", "1 comprimido", "2x ao dia", ["08:00", "20:00"]],
    ["Fluoxetina 20mg", "Fluoxetina", "1 cápsula", "1x ao dia", ["08:00"]],
    ["Omeprazol 20mg", "Omeprazol", "1 cápsula", "1x ao dia", ["07:00"]],
    ["Sinvastatina 20mg", "Sinvastatina", "1 comprimido", "1x ao dia", ["21:00"]],
    ["Amoxicilina 500mg", "Amoxicilina", "1 cápsula", "3x ao dia", ["08:00", "14:00", "20:00"]],
    ["Dipirona 500mg", "Dipirona Sódica", "1 comprimido", "se dor/febre", ["08:00"]],
    ["Loratadina 10mg", "Loratadina", "1 comprimido", "1x ao dia", ["09:00"]],
    ["Levotiroxina 50mcg", "Levotiroxina Sódica", "1 comprimido", "1x ao dia em jejum", ["06:30"]],
    ["Enalapril 10mg", "Maleato de Enalapril", "1 comprimido", "2x ao dia", ["08:00", "20:00"]],
  ];

  let count = 0;
  for (let i = 0; i < patients.length; i++) {
    const qtdPrescricoes = randInt(1, 3);
    for (let j = 0; j < qtdPrescricoes; j++) {
      const m = rand(meds);
      const doc = rand(medicos);
      const diasAtras = randInt(0, 180);
      const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * diasAtras);
      await prisma.prescription.create({
        data: {
          patientId: patients[i].id, doctorId: doc.id, doctorName: doc.name, doctorCrm: doc.crm,
          medication: m[0], activeSubstance: m[1], dosage: m[2], frequency: m[3],
          durationDays: rand([7, 14, 30, 60, 90]), route: "Oral", schedule: JSON.stringify(m[4]),
          validationCode: validationCode(), active: diasAtras < 30,
          adherenceLogs: JSON.stringify(
            Array.from({ length: randInt(0, 5) }, () => ({
              date: new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * randInt(0, 20)).toISOString(),
              taken: Math.random() > 0.2,
            }))
          ),
          createdAt,
        }
      });
      count++;
    }
  }
  console.log("PRESCRICOES OK:", count);
}

async function criarExames(patients, medicos) {
  console.log("CRIANDO EXAMES...");
  const exs = [
    "Hemograma completo", "Glicemia em jejum", "Colesterol total", "Eletrocardiograma",
    "Ultrassonografia abdominal", "Raio-X de tórax", "Exame de urina (EAS)", "TSH e T4 livre",
    "Papanicolau", "Mamografia",
  ];
  const laboratorios = [null, null, "Lab Central Diagnósticos", "Instituto de Radiologia SP"];
  let count = 0;

  for (let i = 0; i < 60; i++) {
    const status = rand(["pendente", "pendente", "pronto", "pronto", "retirado", "retirado", "retirado"]);
    const requestante = rand(medicos);
    const entregador = status === "retirado" ? rand(medicos) : null;
    const diasAtras = randInt(0, 120);
    await prisma.exam.create({
      data: {
        patientId: rand(patients).id, exam: rand(exs),
        preparationNotes: Math.random() < 0.3 ? "Jejum de 8 horas obrigatório" : null,
        urgent: Math.random() < 0.15, status, lab_externo: rand(laboratorios),
        requestedById: requestante.id, deliveredById: entregador?.id,
        deliveredAt: status === "retirado" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * randInt(0, diasAtras)) : null,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * diasAtras),
      }
    });
    count++;
  }
  console.log("EXAMES OK:", count);
}

async function criarEstoque(unidades, usuarios) {
  console.log("CRIANDO ESTOQUE...");
  const medicamentos = [
    { id: "med-losartana-50", name: "Losartana 50mg" },
    { id: "med-metformina-850", name: "Metformina 850mg" },
    { id: "med-amoxicilina-500", name: "Amoxicilina 500mg" },
    { id: "med-dipirona-500", name: "Dipirona 500mg" },
    { id: "med-omeprazol-20", name: "Omeprazol 20mg" },
    { id: "med-loratadina-10", name: "Loratadina 10mg" },
    { id: "med-soro-reidratacao", name: "Soro de Reidratação Oral" },
    { id: "med-ibuprofeno-600", name: "Ibuprofeno 600mg" },
  ];
  const atendentesEAdmins = usuarios.filter((u) => ["atendente", "admin", "secretario"].includes(u.role));

  for (const unidade of unidades) {
    for (const med of medicamentos) {
      await prisma.medicineStock.create({
        data: { healthUnitId: unidade.id, medicineId: med.id, quantity: randInt(0, 200) }
      });
      const qtdTransacoes = randInt(3, 8);
      for (let t = 0; t < qtdTransacoes; t++) {
        const tipo = rand(["entrada", "saida", "saida", "ajuste"]);
        const usuario = rand(atendentesEAdmins);
        await prisma.stockTransaction.create({
          data: {
            healthUnitId: unidade.id, medicineId: med.id, medicineName: med.name,
            medicineDetails: Math.random() < 0.3 ? "Lote fornecido pelo Ministério da Saúde" : null,
            userId: usuario.id, type: tipo, quantity: tipo === "saida" ? -randInt(1, 20) : randInt(5, 50),
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * randInt(0, 60)),
          }
        });
      }
    }
  }
  console.log("ESTOQUE OK");
}

async function criarFilaEVagas(patients) {
  console.log("CRIANDO FILA E VAGAS...");
  const specs = ["Cardiologia", "Endocrinologia", "Clínica Geral", "Ortopedia", "Ginecologia", "Pediatria"];

  for (let i = 0; i < 15; i++) {
    await prisma.waitingList.create({
      data: {
        patientId: rand(patients).id, specialty: rand(specs),
        status: rand(["waiting", "waiting", "waiting", "called", "cancelled"]),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * randInt(0, 45)),
      }
    });
  }

  for (let i = 0; i < 5; i++) {
    const paciente = rand(patients);
    const notifiedAt = new Date(Date.now() - 1000 * 60 * randInt(0, 120));
    const deadline = new Date(notifiedAt.getTime() + 1000 * 60 * 30);
    await prisma.vacancy.create({
      data: {
        patientId: paciente.id, patientName: paciente.name, specialty: rand(specs),
        unit: rand(["UBS Central", "UBS Zona Sul", "UBS Zona Norte"]),
        notifiedAt, deadline, status: rand(["waiting_response", "waiting_response", "accepted", "expired"]),
      }
    });
  }
  console.log("FILA E VAGAS OK");
}

async function criarAuditLogs(usuarios) {
  console.log("CRIANDO LOGS...");
  const acoes = [
    "login", "logout", "criou_consulta", "cancelou_consulta", "atualizou_estoque",
    "criou_prescricao", "liberou_exame", "bloqueou_agenda_medico", "desbloqueou_agenda_medico",
  ];

  for (let i = 0; i < 40; i++) {
    const usuario = rand(usuarios);
    await prisma.auditLog.create({
      data: {
        userId: usuario.id, userName: usuario.name, userRole: usuario.role,
        action: rand(acoes), target: Math.random() < 0.5 ? `appointment:${randomUUID()}` : `patient:${randomUUID()}`,
        details: JSON.stringify({ ip: `192.168.0.${randInt(1, 254)}`, origem: rand(["web", "mobile"]) }),
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * randInt(0, 24 * 60)),
      }
    });
  }
  console.log("LOGS OK");
}

async function criarConfigsAgenda(usuarios) {
  console.log("CRIANDO CONFIGS...");
  const admin = usuarios.find((u) => u.role === "admin");
  const specs = ["Clínica Geral", "Cardiologia", "Pediatria", "Ginecologia", "Ortopedia", "Endocrinologia"];

  for (const specialty of specs) {
    await prisma.appointmentConfig.create({
      data: {
        specialty, dayOfWeek: randInt(0, 6), maxOnlineSlots: randInt(5, 15),
        maxTotalSlots: randInt(15, 30), active: true, createdById: admin.id,
      }
    });
  }

  const unidadesNome = ["UBS Central", "UBS Zona Sul", "UBS Zona Norte"];
  for (const unit of unidadesNome) {
    for (let dow = 0; dow <= 6; dow++) {
      await prisma.onlineSlotConfig.create({
        data: { unit, dayOfWeek: dow, onlinePercentage: rand([30, 40, 50, 60]), maxOnlineSlots: randInt(5, 20) }
      });
    }
  }
  console.log("CONFIGS OK");
}

async function criarBloqueiosAgenda(medicos, usuarios) {
  console.log("CRIANDO BLOQUEIOS...");
  const admins = usuarios.filter((u) => ["admin", "secretario"].includes(u.role));
  const motivos = ["Férias", "Licença médica", "Congresso médico", "Atestado"];

  for (let i = 0; i < 4; i++) {
    const medico = rand(medicos);
    const lockedBy = rand(admins);
    const date = new Date(Date.now() + 1000 * 60 * 60 * 24 * randInt(-10, 20));
    const jaResolvido = i % 2 === 0;
    await prisma.doctorScheduleLock.create({
      data: {
        doctorId: medico.id, date, reason: rand(motivos), lockedById: lockedBy.id,
        active: !jaResolvido, unlockedAt: jaResolvido ? new Date() : null,
        unlockedById: jaResolvido ? rand(admins).id : null,
      }
    });
  }
  console.log("BLOQUEIOS OK");
}

async function main() {
  console.log("=== INICIO DO SEED ===");
  await limparBanco();
  const unidades = await criarUnidades();
  const usuarios = await criarUsuarios(unidades);
  const medicos = usuarios.filter((u) => u.role === "medico" && u.active);
  const patients = await criarPacientes();
  await criarAppointments(patients, medicos);
  await criarPrescricoes(patients, medicos);
  await criarExames(patients, medicos);
  await criarEstoque(unidades, usuarios);
  await criarFilaEVagas(patients);
  await criarAuditLogs(usuarios);
  await criarConfigsAgenda(usuarios);
  await criarBloqueiosAgenda(medicos, usuarios);

  const totalUsers = await prisma.user.count();
  console.log("=== SEED FINALIZADO. TOTAL DE USUARIOS:", totalUsers, "===");
}

main()
  .catch((e) => {
    console.error("=== DEU ERRO NO SEED ===", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());