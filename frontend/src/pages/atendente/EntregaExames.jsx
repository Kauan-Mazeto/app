import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Package, CheckCircle } from "lucide-react";

const STATUS = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-600" },
  pronto: { label: "Pronto p/ Retirada", color: "bg-[#E9C46A]/20 text-[#8B6914]" },
  retirado: { label: "Retirado", color: "bg-[#1E4620]/10 text-[#1E4620]" },
};

export default function EntregaExames() {
  const [exams, setExams] = useState([]);
  const [filter, setFilter] = useState("pronto");
  const [q, setQ] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    const { data } = await api.get(`/exams${params.toString() ? `?${params.toString()}` : ""}`);
    setExams(data);
  };
  useEffect(() => { load(); }, [filter, q]);

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/exams/${id}/status?status=${status}`);
      toast.success(status === "retirado" ? "Exame entregue" : "Status atualizado");
      load();
    } catch { toast.error("Erro"); }
  };

  const filtered = exams;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="overline text-[#457B9D]">Balcão · Retirada</div>
        <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Entrega de Exames</h1>
      </div>

      <div className="flex gap-3 mb-6">
        {["pendente", "pronto", "retirado", ""].map(s => (
          <button key={s || "all"} onClick={() => setFilter(s)} data-testid={`filter-${s || "all"}`}
            className={`px-4 py-2 text-sm rounded-md font-semibold ${filter === s ? "bg-[#1D3557] text-white" : "bg-white border border-slate-200"}`}>
            {s ? STATUS[s].label : "Todos"}
          </button>
        ))}
        <input placeholder="Buscar por paciente ou laboratório..." value={q} onChange={(e) => setQ(e.target.value)}
          className="ml-auto px-3 py-2 border border-slate-200 rounded-md text-sm w-80" />
      </div>

      <div className="sc-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-6 py-3">Paciente</th>
              <th className="text-left px-6 py-3">Exame</th>
              <th className="text-left px-6 py-3">Laboratório</th>
              <th className="text-left px-6 py-3">Solicitado em</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-t border-slate-100" data-testid={`exam-row-${e.id}`}>
                <td className="px-6 py-3 font-semibold">{e.patient?.name}</td>
                <td className="px-6 py-3 text-slate-700">{e.exam}</td>
                <td className="px-6 py-3">
                  {e.lab_externo ? (
                    <span className="inline-flex items-center rounded-full bg-[#457B9D]/10 px-2.5 py-1 text-[11px] font-semibold text-[#457B9D]">
                      {e.lab_externo}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">Interno</span>
                  )}
                </td>
                <td className="px-6 py-3 text-slate-500 font-mono-nums">{e.created_at?.slice(0, 10)}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-[11px] font-bold ${STATUS[e.status].color}`}>{STATUS[e.status].label}</span>
                </td>
                <td className="px-6 py-3 text-right">
                  {e.status === "pendente" && <button data-testid={`ready-${e.id}`} onClick={() => setStatus(e.id, "pronto")} className="text-xs px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50">Marcar Pronto</button>}
                  {e.status === "pronto" && <button data-testid={`deliver-${e.id}`} onClick={() => setStatus(e.id, "retirado")} className="text-xs px-3 py-1.5 rounded-md bg-[#1D3557] text-white font-semibold"><CheckCircle className="w-3 h-3 inline mr-1"/>Registrar Entrega</button>}
                  {e.status === "retirado" && <span className="text-xs text-slate-400">Entregue {e.delivered_at?.slice(11, 16)}</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-400">Nenhum exame.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
