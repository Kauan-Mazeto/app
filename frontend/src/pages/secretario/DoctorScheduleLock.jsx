import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Clock, Lock, LockOpen, AlertTriangle } from "lucide-react";

export default function DoctorScheduleLock() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  const loadDoctorStatus = async (date) => {
    setLoading(true);
    try {
      const res = await api.get("/secretario/agenda/status", {
        params: { date },
      });
      setDoctors(res.data.doctors || []);
    } catch (err) {
      console.error("Erro ao carregar status de médicos:", err);
      alert("Erro ao carregar dados dos médicos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorStatus(selectedDate);
  }, [selectedDate]);

  const handleLockClick = (doctorId, doctorName) => {
    const reason = prompt(
      `Motivo do bloqueio para ${doctorName}:\n\n(ex: Cirurgia de emergência, Consulta urgente, etc.)`,
    );
    if (!reason) return;

    setActionInProgress(doctorId);
    api
      .post("/secretario/agenda/lock", {
        doctor_id: doctorId,
        date: selectedDate,
        reason: reason.trim(),
      })
      .then((res) => {
        alert(`✓ Agenda bloqueada!\n\n${res.data.message}`);
        loadDoctorStatus(selectedDate);
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || "Erro ao bloquear agenda";
        alert(`✗ Erro: ${detail}`);
      })
      .finally(() => {
        setActionInProgress(null);
      });
  };

  const handleUnlockClick = (lockId, doctorName) => {
    if (
      !confirm(
        `Desbloquear agenda de ${doctorName}?\n\nLembre-se: consultas já canceladas não retornarão automaticamente.`,
      )
    ) {
      return;
    }

    setActionInProgress(lockId);
    api
      .post(`/secretario/agenda/${lockId}/unlock`, {})
      .then((res) => {
        alert(`✓ Agenda desbloqueada!\n\n${res.data.note}`);
        loadDoctorStatus(selectedDate);
      })
      .catch((err) => {
        const detail =
          err.response?.data?.detail || "Erro ao desbloquear agenda";
        alert(`✗ Erro: ${detail}`);
      })
      .finally(() => {
        setActionInProgress(null);
      });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="overline text-[#457B9D]">Gestão de Agenda</div>
        <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
          Bloqueio de Agenda · Imprevisto de Médico
        </h1>
        <p className="text-slate-500 mt-2">
          Bloqueie a agenda de um médico temporariamente em caso de imprevisto.
          Pacientes serão automaticamente notificados.
        </p>
      </div>

      {/* Date selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-[#1D3557] mb-2">
          Selecionar Data
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-[#1D3557] font-medium"
        />
      </div>

      {/* Doctors list */}
      {loading && (
        <div className="text-center py-8 text-slate-400">
          Carregando status dos médicos...
        </div>
      )}

      {!loading && doctors.length === 0 && (
        <div className="sc-card text-center py-8 text-slate-400">
          Nenhum médico encontrado para este dia.
        </div>
      )}

      <div className="space-y-4">
        {doctors.map((doctor) => (
          <div key={doctor.doctor_id} className="sc-card">
            <div className="flex justify-between items-start">
              <div>
                {/* Doctor info */}
                <div className="flex items-center gap-3 mb-3">
                  {doctor.has_active_lock && (
                    <Lock className="w-5 h-5 text-[#E76F51]" />
                  )}
                  <div>
                    <h3 className="font-display font-bold text-lg text-[#1D3557]">
                      {doctor.doctor_name}
                    </h3>
                    <div className="text-sm text-slate-600">
                      {doctor.specialty} · {doctor.unit}
                    </div>
                  </div>
                </div>

                {/* Lock status */}
                {doctor.has_active_lock && doctor.lock && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 text-[#E76F51] mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <div className="font-semibold text-[#E76F51]">
                          Agenda Bloqueada
                        </div>
                        <div className="text-slate-700">
                          <strong>Motivo:</strong> {doctor.lock.reason}
                        </div>
                        <div className="text-slate-600 text-xs mt-1">
                          Bloqueado em:{" "}
                          {new Date(doctor.lock.locked_at).toLocaleString(
                            "pt-BR",
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Appointment statistics */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-slate-600 uppercase font-semibold">
                      Total
                    </div>
                    <div className="text-xl font-bold text-[#1D3557]">
                      {doctor.appointments_total}
                    </div>
                  </div>
                  {doctor.appointments_cancelled_by_lock > 0 && (
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <div className="text-xs text-[#E76F51] uppercase font-semibold">
                        Canceladas
                      </div>
                      <div className="text-xl font-bold text-[#E76F51]">
                        {doctor.appointments_cancelled_by_lock}
                      </div>
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-lg text-center ${
                      doctor.appointments_normal > 0
                        ? "bg-green-50"
                        : "bg-slate-50"
                    }`}
                  >
                    <div
                      className={`text-xs uppercase font-semibold ${
                        doctor.appointments_normal > 0
                          ? "text-green-700"
                          : "text-slate-600"
                      }`}
                    >
                      Confirmadas
                    </div>
                    <div
                      className={`text-xl font-bold ${
                        doctor.appointments_normal > 0
                          ? "text-green-700"
                          : "text-[#1D3557]"
                      }`}
                    >
                      {doctor.appointments_normal}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 shrink-0">
                {!doctor.has_active_lock ? (
                  <button
                    onClick={() =>
                      handleLockClick(doctor.doctor_id, doctor.doctor_name)
                    }
                    disabled={actionInProgress !== null}
                    className="px-4 py-2 bg-[#E76F51] text-white rounded-lg font-semibold hover:bg-[#E76F51]/90 disabled:opacity-50 transition flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Bloquear
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleUnlockClick(doctor.lock.id, doctor.doctor_name)
                    }
                    disabled={actionInProgress !== null}
                    className="px-4 py-2 bg-[#457B9D] text-white rounded-lg font-semibold hover:bg-[#457B9D]/90 disabled:opacity-50 transition flex items-center gap-2"
                  >
                    <LockOpen className="w-4 h-4" />
                    Desbloquear
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      {!loading && doctors.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-700">
          <strong>ℹ️ Como funciona:</strong>
          <ul className="mt-2 space-y-1 ml-4">
            <li>
              • Quando você bloqueia uma agenda, todas as consultas agendadas a
              partir desse momento são{" "}
              <strong>automaticamente canceladas</strong>.
            </li>
            <li>
              • Os pacientes recebem uma <strong>notificação simulada</strong>{" "}
              (registrada no sistema) informando o motivo do cancelamento.
            </li>
            <li>
              • Quando o médico retorna e você desbloqueia a agenda,{" "}
              <strong>
                as consultas já canceladas não voltam automaticamente
              </strong>
              — elas precisam ser reagendadas manualmente pelo atendente.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
