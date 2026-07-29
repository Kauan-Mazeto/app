import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const resultsFile = path.resolve(backendDir, 'tests', 'smoke-results.json');
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:8001';

let serverProcess = null;
let serverReady = false;
const results = [];

function log(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}: ${detail}`);
}

function saveResults() {
  fs.writeFileSync(resultsFile, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
}

function waitForServer(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const req = http.get(`${baseUrl}/api/refs/cid`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('Servidor não respondeu a tempo'));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn(process.execPath, ['src/server.js'], {
      cwd: backendDir,
      env: { ...process.env, PORT: '8001' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    serverProcess.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('backend em')) {
        serverReady = true;
        resolve();
      }
    });
    serverProcess.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    serverProcess.on('exit', (code) => {
      if (!serverReady) {
        reject(new Error(`Servidor encerrou antes de ficar pronto (código ${code})`));
      }
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) return resolve();
    serverProcess.kill('SIGTERM');
    serverProcess.once('exit', () => resolve());
    setTimeout(() => resolve(), 2000);
  });
}

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    let body;

    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers['content-type'] = headers['content-type'] || 'application/json';
    }

    if (options.cookie) headers.cookie = options.cookie;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8001,
        path: pathname,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let rawBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawBody += chunk; });
        res.on('end', () => {
          try {
            const parsed = rawBody ? JSON.parse(rawBody) : {};
            resolve({ status: res.statusCode, body: parsed, raw: rawBody, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, body: rawBody, raw: rawBody, headers: res.headers });
          }
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTest(name, fn) {
  try {
    const result = await fn();
    log(name, true, result);
    results.push({ name, ok: true, detail: result });
  } catch (error) {
    const detail = error.message || String(error);
    log(name, false, detail);
    results.push({ name, ok: false, detail });
  }
}

async function runPrismaMigrate() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '8001' },
    });

    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Migrate falhou com código ${code}: ${output}`));
      else resolve(output);
    });
  });
}

async function seedDatabase() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/seed.js'], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '8001' },
    });

    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Seed falhou com código ${code}`));
      else resolve(output);
    });
  });
}

async function login(email, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Falha ao autenticar ${email}: status=${res.status}`);
  }
  return {
    email,
    token: res.body.token,
    cookie: `access_token=${res.body.token}`,
    user: res.body,
  };
}

async function main() {
  try {
    await runPrismaMigrate();
    await seedDatabase();
    await startServer();
    await waitForServer();
  } catch (error) {
    console.error('Falha ao preparar o ambiente de testes:', error.message);
    process.exitCode = 1;
    return;
  }

  const admin = await login('admin@saudeconecta.gov.br', 'admin123');
  const atendente = await login('atendente@saudeconecta.gov.br', 'senha123');
  const medico = await login('medico@saudeconecta.gov.br', 'senha123');

  let createdPatientId = null;
  let createdAppointmentId = null;
  let createdPrescriptionId = null;
  let createdExamId = null;
  let createdUnitId = null;
  let createdUserId = null;

  await runTest('GET /api/refs/cid', async () => {
    const res = await request('/api/refs/cid');
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
      throw new Error(`status=${res.status}`);
    }
    return 'referências carregadas';
  });

  await runTest('POST /api/auth/login com credenciais válidas', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@saudeconecta.gov.br', password: 'admin123' },
    });
    if (res.status !== 200 || !res.body?.token) throw new Error(`status=${res.status}`);
    return 'login admin ok';
  });

  await runTest('GET /api/auth/me com token', async () => {
    const res = await request('/api/auth/me', { cookie: admin.cookie });
    if (res.status !== 200 || res.body.role !== 'admin') throw new Error(`status=${res.status}`);
    return 'perfil retornado';
  });

  await runTest('GET /api/users como admin', async () => {
    const res = await request('/api/users', { cookie: admin.cookie });
    if (res.status !== 200 || !Array.isArray(res.body)) throw new Error(`status=${res.status}`);
    return `usuários listados (${res.body.length})`;
  });

  await runTest('POST /api/users criar novo usuário', async () => {
    const uniqueEmail = `qa-${Date.now()}@saudeconecta.gov.br`;
    const res = await request('/api/users', {
      method: 'POST',
      cookie: admin.cookie,
      body: { email: uniqueEmail, password: 'senha123', name: 'Usuário QA', role: 'secretario' },
    });
    if (res.status !== 200 || !res.body?.id) throw new Error(`status=${res.status}`);
    createdUserId = res.body.id;
    return `usuário criado (${uniqueEmail})`;
  });

  await runTest('POST /api/patients criar paciente', async () => {
    const uniqueCpf = `${Date.now()}`.slice(-8);
    const res = await request('/api/patients', {
      method: 'POST',
      cookie: atendente.cookie,
      body: {
        name: 'Paciente QA',
        cpf: `${uniqueCpf.slice(0, 3)}.${uniqueCpf.slice(3, 6)}.${uniqueCpf.slice(6)}-00`,
        birth_date: '1990-01-01',
        phone: '(11) 99999-9999',
        address: 'Rua QA, 123',
        lgpd_accepted: true,
      },
    });
    if (res.status !== 200 || !res.body?.id) throw new Error(`status=${res.status}`);
    createdPatientId = res.body.id;
    return 'paciente criado';
  });

  await runTest('GET /api/patients buscar paciente', async () => {
    const res = await request(`/api/patients/${createdPatientId}`, { cookie: atendente.cookie });
    if (res.status !== 200 || res.body.id !== createdPatientId) throw new Error(`status=${res.status}`);
    return 'paciente encontrado';
  });

  await runTest('POST /api/appointments criar consulta', async () => {
    const res = await request('/api/appointments', {
      method: 'POST',
      cookie: atendente.cookie,
      body: {
        patient_id: createdPatientId,
        specialty: 'Clínica Geral',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        priority: 'normal',
        unit: 'UBS Central',
      },
    });
    if (res.status !== 200 || !res.body?.id) throw new Error(`status=${res.status}`);
    createdAppointmentId = res.body.id;
    return 'consulta criada';
  });

  await runTest('PATCH /api/appointments/:id atualizar status', async () => {
    const res = await request(`/api/appointments/${createdAppointmentId}`, {
      method: 'PATCH',
      cookie: atendente.cookie,
      body: { status: 'compareceu' },
    });
    if (res.status !== 200) throw new Error(`status=${res.status}`);
    return 'status atualizado';
  });

  await runTest('GET /api/queue/today', async () => {
    const res = await request('/api/queue/today', { cookie: atendente.cookie });
    if (res.status !== 200 || !Array.isArray(res.body.appointments)) throw new Error(`status=${res.status}`);
    return 'fila retornada';
  });

  await runTest('POST /api/secretario/agenda/lock/unlock/status', async () => {
    const lockDate = new Date();
    lockDate.setDate(lockDate.getDate() + 2);
    const dateStr = lockDate.toISOString().split('T')[0];
    const lockRes = await request('/api/secretario/agenda/lock', {
      method: 'POST',
      cookie: atendente.cookie,
      body: { doctor_id: medico.user.id, date: dateStr, reason: 'Teste automático' },
    });
    if (lockRes.status !== 201 || !lockRes.body?.lock?.id) throw new Error(`lock status=${lockRes.status}`);
    const statusRes = await request(`/api/secretario/agenda/status?date=${dateStr}`, { cookie: atendente.cookie });
    if (statusRes.status !== 200) throw new Error(`status=${statusRes.status}`);
    const unlockRes = await request(`/api/secretario/agenda/${lockRes.body.lock.id}/unlock`, {
      method: 'POST',
      cookie: atendente.cookie,
    });
    if (unlockRes.status !== 200) throw new Error(`unlock status=${unlockRes.status}`);
    return 'bloqueio e desbloqueio OK';
  });

  await runTest('GET /api/health-units e POST /api/health-units', async () => {
    const listRes = await request('/api/health-units', { cookie: admin.cookie });
    if (listRes.status !== 200 || !Array.isArray(listRes.body)) throw new Error(`list status=${listRes.status}`);
    const unitName = `QA Unit ${Date.now()}`;
    const createRes = await request('/api/health-units', {
      method: 'POST',
      cookie: admin.cookie,
      body: { name: unitName },
    });
    if (createRes.status !== 200 || !createRes.body?.id) throw new Error(`create status=${createRes.status}`);
    createdUnitId = createRes.body.id;
    return 'unidades listadas e criadas';
  });

  await runTest('GET/PUT /api/scheduling-config', async () => {
    const getRes = await request('/api/scheduling-config?unit=UBS%20Central', { cookie: admin.cookie });
    if (getRes.status !== 200 || !getRes.body?.days) throw new Error(`get status=${getRes.status}`);
    const putRes = await request('/api/scheduling-config', {
      method: 'PUT',
      cookie: admin.cookie,
      body: {
        unit: 'UBS Central',
        days: [{ day_of_week: 1, online_percentage: 60, max_online_slots: 5 }],
      },
    });
    if (putRes.status !== 200) throw new Error(`put status=${putRes.status}`);
    return 'configuração salva';
  });

  await runTest('GET /api/scheduling-config/availability', async () => {
    const res = await request('/api/scheduling-config/availability?unit=UBS%20Central&date=2026-07-29', { cookie: admin.cookie });
    if (res.status !== 200 || typeof res.body.blocked !== 'boolean') throw new Error(`status=${res.status}`);
    return 'disponibilidade consultada';
  });

  await runTest('POST /api/prescriptions criar receita', async () => {
    const res = await request('/api/prescriptions', {
      method: 'POST',
      cookie: medico.cookie,
      body: {
        patient_id: createdPatientId,
        active_substance: 'Paracetamol',
        medication: 'Paracetamol 500mg',
        dosage: '1 comprimido',
        frequency: '2x ao dia',
        duration_days: 7,
        route: 'Oral',
        schedule: ['08:00', '20:00'],
      },
    });
    if (res.status !== 200 || !res.body?.id) throw new Error(`status=${res.status}`);
    createdPrescriptionId = res.body.id;
    return 'receita criada';
  });

  await runTest('POST /api/prescriptions/:id/adherence', async () => {
    const res = await request(`/api/prescriptions/${createdPrescriptionId}/adherence`, {
      method: 'POST',
      cookie: medico.cookie,
      body: { status: 'taken', note: 'Teste automático' },
    });
    if (res.status !== 200 || !Array.isArray(res.body.adherence_logs)) throw new Error(`status=${res.status}`);
    return 'adesão registrada';
  });

  await runTest('GET /api/exams e POST /api/exams', async () => {
    const listRes = await request('/api/exams', { cookie: medico.cookie });
    if (listRes.status !== 200 || !Array.isArray(listRes.body)) throw new Error(`list status=${listRes.status}`);
    const createRes = await request('/api/exams', {
      method: 'POST',
      cookie: medico.cookie,
      body: {
        patient_id: createdPatientId,
        exams: ['Hemograma completo'],
        preparation_notes: 'Jejum de 8 horas',
        urgent: true,
      },
    });
    if (createRes.status !== 200 || !Array.isArray(createRes.body) || createRes.body.length === 0) throw new Error(`create status=${createRes.status}`);
    createdExamId = createRes.body[0].id;
    return 'exame criado';
  });

  await runTest('PATCH /api/exams/:id/status', async () => {
    const res = await request(`/api/exams/${createdExamId}/status?status=pronto`, {
      method: 'PATCH',
      cookie: admin.cookie,
    });
    if (res.status !== 200) throw new Error(`status=${res.status}`);
    return 'status do exame atualizado';
  });

  await runTest('GET /api/waiting-list e /api/vacancies/active', async () => {
    const waitingRes = await request('/api/waiting-list', { cookie: admin.cookie });
    const vacanciesRes = await request('/api/vacancies/active', { cookie: admin.cookie });
    if (waitingRes.status !== 200 || !Array.isArray(waitingRes.body)) throw new Error(`waiting=${waitingRes.status}`);
    if (vacanciesRes.status !== 200 || !Array.isArray(vacanciesRes.body)) throw new Error(`vacancies=${vacanciesRes.status}`);
    return 'listas retornadas';
  });

  await runTest('GET /api/dashboard/secretario', async () => {
    const res = await request('/api/dashboard/secretario', { cookie: admin.cookie });
    if (res.status !== 200 || !res.body?.kpis) throw new Error(`status=${res.status}`);
    return 'dashboard retornado';
  });

  await runTest('POST /api/stock/entry e /api/stock/exit', async () => {
    const entryRes = await request('/api/stock/entry', {
      method: 'POST',
      cookie: atendente.cookie,
      body: {
        medicine_id: 'MED-QA-1',
        quantity: 10,
        medicine_name: 'Medicamento QA',
        dosage: '1 comprimido',
        lot: 'L1',
        notes: 'Teste automático',
        health_unit_id: createdUnitId || 'UBS Central',
      },
    });
    if (entryRes.status !== 200) throw new Error(`entry=${entryRes.status}`);
    const exitRes = await request('/api/stock/exit', {
      method: 'POST',
      cookie: atendente.cookie,
      body: {
        medicine_id: 'MED-QA-1',
        quantity: 2,
        medicine_name: 'Medicamento QA',
        health_unit_id: createdUnitId || 'UBS Central',
      },
    });
    if (exitRes.status !== 200) throw new Error(`exit=${exitRes.status} detail=${JSON.stringify(exitRes.body)}`);
    return 'estoque atualizado';
  });

  await runTest('GET /api/stock/transactions e /api/stock/summary', async () => {
    const transactionsRes = await request('/api/stock/transactions', { cookie: admin.cookie });
    const summaryRes = await request('/api/stock/summary', { cookie: admin.cookie });
    if (transactionsRes.status !== 200 || !Array.isArray(transactionsRes.body)) throw new Error(`transactions=${transactionsRes.status}`);
    if (summaryRes.status !== 200 || !Array.isArray(summaryRes.body)) throw new Error(`summary=${summaryRes.status}`);
    return 'movimentações e resumo retornados';
  });

  await runTest('GET /api/secretario/dashboard-stock', async () => {
    const res = await request('/api/secretario/dashboard-stock', { cookie: admin.cookie });
    if (res.status !== 200 || !Array.isArray(res.body)) throw new Error(`status=${res.status}`);
    return 'dashboard de estoque retornado';
  });

  await runTest('GET /api/audit-logs', async () => {
    const res = await request('/api/audit-logs', { cookie: admin.cookie });
    if (res.status !== 200 || !Array.isArray(res.body)) throw new Error(`status=${res.status}`);
    return 'logs de auditoria retornados';
  });

  await runTest('GET /api/ai/opcoes', async () => {
    const res = await request('/api/ai/opcoes', { cookie: admin.cookie });
    if (![200, 500].includes(res.status)) throw new Error(`status=${res.status}`);
    return 'opções de IA consultadas';
  });
}

main().finally(() => {
  saveResults();
  const failures = results.filter((item) => !item.ok).length;
  stopServer().finally(() => {
    process.exitCode = failures > 0 ? 1 : 0;
  });
});
