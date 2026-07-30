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
      name: 'UBS Centro'
    }
  })

  const secretario = await prisma.user.create({
    data: {
      email: 'secretario@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Ana Souza',
      role: 'secretario',
      unit: 'UBS Centro',
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
      unit: 'UBS Centro',
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
      unit: 'UBS Centro',
      healthUnitId: spm.id
    }
  })

  const medico3 = await prisma.user.create({
    data: {
      email: 'medico3@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Dr. Fernando Alves',
      role: 'medico',
      crm: 'CRM-PR 11223',
      specialty: 'Cardiologia',
      unit: 'UBS Centro',
      healthUnitId: spm.id
    }
  })

  const medico4 = await prisma.user.create({
    data: {
      email: 'medico4@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Dra. Beatriz Santos',
      role: 'medico',
      crm: 'CRM-PR 44556',
      specialty: 'Ginecologia',
      unit: 'UBS Centro',
      healthUnitId: spm.id
    }
  })

  const atendente = await prisma.user.create({
    data: {
      email: 'atendente@spm.gov.br',
      passwordHash: senhaPadrao,
      name: 'Marcos Lima',
      role: 'atendente',
      unit: 'UBS Centro',
      healthUnitId: spm.id
    }
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@spm.gov.br',
      passwordHash: senhaAdmin,
      name: 'Admin Sistema',
      role: 'admin',
      unit: 'UBS Centro',
      healthUnitId: spm.id
    }
  })

  // Pacientes
  const pacientes = await Promise.all([
      prisma.patient.create({
        data: {
          name: 'Fernanda Almeida',
          cpf: '60123456789',
          birthDate: '1988-02-14',
          phone: '(46) 99911-2233',
          address: 'Rua das Acácias, 120 - Centro',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Ricardo Martins',
          cpf: '71234567890',
          birthDate: '1975-09-22',
          phone: '(46) 99922-3344',
          address: 'Av. Brasil, 450 - Jardim América',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Camila Rodrigues',
          cpf: '82345678901',
          birthDate: '1996-11-03',
          phone: '(46) 99933-4455',
          address: 'Rua Paraná, 88 - São Cristóvão',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Lucas Ferreira',
          cpf: '93456789012',
          birthDate: '2002-07-18',
          phone: '(46) 99944-5566',
          address: 'Rua das Araucárias, 15 - Industrial',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Patrícia Gomes',
          cpf: '14567890123',
          birthDate: '1983-01-30',
          phone: '(46) 99955-6677',
          address: 'Rua XV de Novembro, 300 - Centro Norte',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Eduardo Lima',
          cpf: '25678901234',
          birthDate: '1990-05-12',
          phone: '(46) 99966-7788',
          address: 'Rua Pioneiro João Pedro, 52 - Esperança',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Juliana Costa',
          cpf: '36789012345',
          birthDate: '1998-12-25',
          phone: '(46) 99977-8899',
          address: 'Av. Rio Grande do Sul, 980 - Alto da Glória',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Marcelo Pereira',
          cpf: '47890123456',
          birthDate: '1972-03-08',
          phone: '(46) 99988-9900',
          address: 'Rua Santa Catarina, 211 - Vila Nova',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Vanessa Oliveira',
          cpf: '58901234567',
          birthDate: '1985-08-16',
          phone: '(46) 99811-1020',
          address: 'Rua dos Ipês, 64 - Jardim Primavera',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Rafael Santos',
          cpf: '69012345678',
          birthDate: '1994-04-27',
          phone: '(46) 99822-2030',
          address: 'Av. Presidente Vargas, 742 - Centro',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Bianca Carvalho',
          cpf: '70123456780',
          birthDate: '2001-10-05',
          phone: '(46) 99833-3040',
          address: 'Rua Monteiro Lobato, 33 - Bela Vista',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'André Barbosa',
          cpf: '81234567801',
          birthDate: '1987-06-19',
          phone: '(46) 99844-4050',
          address: 'Rua Tiradentes, 156 - Centro Sul',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Larissa Nunes',
          cpf: '92345678012',
          birthDate: '1999-01-11',
          phone: '(46) 99855-5060',
          address: 'Rua José Bonifácio, 410 - São Francisco',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Gustavo Ribeiro',
          cpf: '13456789013',
          birthDate: '1979-09-29',
          phone: '(46) 99866-6070',
          address: 'Rua Dom Pedro II, 97 - Industrial II',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Aline Teixeira',
          cpf: '24567890124',
          birthDate: '1993-02-07',
          phone: '(46) 99877-7080',
          address: 'Rua Marechal Rondon, 520 - Jardim União',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Renata Dias',
          cpf: '35678901235',
          birthDate: '1991-04-19',
          phone: '(46) 99888-1122',
          address: 'Rua Sete de Setembro, 210 - Centro',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Bruno Cardoso',
          cpf: '46789012346',
          birthDate: '1980-10-02',
          phone: '(46) 99899-2233',
          address: 'Av. Independência, 88 - Jardim América',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Débora Moreira',
          cpf: '57890123457',
          birthDate: '2000-06-15',
          phone: '(46) 99900-3344',
          address: 'Rua Duque de Caxias, 305 - São Cristóvão',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Diego Correia',
          cpf: '68901234568',
          birthDate: '1986-12-08',
          phone: '(46) 99901-4455',
          address: 'Rua Bento Gonçalves, 77 - Industrial',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Priscila Machado',
          cpf: '79012345679',
          birthDate: '1997-03-21',
          phone: '(46) 99902-5566',
          address: 'Rua Getúlio Vargas, 190 - Centro Norte',
          lgpdAccepted: true
        }
      }),
      prisma.patient.create({
        data: {
          name: 'Fábio Pinto',
          cpf: '80123456780',
          birthDate: '1974-07-30',
          phone: '(46) 99903-6677',
          address: 'Rua Barão do Rio Branco, 44 - Esperança',
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
      },
      {
        patientId: pacientes[5].id,
        doctorId: medico3.id,
        specialty: 'Cardiologia',
        scheduledAt: new Date('2026-08-12T08:30:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[6].id,
        doctorId: medico3.id,
        specialty: 'Cardiologia',
        scheduledAt: new Date('2026-08-12T09:30:00'),
        status: 'aguardando'
      },
      {
        patientId: pacientes[7].id,
        doctorId: medico4.id,
        specialty: 'Ginecologia',
        scheduledAt: new Date('2026-08-12T14:00:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[8].id,
        doctorId: medico4.id,
        specialty: 'Ginecologia',
        scheduledAt: new Date('2026-08-12T15:00:00'),
        status: 'em_atendimento'
      },
      {
        patientId: pacientes[9].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-13T08:00:00'),
        status: 'concluido'
      },
      {
        patientId: pacientes[10].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-13T09:00:00'),
        status: 'cancelado'
      },
      {
        patientId: pacientes[11].id,
        doctorId: medico2.id,
        specialty: 'Pediatria',
        scheduledAt: new Date('2026-08-13T13:30:00'),
        status: 'faltou'
      },
      {
        patientId: pacientes[12].id,
        doctorId: medico3.id,
        specialty: 'Cardiologia',
        scheduledAt: new Date('2026-08-14T08:30:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[13].id,
        doctorId: medico4.id,
        specialty: 'Ginecologia',
        scheduledAt: new Date('2026-08-14T14:00:00'),
        status: 'aguardando'
      },
      {
        patientId: pacientes[14].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-17T08:00:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[15].id,
        doctorId: medico2.id,
        specialty: 'Pediatria',
        scheduledAt: new Date('2026-08-17T13:30:00'),
        status: 'aguardando'
      },
      {
        patientId: pacientes[16].id,
        doctorId: medico3.id,
        specialty: 'Cardiologia',
        scheduledAt: new Date('2026-08-18T08:30:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[17].id,
        doctorId: medico4.id,
        specialty: 'Ginecologia',
        scheduledAt: new Date('2026-08-18T14:00:00'),
        status: 'confirmado'
      },
      {
        patientId: pacientes[18].id,
        doctorId: medico1.id,
        specialty: 'Clínica Geral',
        scheduledAt: new Date('2026-08-19T08:00:00'),
        status: 'aguardando'
      },
      {
        patientId: pacientes[19].id,
        doctorId: medico2.id,
        specialty: 'Pediatria',
        scheduledAt: new Date('2026-08-19T13:30:00'),
        status: 'confirmado'
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
      },
      {
        patientId: pacientes[5].id,
        doctorId: medico3.id,
        doctorName: medico3.name,
        doctorCrm: medico3.crm,
        medication: 'Sinvastatina 20mg',
        activeSubstance: 'Sinvastatina',
        dosage: '20mg',
        frequency: '1x ao dia à noite',
        durationDays: 90,
        schedule: '22:00',
        validationCode: 'RX-2026-0003'
      },
      {
        patientId: pacientes[7].id,
        doctorId: medico4.id,
        doctorName: medico4.name,
        doctorCrm: medico4.crm,
        medication: 'Ácido Fólico 5mg',
        activeSubstance: 'Ácido Fólico',
        dosage: '5mg',
        frequency: '1x ao dia',
        durationDays: 90,
        schedule: '08:00',
        validationCode: 'RX-2026-0004'
      },
      {
        patientId: pacientes[9].id,
        doctorId: medico1.id,
        doctorName: medico1.name,
        doctorCrm: medico1.crm,
        medication: 'Omeprazol 20mg',
        activeSubstance: 'Omeprazol',
        dosage: '20mg',
        frequency: '1x ao dia em jejum',
        durationDays: 30,
        schedule: '07:00',
        validationCode: 'RX-2026-0005'
      },
      {
        patientId: pacientes[12].id,
        doctorId: medico3.id,
        doctorName: medico3.name,
        doctorCrm: medico3.crm,
        medication: 'Losartana + Hidroclorotiazida',
        activeSubstance: 'Losartana/HCTZ',
        dosage: '50mg/12,5mg',
        frequency: '1x ao dia',
        durationDays: 30,
        schedule: '08:00',
        validationCode: 'RX-2026-0006'
      },
      {
        patientId: pacientes[15].id,
        doctorId: medico2.id,
        doctorName: medico2.name,
        doctorCrm: medico2.crm,
        medication: 'Amoxicilina 500mg',
        activeSubstance: 'Amoxicilina',
        dosage: '500mg',
        frequency: '3x ao dia',
        durationDays: 10,
        schedule: '08:00, 14:00, 20:00',
        validationCode: 'RX-2026-0007'
      },
      {
        patientId: pacientes[18].id,
        doctorId: medico1.id,
        doctorName: medico1.name,
        doctorCrm: medico1.crm,
        medication: 'Ibuprofeno 600mg',
        activeSubstance: 'Ibuprofeno',
        dosage: '600mg',
        frequency: 'a cada 8h se dor',
        durationDays: 5,
        schedule: '08:00, 16:00, 00:00',
        validationCode: 'RX-2026-0008'
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
      },
      {
        patientId: pacientes[6].id,
        exam: 'Eletrocardiograma',
        urgent: true,
        status: 'agendado',
        requestedById: medico3.id
      },
      {
        patientId: pacientes[8].id,
        exam: 'Ultrassonografia Abdominal',
        urgent: false,
        status: 'pendente',
        requestedById: medico4.id
      },
      {
        patientId: pacientes[10].id,
        exam: 'Colesterol Total e Frações',
        urgent: false,
        status: 'coletado',
        requestedById: medico1.id
      },
      {
        patientId: pacientes[13].id,
        exam: 'Papanicolau',
        urgent: false,
        status: 'agendado',
        requestedById: medico4.id
      },
      {
        patientId: pacientes[16].id,
        exam: 'TSH e T4 Livre',
        urgent: false,
        status: 'laudo_pronto',
        requestedById: medico3.id
      },
      {
        patientId: pacientes[19].id,
        exam: 'Urina Tipo I (EAS)',
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
      },
      {
        healthUnitId: spm.id,
        medicineId: 'OME-20',
        quantity: 150
      },
      {
        healthUnitId: spm.id,
        medicineId: 'AMO-500',
        quantity: 90
      },
      {
        healthUnitId: spm.id,
        medicineId: 'SIN-20',
        quantity: 60
      },
      {
        healthUnitId: spm.id,
        medicineId: 'IBU-600',
        quantity: 100
      },
      {
        healthUnitId: spm.id,
        medicineId: 'AFO-5',
        quantity: 45
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
      },
      {
        healthUnitId: spm.id,
        medicineId: 'PAR-500',
        medicineName: 'Paracetamol 500mg',
        userId: secretario.id,
        type: 'entrada',
        quantity: 250
      },
      {
        healthUnitId: spm.id,
        medicineId: 'PAR-500',
        medicineName: 'Paracetamol 500mg',
        userId: atendente.id,
        type: 'saida',
        quantity: 50
      },
      {
        healthUnitId: spm.id,
        medicineId: 'OME-20',
        medicineName: 'Omeprazol 20mg',
        userId: secretario.id,
        type: 'entrada',
        quantity: 180
      },
      {
        healthUnitId: spm.id,
        medicineId: 'AMO-500',
        medicineName: 'Amoxicilina 500mg',
        userId: atendente.id,
        type: 'saida',
        quantity: 10
      },
      {
        healthUnitId: spm.id,
        medicineId: 'SIN-20',
        medicineName: 'Sinvastatina 20mg',
        userId: secretario.id,
        type: 'entrada',
        quantity: 70
      },
      {
        healthUnitId: spm.id,
        medicineId: 'IBU-600',
        medicineName: 'Ibuprofeno 600mg',
        userId: atendente.id,
        type: 'saida',
        quantity: 20
      },
      {
        healthUnitId: spm.id,
        medicineId: 'AFO-5',
        medicineName: 'Ácido Fólico 5mg',
        userId: secretario.id,
        type: 'entrada',
        quantity: 50
      }
    ]
  })

  // Fila de espera
  await prisma.waitingList.createMany({
    data: [
      {
        patientId: pacientes[3].id,
        specialty: 'Dermatologia'
      },
      {
        patientId: pacientes[14].id,
        specialty: 'Cardiologia'
      },
      {
        patientId: pacientes[16].id,
        specialty: 'Ortopedia'
      },
      {
        patientId: pacientes[18].id,
        specialty: 'Ginecologia'
      }
    ]
  })

  // Vacância
  await prisma.vacancy.createMany({
    data: [
      {
        patientId: pacientes[3].id,
        patientName: pacientes[3].name,
        specialty: 'Dermatologia',
        unit: 'UBS Centro',
        notifiedAt: new Date(),
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
        status: 'waiting_response'
      },
      {
        patientId: pacientes[14].id,
        patientName: pacientes[14].name,
        specialty: 'Cardiologia',
        unit: 'UBS Centro',
        notifiedAt: new Date(),
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 12),
        status: 'waiting_response'
      },
      {
        patientId: pacientes[16].id,
        patientName: pacientes[16].name,
        specialty: 'Ortopedia',
        unit: 'UBS Centro',
        notifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        deadline: new Date(Date.now() - 1000 * 60 * 60 * 2),
        status: 'expired'
      }
    ]
  })

  // Configuração agenda online
  await prisma.onlineSlotConfig.createMany({
    data: [
      { unit: 'UBS Centro', dayOfWeek: 1, onlinePercentage: 50, maxOnlineSlots: 8 },
      { unit: 'UBS Centro', dayOfWeek: 2, onlinePercentage: 50, maxOnlineSlots: 8 },
      { unit: 'UBS Centro', dayOfWeek: 3, onlinePercentage: 60, maxOnlineSlots: 10 },
      { unit: 'UBS Centro', dayOfWeek: 4, onlinePercentage: 60, maxOnlineSlots: 10 },
      { unit: 'UBS Centro', dayOfWeek: 5, onlinePercentage: 50, maxOnlineSlots: 8 }
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
      },
      {
        specialty: 'Cardiologia',
        dayOfWeek: 3,
        maxOnlineSlots: 4,
        maxTotalSlots: 12,
        createdById: secretario.id
      },
      {
        specialty: 'Ginecologia',
        dayOfWeek: 4,
        maxOnlineSlots: 5,
        maxTotalSlots: 14,
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
      },
      {
        userId: medico2.id,
        userName: medico2.name,
        userRole: medico2.role,
        action: 'CRIAR_RECEITA',
        target: pacientes[1].name,
        details: '{"medicamento":"Metformina 850mg"}'
      },
      {
        userId: medico3.id,
        userName: medico3.name,
        userRole: medico3.role,
        action: 'SOLICITAR_EXAME',
        target: pacientes[6].name,
        details: '{"exame":"Eletrocardiograma"}'
      },
      {
        userId: medico4.id,
        userName: medico4.name,
        userRole: medico4.role,
        action: 'CRIAR_RECEITA',
        target: pacientes[7].name,
        details: '{"medicamento":"Ácido Fólico 5mg"}'
      },
      {
        userId: atendente.id,
        userName: atendente.name,
        userRole: atendente.role,
        action: 'BAIXA_ESTOQUE',
        target: 'Losartana 50mg',
        details: '{"quantidade":30}'
      },
      {
        userId: admin.id,
        userName: admin.name,
        userRole: admin.role,
        action: 'LOGIN',
        target: 'Sistema',
        details: '{"ip":"127.0.0.1"}'
      },
      {
        userId: secretario.id,
        userName: secretario.name,
        userRole: secretario.role,
        action: 'AGENDAR_CONSULTA',
        target: pacientes[9].name,
        details: '{"especialidade":"Clínica Geral"}'
      }
    ]
  })

  console.log('✅ Seed concluído com sucesso!')
  console.log('👤 Login médico: medico@spm.gov.br / senha123')
  console.log('👤 Login médico (Pediatria): medico2@spm.gov.br / senha123')
  console.log('👤 Login médico (Cardiologia): medico3@spm.gov.br / senha123')
  console.log('👤 Login médico (Ginecologia): medico4@spm.gov.br / senha123')
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