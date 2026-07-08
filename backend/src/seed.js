import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
const prisma = new PrismaClient();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  if (await prisma.user.count() > 0) { console.log("Seed já feito."); return; }
  const hash = (p) => bcrypt.hash(p, 10);

  const defs = [
    { email: "admin@saudeconecta.gov.br", name: "Administrador SUS", role: "admin", pw: "admin123" },
    { email: "medico@saudeconecta.gov.br", name: "Dra. Ana Ribeiro", role: "medico", crm: "CRM-SP 12345", specialty: "Clínica Geral", unit: "UBS Central", pw: "senha123" },
    { email: "cardio@saudeconecta.gov.br", name: "Dr. Bruno Alves", role: "medico", crm: "CRM-SP 22333", specialty: "Cardiologia", unit: "UBS Zona Sul", pw: "senha123" },
    { email: "atendente@saudeconecta.gov.br", name: "Marta Silva", role: "atendente", unit: "UBS Central", pw: "senha123" },
    { email: "secretario@saudeconecta.gov.br", name: "Carlos Mendes", role: "secretario", pw: "senha123" },
  ];
  const users = [];
  for (const d of defs) { const { pw, ...r } = d; users.push(await prisma.user.create({ data: { ...r, passwordHash: await hash(pw) } })); }
  const medicos = users.filter(u => u.role === "medico");

  const nomes = ["João Souza","Maria Oliveira","Pedro Santos","Ana Costa","Luiza Pereira","Carlos Lima","Beatriz Fernandes","Rafael Almeida","Sofia Rodrigues","Miguel Barbosa","Camila Nunes","Lucas Martins","Isabela Ramos","Gustavo Duarte","Helena Cardoso","Tiago Ferreira","Larissa Melo","Diego Araújo","Patrícia Rocha","Fernando Castro"];
  const patients = [];
  for (let i = 0; i < nomes.length; i++) {
    patients.push(await prisma.patient.create({ data: {
      name: nomes[i], cpf: `${100+i}.${200+i}.${300+i}-${String(i).padStart(2,"0")}`,
      birthDate: `19${50+(i%40)}-${String((i%12)+1).padStart(2,"0")}-${String((i%27)+1).padStart(2,"0")}`,
      phone: `(11) 9${8000+i}-${1000+i}`, lgpdAccepted: i % 5 !== 0,
      missedCount: i % 7 === 0 ? 2 : 0, blockedOnline: i % 7 === 0,
    }}));
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const prios = ["normal","normal","normal","preferencial","urgente"];
  const statuses = ["compareceu","compareceu","compareceu","faltou","faltou"];
  for (let d = -6; d <= 2; d++) {
    const day = new Date(today); day.setDate(day.getDate() + d);
    for (let i = 0; i < 15; i++) {
      const m = medicos[i % medicos.length];
      const dt = new Date(day); dt.setHours(8 + (i % 8), 0, 0, 0);
      await prisma.appointment.create({ data: {
        patientId: patients[i].id, doctorId: m.id, specialty: m.specialty,
        scheduledAt: dt, priority: rand(prios), unit: m.unit,
        status: d >= 0 ? "aguardando" : rand(statuses),
      }});
    }
  }

  const meds = [
    ["Losartana 50mg","Losartana Potássica","1 comprimido","1x ao dia",["08:00"]],
    ["Metformina 850mg","Metformina","1 comprimido","2x ao dia",["08:00","20:00"]],
    ["Fluoxetina 20mg","Fluoxetina","1 cápsula","1x ao dia",["08:00"]],
    ["Omeprazol 20mg","Omeprazol","1 cápsula","1x ao dia",["07:00"]],
    ["Sinvastatina 20mg","Sinvastatina","1 comprimido","1x ao dia",["21:00"]],
  ];
  for (let i = 0; i < patients.length; i++) {
    const m = meds[i % meds.length]; const doc = medicos[i % medicos.length];
    await prisma.prescription.create({ data: {
      patientId: patients[i].id, doctorId: doc.id, doctorName: doc.name, doctorCrm: doc.crm,
      medication: m[0], activeSubstance: m[1], dosage: m[2], frequency: m[3],
      durationDays: 30, schedule: JSON.stringify(m[4]),
      validationCode: `GOVBR-${randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`,
    }});
  }

  const exs = ["Hemograma completo","Glicemia em jejum","Colesterol total","Eletrocardiograma"];
  const exSt = ["pendente","pronto","pronto","retirado"];
  for (let i = 0; i < 16; i++) {
    await prisma.exam.create({ data: { patientId: patients[i].id, exam: rand(exs), status: rand(exSt), requestedById: medicos[0].id }});
  }

  const specs = ["Cardiologia","Endocrinologia","Clínica Geral"];
  for (let i = 10; i < 18; i++)
    await prisma.waitingList.create({ data: { patientId: patients[i].id, specialty: rand(specs) }});

  for (let i = 0; i < 3; i++) {
    const dl = new Date(); dl.setMinutes(dl.getMinutes() + 10 + i * 5);
    await prisma.vacancy.create({ data: {
      patientId: patients[10+i].id, patientName: patients[10+i].name,
      specialty: rand(specs), unit: "UBS Central",
      notifiedAt: new Date(), deadline: dl,
    }});
  }

  console.log("Seed completo.");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
