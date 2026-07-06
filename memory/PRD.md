# SaúdeConecta — PRD

## Original Problem Statement
Sistema web ERP para SUS gerenciando pacientes em tratamento contínuo de medicamentos controlados. Objetivo: reduzir filas, aumentar adesão medicamentosa, dar validade jurídica (Gov.br) a receitas digitais e prover dashboards de gestão pública. 4 perfis: Médico, Atendente, Secretário de Saúde, Admin.

## User Personas
- **Médico** — atende fila do dia, cria receitas digitais com trava de segurança, solicita exames SIGTAP
- **Atendente** — cadastra pacientes, agenda consultas presenciais, entrega exames, monitora vagas ociosas em tempo real
- **Secretário de Saúde** — visualiza indicadores gerenciais, previsão de demanda, ranking de unidades, auditoria
- **Admin** — cadastra profissionais, gestão de acesso

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async) + JWT (bcrypt + cookies httpOnly + Bearer fallback)
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn primitives + Recharts + sonner
- **Data model**: users, patients, appointments, prescriptions, exams, waiting_list, vacancies, audit_logs
- **Seed** automático no startup com 4 profissionais + 20 pacientes + 135 consultas + prescrições + exames + vagas ativas

## Implementado (2026-02)
- [x] Autenticação JWT com 4 perfis e roteamento condicional
- [x] Landing page pública + Login com atalhos demo
- [x] Médico: fila por prioridade, prontuário LGPD-gated, receita digital com trava de duplicidade + assinatura mock Gov.br, solicitação de exames SIGTAP
- [x] Atendente: dashboard, cadastro paciente, agendamento presencial, painel vagas ociosas com cronômetro regressivo, entrega de exames, buscador CID/TUSS/SIGTAP
- [x] Secretário: KPIs (adesão, absenteísmo, NPS), previsão de demanda, ranking unidades, gargalos por especialidade, auditoria com export CSV
- [x] Admin: cadastro de profissionais agrupados por perfil
- [x] Regra RF10: bloqueio automático de agendamento online após 2 faltas injustificadas
- [x] Auditoria de ações críticas (receitas, faltas, criações)

## Backlog (P1/P2)
- P1: Cancelamento de consulta com justificativa e liberação automática de vaga
- P1: Integração real Gov.br (assinatura ITI/CFM) — atualmente MOCKED
- P1: Notificação real via WhatsApp para vagas ociosas — atualmente MOCKED
- P1: Aplicativo mobile do paciente (alarmes, confirmação de ingestão, receitas digitais)
- P2: Painel de adesão medicamentosa detalhado (linha do tempo por medicamento)
- P2: IA anti-burla real (padrões de clique suspeitos) — atualmente MOCKED
- P2: Emissão de PDF assinado das receitas
- P2: Vinculação paciente ↔ responsáveis/cuidadores
- P2: Multi-tenant por unidade de saúde
