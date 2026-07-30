import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function StockDashboard() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/secretario/dashboard-stock");
      setUnits(data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="overline text-[#457B9D]">Secretaria · Estoque</div>
      <h1 className="font-display text-3xl font-extrabold text-[#1D3557] mb-6">Visão Geral de Estoque por Unidade</h1>
      {loading && <div className="text-slate-500">Carregando...</div>}
      <div className="space-y-4">
        {units.map((u) => (
          <details key={u.id} className="sc-card p-4">
            <summary className="font-semibold text-[#1D3557] cursor-pointer">{u.name}</summary>
            <div className="mt-3">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Medicamento</th>
                    <th className="text-right px-3 py-2">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {u.stocks.map(s => (
                    <tr key={s.medicineId} className="border-t border-slate-100">
                      <td className="px-3 py-2">{s.medicineId}</td>
                      <td className="px-3 py-2 text-right">
                        {s.outOfStock ? <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 font-semibold">Esgotado</span>
                         : s.lowStock ? <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700 font-semibold">{s.quantity} · Estoque baixo</span>
                         : <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">{s.quantity}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}