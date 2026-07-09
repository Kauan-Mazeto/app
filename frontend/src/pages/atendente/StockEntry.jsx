import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function StockEntry() {
  const [medicine, setMedicine] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!medicine.trim() || quantity <= 0) return toast.warning("Informe medicamento e quantidade válida");
    setLoading(true);
    try {
      const { data } = await api.post("/stock/entry", { medicine_id: medicine.trim(), quantity });
      toast.success("Entrada registrada");
      setMedicine(""); setQuantity(1);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar entrada");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="overline text-[#457B9D]">Estoque · Recebimento</div>
      <h1 className="font-display text-2xl font-extrabold text-[#1D3557] mb-4">Registrar Entrada de Medicamento</h1>
      <div className="sc-card p-6">
        <div className="grid grid-cols-1 gap-4">
          <label className="text-sm">Medicamento</label>
          <input value={medicine} onChange={(e) => setMedicine(e.target.value)} className="inp" placeholder="Nome ou código do medicamento" />
          <label className="text-sm">Quantidade</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="inp" />
          <div className="flex justify-end">
            <button onClick={submit} disabled={loading} className="btn-primary">{loading ? 'Registrando...' : 'Registrar Entrada'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
