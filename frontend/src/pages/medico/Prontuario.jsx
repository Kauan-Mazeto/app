import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, formatError } from "@/lib/api";
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  Pill,
  FlaskConical,
  Lock,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const substances = [
  "Losartana Potássica",
  "Metformina",
  "Fluoxetina",
  "Clonazepam",
  "Omeprazol",
  "Sinvastatina",
  "Levotiroxina Sódica",
];
const meds = {
  "Losartana Potássica": "Losartana 50mg",
  Metformina: "Metformina 850mg",
  Fluoxetina: "Fluoxetina 20mg",
  Clonazepam: "Clonazepam 2mg",
  Omeprazol: "Omeprazol 20mg",
  Sinvastatina: "Sinvastatina 20mg",
  "Levotiroxina Sódica": "Levotiroxina 50mcg",
};
const justifications = [
  "Ajuste de Dosagem",
  "Substituição de Tratamento",
  "Reação Adversa",
];

export default function Prontuario() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const apptId = params.get("appt");
  const [p, setP] = useState(null);
  const [prescs, setPrescs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [form, setForm] = useState({
    active_substance: "",
    medication: "",
    dosage: "1 comprimido",
    frequency: "1x ao dia",
    duration_days: 30,
    route: "Oral",
    schedule: "08:00",
  });
  const [override, setOverride] = useState({ show: false, justification: "" });
  const [sigtap, setSigtap] = useState([]);
  const [pickedExams, setPickedExams] = useState([]);
  const [examQuery, setExamQuery] = useState("");
  const [prep, setPrep] = useState("");
  const [busyAdherenceId, setBusyAdherenceId] = useState(null);
  const [examType, setExamType] = useState("externo");
  const nav = useNavigate();

  const loadPatient = async () => {
    try {
      const { data } = await api.get(`/patients/${id}`);
      setP(data);
      const pr = await api.get(`/prescriptions?patient_id=${id}`);
      setPrescs(pr.data);
    } catch (e) {
      toast.error("Erro ao carregar paciente");
      setPrescs([]);
    }
  };
  const loadRefs = async () => {
    const { data } = await api.get("/refs/sigtap");
    setSigtap(data);
  };

  useEffect(() => {
    loadPatient();
    loadRefs();
  }, [id]);

  const startConsult = async () => {
    if (!apptId) return;
    try {
      const { data: appt } = await api.get(`/appointments/${apptId}`);
      if (appt.status !== "aguardando") return;
      await api.patch(`/appointments/${apptId}`, { status: "compareceu" });
      toast.success("Presença registrada");
    } catch (e) {
      const msg = e?.response?.data?.detail;
      if (msg) toast.error(msg);
    }
  };

  useEffect(() => {
    if (apptId) startConsult();
  }, [apptId]);

  const savePrescription = async () => {
    if (!form.active_substance?.trim()) {
      return toast.warning("Princípio ativo é obrigatório");
    }

    try {
      const payload = {
        patient_id: id,
        medication: form.medication,
        active_substance: form.active_substance,
        dosage: form.dosage,
        frequency: form.frequency,
        duration_days: Number(form.duration_days),
        route: form.route,
        schedule: form.schedule
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        justification: override.show ? override.justification : null,
      };
      const { data } = await api.post("/prescriptions", payload);
      toast.success(`Receita assinada · ${data.validation_code}`);
      setShowForm(false);
      setOverride({ show: false, justification: "" });
      loadPatient();
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 409) {
        setOverride({ show: true, justification: "" });
        toast.warning(formatError(detail));
      } else {
        toast.error(formatError(detail));
      }
    }
  };

  const toggleExam = (name) => {
    setPickedExams((x) =>
      x.includes(name) ? x.filter((v) => v !== name) : [...x, name],
    );
  };

  const requestExams = async () => {
    if (pickedExams.length === 0)
      return toast.warning("Selecione ao menos um exame");
    if (!examType)
      return toast.warning("Selecione se o exame é interno ou externo");
    const isExternal = examType === "externo";
    try {
      await api.post("/exams", {
        patient_id: id,
        exams: pickedExams,
        preparation_notes: prep,
        urgent: false,
        external: isExternal,
        lab_externo: isExternal ? "Externo" : null,
      });
      toast.success(`${pickedExams.length} exame(s) solicitado(s)`);
      setShowExam(false);
      setPickedExams([]);
      setPrep("");
      setExamType("");
    } catch {
      toast.error("Erro ao solicitar exames");
    }
  };

  const confirmMedicationDose = async (prescriptionId) => {
    setBusyAdherenceId(prescriptionId);
    try {
      const { data } = await api.post(
        `/prescriptions/${prescriptionId}/adherence`,
        { status: "taken", note: "Tomada confirmada no sistema" },
      );
      setPrescs((prev) =>
        prev.map((item) =>
          item.id === prescriptionId
            ? { ...item, adherence_logs: data.adherence_logs }
            : item,
        ),
      );
      toast.success("Tomada registrada");
    } catch {
      toast.error("Erro ao registrar tomada");
    } finally {
      setBusyAdherenceId(null);
    }
  };

  const getAdherenceStats = (rx) => {
    const logs = Array.isArray(rx.adherence_logs) ? rx.adherence_logs : [];
    const taken = logs.filter((entry) => entry?.status === "taken").length;
    const target = Math.max((rx.schedule?.length || 1) * 7, 1);
    return {
      taken,
      target,
      percent: Math.min(100, Math.round((taken / target) * 100)),
    };
  };

  if (!p)
    return <div className="p-8 text-slate-400">Carregando prontuário...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <button
        onClick={() => nav(-1)}
        className="text-sm text-slate-500 flex items-center gap-1 mb-4 hover:text-[#1D3557]"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="sc-card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="overline text-[#457B9D]">
              Prontuário do Paciente
            </div>
            <h1 className="font-display text-3xl font-extrabold text-[#1D3557] mt-1">
              {p.name}
            </h1>
            <div className="text-sm text-slate-500 mt-1">
              CPF {p.cpf} · Nascimento {p.birth_date} · {p.phone}
            </div>
            {p.blocked_online && (
              <div className="mt-3 inline-flex items-center gap-2 bg-[#E76F51]/10 text-[#E76F51] text-xs font-semibold px-2 py-1 rounded">
                <ShieldAlert className="w-3 h-3" /> Bloqueado para agendamento
                online ({p.missed_count} faltas)
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              data-testid="new-prescription-btn"
              onClick={() => setShowForm(true)}
              className="bg-[#1D3557] text-white px-4 py-2 rounded-md font-semibold text-sm"
            >
              <Pill className="w-4 h-4 inline mr-1" /> Nova Receita
            </button>
            <button
              data-testid="request-exam-btn"
              onClick={() => setShowExam(true)}
              className="bg-white border border-slate-200 text-[#1D3557] px-4 py-2 rounded-md font-semibold text-sm"
            >
              <FlaskConical className="w-4 h-4 inline mr-1" /> Solicitar Exames
            </button>
          </div>
        </div>
      </div>

      {/* LGPD gate */}
      {p.history_hidden ? (
        <div className="sc-card border-dashed">
          <div className="flex items-center gap-3 text-slate-600">
            <Lock className="w-5 h-5" />
            <div>
              <div className="font-semibold text-[#1D3557]">
                Histórico protegido pela LGPD
              </div>
              <div className="text-sm">
                O paciente não aceitou os Termos de Uso. O histórico clínico
                completo está oculto.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="sc-card">
          <h2 className="font-display font-bold text-lg text-[#1D3557] mb-4">
            Medicamentos em uso
          </h2>
          <div className="space-y-3">
            {prescs
              .filter((x) => x.active)
              .map((r) => {
                const stats = getAdherenceStats(r);
                return (
                  <div
                    key={r.id}
                    className="border border-slate-200 rounded-lg p-4 flex justify-between items-start gap-4"
                  >
                    <div>
                      <div className="font-semibold text-[#1D3557]">
                        {r.medication}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.active_substance} · {r.dosage} · {r.frequency}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Prescrito por {r.doctor_name} · {r.validation_code}
                      </div>
                    </div>
                    <div className="text-right flex flex-col gap-2">
                      <div>
                        <div className="text-xs overline">
                          Adesão (últimos 7 dias)
                        </div>
                        <div className="font-mono-nums font-bold text-[#1E4620]">
                          <CheckCircle2 className="w-4 h-4 inline mr-1" />
                          {stats.taken} / {stats.target}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {stats.percent}% confirmada
                        </div>
                      </div>
                      <button
                        onClick={() => confirmMedicationDose(r.id)}
                        disabled={busyAdherenceId === r.id}
                        className="text-xs px-3 py-1.5 rounded-md bg-[#1D3557] text-white font-semibold hover:bg-[#152742] disabled:opacity-50"
                      >
                        {busyAdherenceId === r.id
                          ? "Salvando..."
                          : "Registrar tomada"}
                      </button>
                    </div>
                  </div>
                );
              })}
            {prescs.filter((x) => x.active).length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">
                Nenhum medicamento ativo.
              </div>
            )}
          </div>

          <h2 className="font-display font-bold text-lg text-[#1D3557] mt-6 mb-3">
            Histórico de medicamentos
          </h2>
          <div className="space-y-2">
            {prescs
              .filter((x) => !x.active)
              .slice(0, 6)
              .map((r) => (
                <div
                  key={r.id}
                  className="text-sm border-l-2 border-slate-200 pl-3 py-1"
                >
                  <span className="font-semibold text-slate-700">
                    {r.medication}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    — encerrado ({(r.created_at || "").slice(0, 10)})
                  </span>
                </div>
              ))}
            {prescs.filter((x) => !x.active).length === 0 && (
              <div className="text-sm text-slate-400">
                Nenhum medicamento encerrado.
              </div>
            )}
          </div>

          <h2 className="font-display font-bold text-lg text-[#1D3557] mt-6 mb-3">
            Histórico de consultas
          </h2>
          <div className="space-y-2">
            {(p.appointments_history || []).slice(0, 8).map((appt) => (
              <div
                key={appt.id}
                className="text-sm border-l-2 border-slate-200 pl-3 py-1"
              >
                <span className="font-semibold text-slate-700">
                  {new Date(appt.scheduled_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="text-slate-500">
                  {" "}
                  — {appt.specialty} · {appt.status} · {appt.doctor_name}
                </span>
              </div>
            ))}
            {(p.appointments_history || []).length === 0 && (
              <div className="text-sm text-slate-400">
                Nenhuma consulta registrada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Prescription Modal */}
      {showForm && (
        <Modal
          onClose={() => {
            setShowForm(false);
            setOverride({ show: false, justification: "" });
          }}
          title="Nova Receita Digital"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome comercial do medicamento">
              <input
                data-testid="rx-medication"
                value={form.medication}
                onChange={(e) =>
                  setForm({ ...form, medication: e.target.value })
                }
                className="inp"
                placeholder="Digite o nome comercial (opcional)"
              />
            </Field>
            <Field label="Princípio ativo *">
              <input
                data-testid="rx-active-substance"
                value={form.active_substance}
                onChange={(e) =>
                  setForm({ ...form, active_substance: e.target.value })
                }
                className="inp"
                placeholder="Digite o princípio ativo"
              />
            </Field>
            <Field label="Dosagem">
              <input
                data-testid="rx-dosage"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                className="inp"
              />
            </Field>
            <Field label="Frequência">
              <input
                data-testid="rx-frequency"
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value })
                }
                className="inp"
              />
            </Field>
            <Field label="Duração (dias)">
              <input
                data-testid="rx-duration"
                type="number"
                value={form.duration_days}
                onChange={(e) =>
                  setForm({ ...form, duration_days: e.target.value })
                }
                className="inp"
              />
            </Field>
            <Field label="Via">
              <input
                value={form.route}
                onChange={(e) => setForm({ ...form, route: e.target.value })}
                className="inp"
              />
            </Field>
            <Field label="Horários (separados por vírgula)">
              <input
                data-testid="rx-schedule"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                className="inp"
              />
            </Field>
          </div>
          {override.show && (
            <div className="mt-4 border border-[#E76F51]/30 bg-[#E76F51]/5 rounded-md p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#E76F51] mb-2">
                <ShieldAlert className="w-4 h-4" /> Trava de segurança acionada
              </div>
              <div className="text-xs text-slate-600 mb-2">
                Já existe receita ativa. Selecione uma justificativa para
                sobrescrever:
              </div>
              <select
                data-testid="rx-justification"
                value={override.justification}
                onChange={(e) =>
                  setOverride({ ...override, justification: e.target.value })
                }
                className="inp"
              >
                <option value="">— Selecionar justificativa —</option>
                {justifications.map((j) => (
                  <option key={j}>{j}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowForm(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              data-testid="rx-submit-btn"
              onClick={savePrescription}
              disabled={override.show && !override.justification}
              className="btn-primary disabled:opacity-50"
            >
              Assinar com Gov.br
            </button>
          </div>
        </Modal>
      )}

      {/* Exam Request Modal */}
      {showExam && (
        <Modal
          onClose={() => setShowExam(false)}
          title="Solicitar Exames (SIGTAP)"
        >
          <div>
            <Field label="Buscar exame (código ou descrição)">
              <div className="relative">
                <input
                  data-testid="exam-search"
                  value={examQuery}
                  onChange={(ev) => setExamQuery(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      const q = String(examQuery || "")
                        .trim()
                        .toLowerCase();
                      const first = q
                        ? sigtap.find(
                            (e) =>
                              e.code.toLowerCase().includes(q) ||
                              e.desc.toLowerCase().includes(q),
                          )
                        : sigtap[0];
                      if (first) toggleExam(first.desc);
                    }
                  }}
                  placeholder="Digite código ou parte da descrição"
                  className="inp"
                />
                {examQuery && (
                  <button
                    onClick={() => setExamQuery("")}
                    className="absolute right-2 top-2 text-slate-400"
                    aria-label="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>
            </Field>

            <div className="max-h-48 overflow-y-auto mt-2 border border-slate-200 rounded-md p-2">
              {(() => {
                const q = String(examQuery || "")
                  .trim()
                  .toLowerCase();
                const sigtapFiltered = q
                  ? sigtap.filter(
                      (e) =>
                        e.code.toLowerCase().includes(q) ||
                        e.desc.toLowerCase().includes(q),
                    )
                  : sigtap.slice(0, 30);
                return sigtapFiltered.length ? (
                  sigtapFiltered.map((e) => (
                    <label
                      key={e.code}
                      className="flex items-center gap-2 text-sm py-1.5 px-2 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <input
                        data-testid={`exam-suggestion-${e.code}`}
                        type="checkbox"
                        checked={pickedExams.includes(e.desc)}
                        onChange={() => toggleExam(e.desc)}
                      />
                      <span className="font-mono-nums text-xs text-slate-500 w-32">
                        {e.code}
                      </span>
                      <span className="text-slate-700">{e.desc}</span>
                    </label>
                  ))
                ) : (
                  <div className="text-sm text-slate-400">
                    Nenhum exame encontrado
                  </div>
                );
              })()}
            </div>

            {pickedExams.length > 0 && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                  Exames selecionados
                </label>
                <div className="space-y-1">
                  {pickedExams.map((name, idx) => (
                    <div
                      key={`${name}-${idx}`}
                      data-testid={`exam-picked-${idx}`}
                      className="flex items-center justify-between bg-slate-50 p-2 rounded"
                    >
                      <div className="text-sm text-slate-700">{name}</div>
                      <button
                        onClick={() => toggleExam(name)}
                        className="text-red-500 text-sm"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <textarea
            placeholder="Recomendações de preparo (ex: jejum de 12h)"
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
            className="w-full mt-3 p-2 border border-slate-200 rounded-md text-sm"
            rows={2}
          />
          <div className="mt-3">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
              Tipo de exame
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="inp"
            >
              <option value="externo">Externo</option>
              <option value="interno">Interno</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowExam(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              data-testid="exam-submit-btn"
              onClick={requestExams}
              className="btn-primary"
            >
              Solicitar {pickedExams.length} exame(s)
            </button>
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

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-extrabold text-xl text-[#1D3557] mb-4">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
