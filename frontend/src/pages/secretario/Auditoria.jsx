import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Download } from "lucide-react";

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/audit-logs").then(r => setLogs(r.data)); }, []);

  const filtered = logs.filter(l =>
    !q || l.action?.toLowerCase().includes(q.toLowerCase()) ||
    l.user_name?.toLowerCase().includes(q.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [["Timestamp", "Usuário", "Perfil", "Ação", "Alvo", "Detalhes"]];
    filtered.forEach(l => rows.push([l.timestamp, l.user_name, l.user_role, l.action, l.target, JSON.stringify(l.details)]));
    const csv = rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "auditoria.csv"; a.click();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Logs imutável</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Auditoria</h1>
          <p className="text-slate-500 mt-1">Todas as ações executadas no sistema.</p>
        </div>
        <button data-testid="export-csv" onClick={exportCsv} className="bg-white border border-slate-200 px-4 py-2 rounded-md text-sm font-semibold text-[#1D3557]">
          <Download className="w-4 h-4 inline mr-1" /> Exportar CSV
        </button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por ação ou usuário..."
        className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-md text-sm" />

      <div className="sc-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="text-left px-4 py-3">Data/Hora</th><th className="text-left px-4 py-3">Usuário</th><th className="text-left px-4 py-3">Ação</th><th className="text-left px-4 py-3">Detalhes</th></tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono-nums text-xs text-slate-500">{l.timestamp?.slice(0, 19).replace("T", " ")}</td>
                <td className="px-4 py-2"><div className="font-semibold">{l.user_name}</div><div className="text-xs text-slate-500 capitalize">{l.user_role}</div></td>
                <td className="px-4 py-2 font-mono text-xs bg-slate-50 rounded px-1">{l.action}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-400">Nenhum registro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
