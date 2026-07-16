import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Calendar,
  Users,
  Search,
  Plus,
  Lock,
  LockOpen,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SPECIALTIES } from "@/lib/specialties";

function toLocalDateKey(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AtendenteDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sortOrder, setSortOrder] = useState("asc");
  const [patients, setPatients] = useState([]);
  const [appts, setAppts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [q, setQ] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [showApptForm, setShowApptForm] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [selectedDoctorForLock, setSelectedDoctorForLock] = useState(null);
  const [lockingInProgress, setLockingInProgress] = useState(false);
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const [showSpecialtyOptions, setShowSpecialtyOptions] = useState(false);
  const [ap, setAp] = useState({
    patient_id: "",
    specialty: "Clínica Geral",
    scheduled_at: "",
    priority: "normal",
    unit: "UBS Central",
  });
  const [np, setNp] = useState({
    name: "",
    cpf: "",
    birth_date: "2000-01-01",
    phone: "",
    address: "",
    lgpd_accepted: true,
  });
  const [filterName, setFilterName] = useState("");
  const [filterStartTime, setFilterStartTime] = useState("");
  const [filterEndTime, setFilterEndTime] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const load = async () => {
    const p = await api.get(`/patients?q=${encodeURIComponent(q)}`);
    setPatients(p.data);
    const today = toLocalDateKey(new Date());
    const a = await api.get(`/appointments?date=${today}`);
    setAppts(a.data);

    // Carregar médicos da unidade do atendente
    if (user?.unit) {
      const docsRes = await api.get("/users?role=medico");
      const doctorsInUnit = docsRes.data.filter((d) => d.unit === user.unit);
      setDoctors(doctorsInUnit);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]);

  const selectedPatient = patients.find((p) => p.id === ap.patient_id);
  const patientSuggestions = patients
    .filter((p) => !p.blocked_online)
    .filter((p) => {
      const query = patientQuery.trim().toLowerCase();
      if (!query) return false;
      return p.name.toLowerCase().includes(query) || p.cpf.includes(query);
    })
    .slice(0, 6);

  const openApptForm = () => {
    setPatientQuery("");
    const availableSpecialties = [...new Set(doctors.map((d) => d.specialty).filter(Boolean))];
    setAp({
      ...ap,
      patient_id: "",
      unit: user?.unit || ap.unit,
      specialty: availableSpecialties.includes(ap.specialty)
        ? ap.specialty
        : availableSpecialties[0] || ap.specialty,
    });
    setSpecialtyQuery("");
    setShowSpecialtyOptions(false);
    setShowApptForm(true);
  };

  // Consultas do atendente são sempre presenciais — sem verificação de vagas online.

  const createAppt = async () => {
    try {
      const iso = new Date(ap.scheduled_at).toISOString();
      await api.post("/appointments", {
        ...ap,
        unit: user?.unit || ap.unit,
        scheduled_at: iso,
        modality: "presencial",
      });
      toast.success("Consulta agendada");
      setShowApptForm(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao agendar");
    }
  };

  const createPatient = async () => {
    try {
      await api.post("/patients", np);
      toast.success("Paciente cadastrado");
      setShowPatientForm(false);
      load();
      setNp({
        name: "",
        cpf: "",
        birth_date: "2000-01-01",
        phone: "",
        address: "",
        lgpd_accepted: true,
      });
    } catch (e) {
      toast.error("Erro ao cadastrar");
    }
  };

  const handleLockDoctor = (doctor) => {
    setSelectedDoctorForLock(doctor);
    setShowLockModal(true);
  };

  const handleUnlockDoctor = async (lockId) => {
    if (
      !confirm(
        "Desbloquear agenda? Consultas já canceladas não retornarão automaticamente.",
      )
    ) {
      return;
    }
    setLockingInProgress(true);
    try {
      await api.post(`/secretario/agenda/${lockId}/unlock`, {});
      toast.success("Agenda desbloqueada");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao desbloquear");
    } finally {
      setLockingInProgress(false);
    }
  };

  const confirmLockDoctor = async (reason, date) => {
    if (!reason.trim()) {
      toast.error("Informe o motivo do bloqueio");
      return;
    }
    if (!date) {
      toast.error("Selecione a data do bloqueio");
      return;
    }
    setLockingInProgress(true);
    try {
      await api.post("/secretario/agenda/lock", {
        doctor_id: selectedDoctorForLock.id,
        date,
        reason: reason.trim(),
      });
      const today = toLocalDateKey(new Date());
      toast.success(
        date === today
          ? "Agenda bloqueada agora e pacientes notificados"
          : `Bloqueio agendado para ${date.split("-").reverse().join("/")}`
      );
      setShowLockModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao bloquear");
    } finally {
      setLockingInProgress(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Recepção · Balcão</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
            Atendimento Presencial
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="new-appt-btn"
            onClick={openApptForm}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Agendar Consulta
          </button>
          <button
            data-testid="new-patient-btn"
            onClick={() => setShowPatientForm(true)}
            className="btn-secondary"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Novo Paciente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Pacientes na base" value={patients.length} icon={Users} />
        <Stat
          label="Consultas hoje"
          value={appts.length}
          icon={Calendar}
          accent="#457B9D"
        />
        <Stat
          label="Aguardando"
          value={appts.filter((a) => a.status === "aguardando").length}
          accent="#E9C46A"
        />
        <Stat
          label="Bloqueados por falta"
          value={patients.filter((p) => p.blocked_online).length}
          accent="#E76F51"
        />
      </div>

        {/* Bloquear/Desbloquear Agenda do Médico — em destaque no topo; lista com scroll interno para não empurrar o resto da página */}
        <div className="sc-card mb-6">
          <h2 className="font-display font-bold text-lg text-[#1D3557] mb-4">
            ⚠️ Gerenciar Bloqueio de Agenda
          </h2>
          {doctors.length === 0 ? (
            <div className="text-sm text-slate-400 py-4">
              Nenhum médico cadastrado em sua unidade.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {doctors.map((doctor) => {
                const todayStr = toLocalDateKey(new Date());
                const activeLocksToday = (doctor.doctorLocks || []).filter(
                  (lock) =>
                    lock.active && toLocalDateKey(lock.date) === todayStr,
                );
                const hasActiveLock = activeLocksToday.length > 0;
                const activeLock = activeLocksToday[0];
                const upcomingLocks = (doctor.doctorLocks || [])
                  .filter(
                    (lock) =>
                      lock.active && toLocalDateKey(lock.date) > todayStr,
                  )
                  .sort((a, b) => new Date(a.date) - new Date(b.date));

                return (
                  <div
                    key={doctor.id}
                    className={`flex justify-between items-center p-3 rounded-md border ${
                      hasActiveLock
                        ? "border-[#E76F51] bg-[#E76F51]/5"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-[#1D3557]">
                        {doctor.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doctor.specialty}
                      </div>
                      {hasActiveLock && activeLock && (
                        <div className="text-xs text-[#E76F51] mt-1 font-semibold">
                          🔒 Bloqueado hoje: {activeLock.reason}
                        </div>
                      )}
                      {upcomingLocks.map((lock) => (
                        <div
                          key={lock.id}
                          className="text-xs text-[#457B9D] mt-1 font-semibold flex items-center gap-2"
                        >
                          <span>
                            📅 Bloqueio agendado para{" "}
                            {new Date(lock.date).toLocaleDateString("pt-BR")}:{" "}
                            {lock.reason}
                          </span>
                          <button
                            onClick={() => handleUnlockDoctor(lock.id)}
                            disabled={lockingInProgress}
                            className="text-[#457B9D] underline hover:no-underline disabled:opacity-50"
                          >
                            Cancelar bloqueio
                          </button>
                        </div>
                      ))}
                    </div>
                    {!hasActiveLock ? (
                      <button
                        onClick={() => handleLockDoctor(doctor)}
                        disabled={lockingInProgress}
                        className="px-3 py-1 bg-[#E76F51] text-white rounded text-xs font-semibold hover:bg-[#E76F51]/90 disabled:opacity-50 transition"
                      >
                        <Lock className="w-3 h-3 inline mr-1" /> Bloquear
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnlockDoctor(activeLock.id)}
                        disabled={lockingInProgress}
                        className="px-3 py-1 bg-[#457B9D] text-white rounded text-xs font-semibold hover:bg-[#457B9D]/90 disabled:opacity-50 transition"
                      >
                        <LockOpen className="w-3 h-3 inline mr-1" /> Desbloquear
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700">
            <strong>💡 Dica:</strong> Use este gerenciador quando o médico
            avisar de um imprevisto. A agenda será bloqueada imediatamente e os
            pacientes serão notificados.
          </div>
        </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Patient search */}
        <div className="sc-card">
          <h2 className="font-display font-bold text-lg text-[#1D3557] mb-3">
            Buscar Paciente
          </h2>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              data-testid="patient-Fsearch"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome ou CPF..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {patients.slice(0, 30).map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center border-b border-slate-100 py-2 text-sm"
                data-testid={`patient-${p.id}`}
              >
                <div>
                  <div className="font-semibold text-[#1D3557]">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.cpf} · {p.phone}
                  </div>
                </div>
                {p.blocked_online && (
                  <span className="text-[10px] bg-[#E76F51]/10 text-[#E76F51] px-2 py-1 rounded font-bold">
                    BLOQUEADO
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="sc-card">
          <div className="mb-4 border-b border-slate-100 pb-3">
            {/* Alinha o título e o botão de ordenação lado a lado no topo */}
            <div className="flex justify-between items-center w-full">
              <h2 className="font-display font-bold text-lg text-[#1D3557] m-0">
                Agenda de Hoje
              </h2>

              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="text-xs bg-slate-100 hover:bg-slate-200 text-[#1D3557] px-2.5 py-1 rounded-md font-semibold transition"
              >
                Horário {sortOrder === "asc" ? "ASC ▲" : "DESC ▼"}
              </button>
            </div>

            {/* Filtros fixos na tela (aparecem a todo momento) */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <input
                type="text"
                placeholder="Filtrar paciente..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="p-2 border border-slate-200 rounded-md col-span-2"
              />
              <div className="flex items-center gap-1">
                <span className="text-slate-400">De:</span>
                <input
                  type="time"
                  value={filterStartTime}
                  onChange={(e) => setFilterStartTime(e.target.value)}
                  className="p-1.5 border border-slate-200 rounded-md w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">Até:</span>
                <input
                  type="time"
                  value={filterEndTime}
                  onChange={(e) => setFilterEndTime(e.target.value)}
                  className="p-1.5 border border-slate-200 rounded-md w-full"
                />
              </div>
            </div>
          </div>

          {/* Lista com a Lógica de Filtro e Ordenação Dinâmica */}
          <div className="max-h-[260px] overflow-y-auto space-y-2">
            {(() => {
              // 1. Aplica os filtros de nome e horário nos dados da API
              const filteredAppts = appts.filter((a) => {
                const matchesName =
                  !filterName ||
                  a.patient?.name
                    ?.toLowerCase()
                    .includes(filterName.toLowerCase());

                const apptTime = a.scheduled_at?.slice(11, 16); // Recorta "HH:MM" da string ISO
                const matchesStart =
                  !filterStartTime || apptTime >= filterStartTime;
                const matchesEnd = !filterEndTime || apptTime <= filterEndTime;

                return matchesName && matchesStart && matchesEnd;
              });

              // 2. Ordena os resultados filtrados baseando-se no botão (Crescente ou Decrescente)
              const sortedAppts = [...filteredAppts].sort((a, b) => {
                const timeA = a.scheduled_at?.slice(11, 16) || "";
                const timeB = b.scheduled_at?.slice(11, 16) || "";
                return sortOrder === "asc"
                  ? timeA.localeCompare(timeB)
                  : timeB.localeCompare(timeA);
              });

              if (sortedAppts.length === 0) {
                return (
                  <div className="text-sm text-slate-400 py-8 text-center">
                    Nenhuma consulta encontrada.
                  </div>
                );
              }

              // 3. Renderiza os cards ordenados
              return sortedAppts.map((a) => (
                <div
                  key={a.id}
                  onClick={() =>
                    navigate(`/medico/paciente/${a.patient_id}`)
                  }
                  className="flex justify-between items-center border border-slate-100 rounded-md p-3 text-sm hover:border-[#457B9D] hover:bg-slate-50 cursor-pointer transition"
                >
                  <div>
                    <div className="font-semibold text-[#1D3557]">
                      {a.patient?.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {a.specialty} · {a.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-nums font-bold text-[#1D3557]">
                      {a.scheduled_at?.slice(11, 16)}
                    </div>
                    <div className="text-xs capitalize text-slate-500">
                      {a.status}
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
<<<<<<< HEAD
=======

        {/* Bloquear/Desbloquear Agenda do Médico */}
        <div className="sc-card">
          <h2 className="font-display font-bold text-lg text-[#1D3557] mb-4">
            Gerenciar Bloqueio de Agenda
          </h2>
          {doctors.length === 0 ? (
            <div className="text-sm text-slate-400 py-4">
              Nenhum médico cadastrado em sua unidade.
            </div>
          ) : (
            <div className="space-y-2">
              {doctors.map((doctor) => {
                const todayStr = toLocalDateKey(new Date());
                const activeLocksToday = (doctor.doctorLocks || []).filter(
                  (lock) =>
                    lock.active && toLocalDateKey(lock.date) === todayStr,
                );
                const hasActiveLock = activeLocksToday.length > 0;
                const activeLock = activeLocksToday[0];
                const upcomingLocks = (doctor.doctorLocks || [])
                  .filter(
                    (lock) =>
                      lock.active && toLocalDateKey(lock.date) > todayStr,
                  )
                  .sort((a, b) => new Date(a.date) - new Date(b.date));

                return (
                  <div
                    key={doctor.id}
                    className={`flex justify-between items-center p-3 rounded-md border ${
                      hasActiveLock
                        ? "border-[#E76F51] bg-[#E76F51]/5"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-[#1D3557]">
                        {doctor.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doctor.specialty}
                      </div>
                      {hasActiveLock && activeLock && (
                        <div className="text-xs text-[#E76F51] mt-1 font-semibold">
                           Bloqueado hoje: {activeLock.reason}
                        </div>
                      )}
                      {upcomingLocks.map((lock) => (
                        <div
                          key={lock.id}
                          className="text-xs text-[#457B9D] mt-1 font-semibold flex items-center gap-2"
                        >
                          <span>
                            Bloqueio agendado para{" "}
                            {new Date(lock.date).toLocaleDateString("pt-BR")}:{" "}
                            {lock.reason}
                          </span>
                          <button
                            onClick={() => handleUnlockDoctor(lock.id)}
                            disabled={lockingInProgress}
                            className="text-[#457B9D] underline hover:no-underline disabled:opacity-50"
                          >
                            Cancelar bloqueio
                          </button>
                        </div>
                      ))}
                    </div>
                    {!hasActiveLock ? (
                      <button
                        onClick={() => handleLockDoctor(doctor)}
                        disabled={lockingInProgress}
                        className="px-3 py-1 bg-[#E76F51] text-white rounded text-xs font-semibold hover:bg-[#E76F51]/90 disabled:opacity-50 transition"
                      >
                        <Lock className="w-3 h-3 inline mr-1" /> Bloquear
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnlockDoctor(activeLock.id)}
                        disabled={lockingInProgress}
                        className="px-3 py-1 bg-[#457B9D] text-white rounded text-xs font-semibold hover:bg-[#457B9D]/90 disabled:opacity-50 transition"
                      >
                        <LockOpen className="w-3 h-3 inline mr-1" /> Desbloquear
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700">
            <strong>Dica:</strong> Use este gerenciador quando o médico
            avisar de um imprevisto. A agenda será bloqueada imediatamente e os
            pacientes serão notificados.
          </div>
        </div>
>>>>>>> 906788726c94b21a74b7df8fe99cb088e2b40c52
      </div>

      {showApptForm && (
        <Modal
          title="Agendar Consulta Presencial"
          onClose={() => setShowApptForm(false)}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buscar paciente">
              <input
                data-testid="ap-patient-search"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Nome ou CPF"
                className="inp"
              />
              {patientQuery.trim() && (
                <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white">
                  {patientSuggestions.length > 0 ? (
                    patientSuggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setAp({ ...ap, patient_id: p.id });
                          setPatientQuery(p.name);
                        }}
                        className="w-full text-left px-3 py-2 border-b last:border-b-0 text-sm hover:bg-slate-50"
                      >
                        <div className="font-medium text-slate-800">
                          {p.name}
                        </div>
                        <div className="text-xs text-slate-500">{p.cpf}</div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      Nenhum paciente encontrado.
                    </div>
                  )}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                  <div className="font-semibold text-slate-800">
                    {selectedPatient.name}
                  </div>
                  <div className="text-slate-500">
                    {selectedPatient.cpf} · {selectedPatient.phone}
                  </div>
                </div>
              )}
            </Field>
            <div className="col-span-2 text-sm text-slate-500">
              O sistema escolherá automaticamente o médico com menos consultas
              naquele dia, dentro da sua unidade ({user?.unit || "—"}).
            </div>
            <Field label="Especialidade">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  data-testid="ap-specialty"
                  value={ap.specialty ? ap.specialty : specialtyQuery}
                  onChange={(e) => {
                    setSpecialtyQuery(e.target.value);
                    setAp({ ...ap, specialty: "" });
                    setShowSpecialtyOptions(true);
                  }}
                  onFocus={() => {
                    if (ap.specialty) { setSpecialtyQuery(ap.specialty); setAp({ ...ap, specialty: "" }); }
                    setShowSpecialtyOptions(true);
                  }}
                  placeholder="Buscar especialidade..."
                  className="inp pl-9"
                  autoComplete="off"
                />
                {showSpecialtyOptions && (() => {
                  const availableSpecialties = [...new Set(doctors.map((d) => d.specialty).filter(Boolean))];
                  const source = availableSpecialties.length > 0 ? availableSpecialties : SPECIALTIES;
                  const filtered = source.filter((s) =>
                    s.toLowerCase().includes(specialtyQuery.trim().toLowerCase())
                  );
                  return (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                      {filtered.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            setAp({ ...ap, specialty: s });
                            setSpecialtyQuery("");
                            setShowSpecialtyOptions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          {s}
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-400">
                          Nenhuma especialidade encontrada.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </Field>
            <Field label="Data e hora">
              <input
                data-testid="ap-datetime"
                type="datetime-local"
                value={ap.scheduled_at}
                onChange={(e) => setAp({ ...ap, scheduled_at: e.target.value })}
                className="inp"
              />
            </Field>
            <Field label="Prioridade">
              <select
                value={ap.priority}
                onChange={(e) => setAp({ ...ap, priority: e.target.value })}
                className="inp"
              >
                <option value="normal">Normal</option>
                <option value="preferencial">Preferencial</option>
                <option value="urgente">Urgente</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowApptForm(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              data-testid="ap-submit"
              onClick={createAppt}
              disabled={!ap.patient_id || !ap.scheduled_at || !ap.specialty}
              className="btn-primary disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}

      {showPatientForm && (
        <Modal title="Novo Paciente" onClose={() => setShowPatientForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome completo">
              <input
                data-testid="np-name"
                value={np.name}
                onChange={(e) => setNp({ ...np, name: e.target.value })}
                className="inp"
              />
            </Field>
            <Field label="CPF">
              <input
                data-testid="np-cpf"
                value={np.cpf}
                onChange={(e) => setNp({ ...np, cpf: e.target.value })}
                className="inp"
              />
            </Field>
            <Field label="Nascimento">
              <input
                type="date"
                value={np.birth_date}
                onChange={(e) => setNp({ ...np, birth_date: e.target.value })}
                className="inp"
              />
            </Field>
            <Field label="Telefone">
              <input
                value={np.phone}
                onChange={(e) => setNp({ ...np, phone: e.target.value })}
                className="inp"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Endereço">
                <input
                  value={np.address}
                  onChange={(e) => setNp({ ...np, address: e.target.value })}
                  className="inp"
                />
              </Field>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={np.lgpd_accepted}
                onChange={(e) =>
                  setNp({ ...np, lgpd_accepted: e.target.checked })
                }
              />
              Paciente aceitou os Termos de Uso (LGPD)
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowPatientForm(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              data-testid="np-submit"
              onClick={createPatient}
              disabled={!np.name || !np.cpf}
              className="btn-primary disabled:opacity-50"
            >
              Cadastrar
            </button>
          </div>
        </Modal>
      )}

      {showLockModal && selectedDoctorForLock && (
        <LockDoctorModal
          doctor={selectedDoctorForLock}
          onClose={() => setShowLockModal(false)}
          onConfirm={confirmLockDoctor}
          isLoading={lockingInProgress}
        />
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
      <div
        className="font-display text-3xl font-extrabold mt-2"
        style={{ color: accent }}
      >
        {value}
      </div>
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

function LockDoctorModal({ doctor, onClose, onConfirm, isLoading }) {
  const todayStr = toLocalDateKey(new Date());
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState("hoje"); // "hoje" | "agendar"
  const [date, setDate] = useState(todayStr);

  const handleConfirm = () => {
    onConfirm(reason, when === "hoje" ? todayStr : date);
    setReason("");
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#E76F51]" />
          <h3 className="font-display font-extrabold text-lg text-[#1D3557]">
            Bloquear Agenda
          </h3>
        </div>

        <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
          <div className="text-sm font-semibold text-[#1D3557]">
            {doctor.name}
          </div>
          <div className="text-xs text-slate-600">{doctor.specialty}</div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Quando bloquear?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWhen("hoje")}
              className={`px-3 py-2 rounded-md text-sm font-semibold border transition ${
                when === "hoje"
                  ? "bg-[#E76F51] text-white border-[#E76F51]"
                  : "bg-white text-slate-700 border-slate-200 hover:border-[#E76F51]"
              }`}
            >
              Bloquear agora (hoje)
            </button>
            <button
              type="button"
              onClick={() => setWhen("agendar")}
              className={`px-3 py-2 rounded-md text-sm font-semibold border transition ${
                when === "agendar"
                  ? "bg-[#457B9D] text-white border-[#457B9D]"
                  : "bg-white text-slate-700 border-slate-200 hover:border-[#457B9D]"
              }`}
            >
              Agendar para outro dia
            </button>
          </div>
          {when === "agendar" && (
            <input
              type="date"
              value={date}
              min={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 w-full p-2 border border-slate-200 rounded text-sm"
            />
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Motivo do Imprevisto
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Cirurgia de emergência, Consulta urgente, etc."
            className="w-full p-2 border border-slate-200 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#457B9D]"
            rows={3}
          />
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700 mb-4">
          <strong>O que vai acontecer:</strong>
          <ul className="mt-2 space-y-1 ml-3">
            <li>
              ✓ {when === "hoje"
                ? "Consultas restantes de hoje serão canceladas"
                : "Todas as consultas do dia escolhido serão canceladas"}
            </li>
            <li>✓ Os pacientes serão notificados (simulada)</li>
            <li>✓ A ação será registrada na auditoria</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || (when === "agendar" && !date) || isLoading}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#E76F51] hover:bg-[#E76F51]/90 rounded disabled:opacity-50 transition flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {isLoading ? "Processando..." : when === "hoje" ? "Bloquear Agora" : "Agendar Bloqueio"}
          </button>
        </div>
      </div>
    </div>
  );
}