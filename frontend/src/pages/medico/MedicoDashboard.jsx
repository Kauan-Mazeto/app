import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, User, Activity } from "lucide-react";
import { toast } from "sonner";

const priorityStyle = {
  urgente: "bg-[#E76F51] text-white",
  preferencial: "bg-[#E9C46A] text-slate-900",
  normal: "bg-slate-100 text-slate-700",
};

const statusStyle = {
  aguardando: "text-[#457B9D]",
  compareceu: "text-[#1E4620]",
  faltou: "text-[#E76F51]",
};

export default function MedicoDashboard() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/queue/today");
      setQueue(data);
    } catch { toast.error("Erro ao carregar fila"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}`, { status });
      toast.success(status === "compareceu" ? "Consulta iniciada" : "Falta registrada");
      load();
    } catch { toast.error("Erro ao atualizar"); }
  };

  const stats = {
    total: queue.length,
    urgente: queue.filter(a => a.priority === "urgente").length,
    preferencial: queue.filter(a => a.priority === "preferencial").length,
    aguardando: queue.filter(a => a.status === "aguardando").length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="overline text-[#457B9D]">Consultório · Hoje</div>
        <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Fila de Atendimento</h1>
        <p className="text-slate-500 mt-1">Ordenada por prioridade e horário. Clique no paciente para abrir o prontuário.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Consultas hoje" value={stats.total} icon={Activity} />
        <StatCard label="Urgentes" value={stats.urgente} icon={AlertTriangle} accent="#E76F51" />
        <StatCard label="Preferenciais" value={stats.preferencial} icon={User} accent="#E9C46A" />
        <StatCard label="Aguardando" value={stats.aguardando} icon={Clock} accent="#457B9D" />
      </div>

      <div className="sc-card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-[#1D3557]">Pacientes do dia</h2>
            <div className="text-xs text-slate-500">Fila unificada por prioridade</div>
          </div>
        </div>
        {loading ? (
          <div className="p-10 text-center text-slate-400">Carregando...</div>
        ) : queue.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Nenhuma consulta agendada para hoje.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-6 py-3">Prioridade</th>
                <th className="text-left px-6 py-3">Paciente</th>
                <th className="text-left px-6 py-3">Horário</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-right px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/50" data-testid={`queue-row-${a.id}`}>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase ${priorityStyle[a.priority]}`}>
                      {a.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      data-testid={`patient-open-${a.patient_id}`}
                      onClick={() => nav(`/medico/paciente/${a.patient_id}`)}
                      className="font-semibold text-[#1D3557] hover:underline text-left"
                    >
                      {a.patient?.name}
                    </button>
                    <div className="text-xs text-slate-500">{a.patient?.cpf}</div>
                  </td>
                  <td className="px-6 py-4 font-mono-nums text-slate-700">
                    {a.scheduled_at?.slice(11, 16)}
                  </td>
                  <td className={`px-6 py-4 font-semibold capitalize ${statusStyle[a.status]}`}>{a.status}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      data-testid={`start-consult-${a.id}`}
                      onClick={() => nav(`/medico/paciente/${a.patient_id}?appt=${a.id}`)}
                      className="text-xs px-3 py-1.5 rounded-md bg-[#1D3557] text-white font-semibold hover:bg-[#152742]"
                    >
                      Atender
                    </button>
                    <button
                      data-testid={`mark-missing-${a.id}`}
                      onClick={() => markStatus(a.id, "faltou")}
                      className="text-xs px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                    >
                      Faltou
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent = "#1D3557" }) {
  return (
    <div className="sc-card" data-testid={`stat-${label}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="overline">{label}</div>
          <div className="font-display text-3xl font-extrabold text-[#1D3557] mt-2">{value}</div>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}
