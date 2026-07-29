import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import process from 'node:process'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Limpeza
  await prisma.auditLog.deleteMany()
  await prisma.vacancy.deleteMany()
  await prisma.waitingList.deleteMany()
  await prisma.stockTransaction.deleteMany()
  await prisma.medicineStock.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.prescription.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.onlineSlotConfig.deleteMany()
  await prisma.appointmentConfig.deleteMany()
  await prisma.doctorScheduleLock.deleteMany()
  await prisma.patient.deleteMany()
  await prisma.user.deleteMany()
  await prisma.healthUnit.deleteMany()

  const senhaPadrao = await bcrypt.hash('senha123', 10)
  const senhaAdmin = await bcrypt.hash('admin123', 10)

  // Unidade
  const spm = await prisma.healthUnit.create({
    data: {
      name: 'spm Centro'
    }
  })

  const secretario = await prisma.user.create({
    data: {
      email: 'secretario@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Ana Souza',
      role: 'secretario',
      unit: 'spm Centro',
      healthUnitId: spm.id
    }
  })

  const medico1 = await prisma.user.create({
    data: {
      email: 'medico@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Dr. Carlos Mendes',
      role: 'medico',
      crm: 'CRM-PR 12345',
      specialty: 'Clínica Geral',
      unit: 'spm Centro',
      healthUnitId: spm.id
    }
  })

  const medico2 = await prisma.user.create({
    data: {
      email: 'medico2@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Dra. Juliana Rocha',
      role: 'medico',
      crm: 'CRM-PR 67890',
      specialty: 'Pediatria',
      unit: 'spm Centro',
      healthUnitId: spm.id
    }
  })

  const atendente = await prisma.user.create({
    data: {
      email: 'atendente@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Marcos Lima',
      role: 'atendente',
      unit: 'spm Centro',
      healthUnitId: spm.id
    }
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@spm.gov.br',
      passwordHash: senhaAdmin,
      name: 'Admin Sistema',
      role: 'admin',
      unit: 'spm Centro',
      healthUnitId: spm.id
    }
  })

  // Pacientes
  const pacientes = await Promise.all([
    prisma.patient.create({
      data: {
        name: 'João da Silva',
        cpf: '11111111111',
        birthDate: '1985-03-12',
        phone: '(46) 99999-1111',
        address: 'Rua das Flores, 120',
        lgpdAccepted: true
      }
    }),
    prisma.patient.create({
      data: {
        name: 'Maria Oliveira',
        cpf: '22222222222',
        birthDate: '1992-07-20',
        phone: '(46) 99999-2222',
        address: 'Av. Brasil, 450',
        lgpdAccepted: true
      }
    }),
    prisma.patient.create({
      data: {
        name: 'Pedro Santos',
        cpf: '33333333333',
        birthDate: '1978-11-02',
        phone: '(46) 99999-3333',
        address: 'Rua Paraná, 88',
        lgpdAccepted: true
      }
    }),
    prisma.patient.create({
      data: {
        name: 'Luciana Ferreira',
        cpf: '44444444444',
        birthDate: '2001-01-15',
        phone: '(46) 99999-4444',
        address: 'Rua das Araucárias, 15',
        lgpdAccepted: true
      }
    }),
    prisma.patient.create({
      data: {
        name: 'Gabriel Costa',
        cpf: '55555555555',
        birthDate: '2015-09-08',
        phone: '(46) 99999-5555',
        address: 'Rua XV de Novembro, 300',
        lgpdAccepted: true
      }
    })
  ])

  // Consultas
  await prisma.appointment.createMany({
    data: [
      {
        patientId: pacientes[0].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-10T08:00:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[1].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-10T09:00:00'),
        status: 'aguardando'
      },
      {
        patientId: pacientes[2].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-10T10:00:00'),
        status: 'em_atendimento'
      },
      {
        patientId: pacientes[3].id,
        doctorId: medico2.id,
        specialty: 'Pediatria',
        scheduledAt: new Date('2026-08-11T13:30:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[4].id,
        doctorId: medico2.id,
        specialty: 'Pediatria',
        scheduledAt: new Date('2026-08-11T14:00:00'),
        status: 'aguardando'
      }
    ]
  })

  // Receitas
  await prisma.prescription.createMany({
    data: [
      {
        patientId: pacientes[0].id,
        doctorId: medico1.id,
        doctorName: medico1.name,
        doctorCrm: medico1.crm,
        medication: 'Losartana 50mg',
        activeSubstance: 'Losartana Potássica',
        dosage: '50mg',
        frequency: '1x ao dia',
        durationDays: 30,
        schedule: '08:00',
        validationCode: 'RX-2026-0001'
      },
      {
        patientId: pacientes[1].id,
        doctorId: medico1.id,
        doctorName: medico1.name,
        doctorCrm: medico1.crm,
        medication: 'Metformina 850mg',
        activeSubstance: 'Metformina',
        dosage: '850mg',
        frequency: '2x ao dia',
        durationDays: 60,
        schedule: '08:00 e 20:00',
        validationCode: 'RX-2026-0002'
      }
    ]
  })

  // Exames
  await prisma.exam.createMany({
    data: [
      {
        patientId: pacientes[0].id,
        exam: 'Hemograma Completo',
        urgent: false,
        status: 'agendado',
        requestedById: medico1.id
      },
      {
        patientId: pacientes[1].id,
        exam: 'Glicemia em Jejum',
        urgent: false,
        status: 'coletado',
        requestedById: medico1.id
      },
      {
        patientId: pacientes[2].id,
        exam: 'Raio-X de Tórax',
        urgent: true,
        status: 'laudo_pronto',
        requestedById: medico1.id
      },
      {
        patientId: pacientes[4].id,
        exam: 'Hemograma Infantil',
        urgent: false,
        status: 'pendente',
        requestedById: medico2.id
      }
    ]
  })

  // Estoque
  await prisma.medicineStock.createMany({
    data: [
      {
        healthUnitId: spm.id,
        medicineId: 'LOS-50',
        quantity: 120
      },
      {
        healthUnitId: spm.id,
        medicineId: 'MET-850',
        quantity: 80
      },
      {
        healthUnitId: spm.id,
        medicineId: 'PAR-500',
        quantity: 200
      }
    ]
  })

  // Movimentações
  await prisma.stockTransaction.createMany({
    data: [
      {
        healthUnitId: spm.id,
        medicineId: 'LOS-50',
        medicineName: 'Losartana 50mg',
        userId: secretario.id,
        type: 'entrada',
        quantity: 150
      },
      {
        healthUnitId: spm.id,
        medicineId: 'LOS-50',
        medicineName: 'Losartana 50mg',
        userId: atendente.id,
        type: 'saida',
        quantity: 30
      },
      {
        healthUnitId: spm.id,
        medicineId: 'MET-850',
        medicineName: 'Metformina 850mg',
        userId: atendente.id,
        type: 'saida',
        quantity: 20
      }
    ]
  })

  // Fila de espera
  await prisma.waitingList.create({
    data: {
      patientId: pacientes[3].id,
      specialty: 'Dermatologia'
    }
  })

  // Vacância
  await prisma.vacancy.create({
    data: {
      patientId: pacientes[3].id,
      patientName: pacientes[3].name,
      specialty: 'Dermatologia',
      unit: 'spm Centro',
      notifiedAt: new Date(),
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: 'waiting_response'
    }
  })

  // Configuração agenda online
  await prisma.onlineSlotConfig.createMany({
    data: [
      { unit: 'spm Centro', dayOfWeek: 1, onlinePercentage: 50, maxOnlineSlots: 8 },
      { unit: 'spm Centro', dayOfWeek: 2, onlinePercentage: 50, maxOnlineSlots: 8 },
      { unit: 'spm Centro', dayOfWeek: 3, onlinePercentage: 60, maxOnlineSlots: 10 },
      { unit: 'spm Centro', dayOfWeek: 4, onlinePercentage: 60, maxOnlineSlots: 10 },
      { unit: 'spm Centro', dayOfWeek: 5, onlinePercentage: 50, maxOnlineSlots: 8 }
    ]
  })

  // Configuração de consultas
  await prisma.appointmentConfig.createMany({
    data: [
      {
        specialty: 'Clínica Geral',
        dayOfWeek: 1,
        maxOnlineSlots: 8,
        maxTotalSlots: 20,
        createdById: secretario.id
      },
      {
        specialty: 'Pediatria',
        dayOfWeek: 2,
        maxOnlineSlots: 6,
        maxTotalSlots: 15,
        createdById: secretario.id
      }
    ]
  })

  // Log de auditoria
  await prisma.auditLog.createMany({
    data: [
      {
        userId: secretario.id,
        userName: secretario.name,
        userRole: secretario.role,
        action: 'LOGIN',
        target: 'Sistema',
        details: '{"ip":"127.0.0.1"}'
      },
      {
        userId: medico1.id,
        userName: medico1.name,
        userRole: medico1.role,
        action: 'CRIAR_RECEITA',
        target: pacientes[0].name,
        details: '{"medicamento":"Losartana 50mg"}'
      }
    ]
  })

  console.log('✅ Seed concluído com sucesso!')
  console.log('👤 Login médico: medico@spm.gov.br / senha123')
  console.log('👤 Login atendente: atendente@spm.gov.br / senha123')
  console.log('👤 Login secretário: secretario@spm.gov.br / senha123')
  console.log('👤 Login admin: admin@spm.gov.br / admin123')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })