import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Download } from "lucide-react";

export default function MovimentacoesEstoque() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/stock/transactions");
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((item) => {
    const search = q.toLowerCase();
    return !search || [item.medicineName, item.type, item.unit, item.user?.name, item.user?.role]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  const exportCsv = () => {
    const rows = [["Data/Hora", "Tipo", "Medicamento", "Unidade", "Usuário", "Quantidade", "Detalhes"]];
    filtered.forEach((item) => rows.push([
      item.createdAt?.slice(0, 19).replace("T", " "),
      item.type === "ENTRY" ? "Entrada" : "Saída",
      item.medicineName,
      item.unit,
      item.user?.name || "",
      item.quantity,
      JSON.stringify(item.medicineDetails || {}),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "movimentacoes-estoque.csv"; a.click();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-end gap-4">
        <div>
          <div className="overline text-[#457B9D]">Estoque · Movimentações</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Histórico de Movimentações</h1>
          <p className="text-slate-500 mt-1">Usuário responsável, horário, unidade e detalhes do medicamento em cada entrada ou saída.</p>
        </div>
        <button data-testid="export-stock-csv" onClick={exportCsv} className="bg-white border border-slate-200 px-4 py-2 rounded-md text-sm font-semibold text-[#1D3557]">
          <Download className="w-4 h-4 inline mr-1" /> Exportar CSV
        </button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por medicamento, unidade ou usuário..."
        className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-md text-sm" />

      <div className="sc-card p-0 overflow-hidden">
        {loading ? <div className="p-6 text-slate-500">Carregando movimentações...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Data/Hora</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Medicamento</th>
                <th className="text-left px-4 py-3">Unidade</th>
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-left px-4 py-3">Quantidade</th>
                <th className="text-left px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 font-mono-nums text-xs text-slate-500">{item.createdAt?.slice(0, 19).replace("T", " ")}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${item.type === "ENTRY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.type === "ENTRY" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[#1D3557]">{item.medicineName}</div>
                    <div className="text-xs text-slate-500">{item.medicineDetails?.dosage || ""}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{item.user?.name || "—"}</div>
                    <div className="text-xs text-slate-500">{item.user?.role || "—"}</div>
                  </td>
                  <td className="px-4 py-2 font-semibold">{item.quantity}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {item.medicineDetails ? JSON.stringify(item.medicineDetails) : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-400">Nenhuma movimentação encontrada.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
