import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Calendar, Users, Search, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AtendenteDashboard() {
  const [patients, setPatients] = useState([]);
  const [appts, setAppts] = useState([]);
  const [q, setQ] = useState("");
  const [showApptForm, setShowApptForm] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [medicos, setMedicos] = useState([]);
  const [ap, setAp] = useState({ patient_id: "", doctor_id: "", specialty: "Clínica Geral", scheduled_at: "", priority: "normal", unit: "UBS Central" });
  const [np, setNp] = useState({ name: "", cpf: "", birth_date: "2000-01-01", phone: "", address: "", lgpd_accepted: true });

  const load = async () => {
    const p = await api.get(`/patients?q=${encodeURIComponent(q)}`);
    setPatients(p.data);
    const today = new Date().toISOString().slice(0, 10);
    const a = await api.get(`/appointments?date=${today}`);
    setAppts(a.data);
    const u = await api.get("/users");
    setMedicos(u.data.filter(x => x.role === "medico"));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);

  const createAppt = async () => {
    try {
      const iso = new Date(ap.scheduled_at).toISOString();
      await api.post("/appointments", { ...ap, scheduled_at: iso });
      toast.success("Consulta agendada");
      setShowApptForm(false); load();
    } catch (e) { toast.error("Erro ao agendar"); }
  };

  const createPatient = async () => {
    try {
      await api.post("/patients", np);
      toast.success("Paciente cadastrado");
      setShowPatientForm(false); load();
      setNp({ name: "", cpf: "", birth_date: "2000-01-01", phone: "", address: "", lgpd_accepted: true });
    } catch (e) { toast.error("Erro ao cadastrar"); }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Recepção · Balcão</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Atendimento Presencial</h1>
        </div>
        <div className="flex gap-2">
          <button data-testid="new-appt-btn" onClick={() => setShowApptForm(true)} className="btn-primary">
            <Plus className="w-4 h-4 inline mr-1" /> Agendar Consulta
          </button>
          <button data-testid="new-patient-btn" onClick={() => setShowPatientForm(true)} className="btn-secondary">
            <Plus className="w-4 h-4 inline mr-1" /> Novo Paciente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Pacientes na base" value={patients.length} icon={Users} />
        <Stat label="Consultas hoje" value={appts.length} icon={Calendar} accent="#457B9D" />
        <Stat label="Aguardando" value={appts.filter(a => a.status === "aguardando").length} accent="#E9C46A" />
        <Stat label="Bloqueados por falta" value={patients.filter(p => p.blocked_online).length} accent="#E76F51" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Patient search */}
        <div className="sc-card">
          <h2 className="font-display font-bold text-lg text-[#1D3557] mb-3">Buscar Paciente</h2>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input data-testid="patient-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Nome ou CPF..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm" />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {patients.slice(0, 30).map(p => (
              <div key={p.id} className="flex justify-between items-center border-b border-slate-100 py-2 text-sm" data-testid={`patient-${p.id}`}>
                <div>
                  <div className="font-semibold text-[#1D3557]">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.cpf} · {p.phone}</div>
                </div>
                {p.blocked_online && <span className="text-[10px] bg-[#E76F51]/10 text-[#E76F51] px-2 py-1 rounded font-bold">BLOQUEADO</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Today appointments */}
        <div className="sc-card">
          <h2 className="font-display font-bold text-lg text-[#1D3557] mb-3">Agenda de Hoje</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {appts.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">Sem consultas para hoje.</div>}
            {appts.map(a => (
              <div key={a.id} className="flex justify-between items-center border border-slate-100 rounded-md p-3 text-sm">
                <div>
                  <div className="font-semibold">{a.patient?.name}</div>
                  <div className="text-xs text-slate-500">{a.specialty} · {a.unit}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono-nums font-bold text-[#1D3557]">{a.scheduled_at?.slice(11, 16)}</div>
                  <div className="text-xs capitalize text-slate-500">{a.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showApptForm && (
        <Modal title="Agendar Consulta Presencial" onClose={() => setShowApptForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paciente">
              <select data-testid="ap-patient" value={ap.patient_id} onChange={(e) => setAp({...ap, patient_id: e.target.value})} className="inp">
                <option value="">— Selecionar —</option>
                {patients.filter(p => !p.blocked_online).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Médico">
              <select data-testid="ap-doctor" value={ap.doctor_id} onChange={(e) => {
                const doc = medicos.find(m => m.id === e.target.value);
                setAp({...ap, doctor_id: e.target.value, specialty: doc?.specialty || ap.specialty, unit: doc?.unit || ap.unit});
              }} className="inp">
                <option value="">— Selecionar —</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.name} · {m.specialty}</option>)}
              </select>
            </Field>
            <Field label="Data e hora">
              <input data-testid="ap-datetime" type="datetime-local" value={ap.scheduled_at} onChange={(e) => setAp({...ap, scheduled_at: e.target.value})} className="inp" />
            </Field>
            <Field label="Prioridade">
              <select value={ap.priority} onChange={(e) => setAp({...ap, priority: e.target.value})} className="inp">
                <option value="normal">Normal</option>
                <option value="preferencial">Preferencial</option>
                <option value="urgente">Urgente</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowApptForm(false)} className="btn-secondary">Cancelar</button>
            <button data-testid="ap-submit" onClick={createAppt} disabled={!ap.patient_id || !ap.doctor_id || !ap.scheduled_at} className="btn-primary disabled:opacity-50">Confirmar</button>
          </div>
        </Modal>
      )}

      {showPatientForm && (
        <Modal title="Novo Paciente" onClose={() => setShowPatientForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome completo"><input data-testid="np-name" value={np.name} onChange={(e) => setNp({...np, name: e.target.value})} className="inp" /></Field>
            <Field label="CPF"><input data-testid="np-cpf" value={np.cpf} onChange={(e) => setNp({...np, cpf: e.target.value})} className="inp" /></Field>
            <Field label="Nascimento"><input type="date" value={np.birth_date} onChange={(e) => setNp({...np, birth_date: e.target.value})} className="inp" /></Field>
            <Field label="Telefone"><input value={np.phone} onChange={(e) => setNp({...np, phone: e.target.value})} className="inp" /></Field>
            <div className="col-span-2"><Field label="Endereço"><input value={np.address} onChange={(e) => setNp({...np, address: e.target.value})} className="inp" /></Field></div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={np.lgpd_accepted} onChange={(e) => setNp({...np, lgpd_accepted: e.target.checked})} />
              Paciente aceitou os Termos de Uso (LGPD)
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowPatientForm(false)} className="btn-secondary">Cancelar</button>
            <button data-testid="np-submit" onClick={createPatient} disabled={!np.name || !np.cpf} className="btn-primary disabled:opacity-50">Cadastrar</button>
          </div>
        </Modal>
      )}

      <style>{`
        .inp { width: 100%; padding: .5rem .75rem; border: 1px solid #E2E8F0; border-radius: .375rem; font-size: .875rem; }
        .btn-primary { background: #1D3557; color: #fff; padding: .5rem 1rem; border-radius: .375rem; font-weight: 600; font-size: .875rem; }
        .btn-secondary { background: #fff; color: #1D3557; padding: .5rem 1rem; border: 1px solid #E2E8F0; border-radius: .375rem; font-weight: 600; font-size: .875rem; }
      `}</style>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent = "#1D3557" }) {
  return (
    <div className="sc-card">
      <div className="overline">{label}</div>
      <div className="font-display text-3xl font-extrabold mt-2" style={{color: accent}}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">{label}</label>{children}</div>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-extrabold text-xl text-[#1D3557] mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
