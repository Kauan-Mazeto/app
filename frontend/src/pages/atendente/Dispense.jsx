import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Dispense() {
  const { user } = useAuth();
  const STORAGE_KEY = "stock-exit-draft";
  const [medicine, setMedicine] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dosage, setDosage] = useState("");
  const [lot, setLot] = useState("");
  const [notes, setNotes] = useState("");
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.medicine) setMedicine(parsed.medicine);
      if (parsed.quantity) setQuantity(Number(parsed.quantity));
      if (parsed.dosage) setDosage(parsed.dosage);
      if (parsed.lot) setLot(parsed.lot);
      if (parsed.notes) setNotes(parsed.notes);
      if (parsed.selectedUnitId) setSelectedUnitId(parsed.selectedUnitId);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const draft = { medicine, quantity, dosage, lot, notes, selectedUnitId };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [medicine, quantity, dosage, lot, notes, selectedUnitId]);

  const loadUnits = async () => {
    try {
      const { data } = await api.get("/health-units");
      setUnits(data);
      if (data.length) {
        const preferred = data.find((u) => u.id === user?.healthUnitId) || data[0];
        setSelectedUnitId((prev) => prev || preferred?.id || "");
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadUnits(); }, [user?.healthUnitId]);

  const submit = async () => {
    if (!medicine.trim() || quantity <= 0) return toast.warning("Informe medicamento e quantidade válida");
    if (!selectedUnitId) return toast.warning("Selecione uma unidade de saúde");
    setLoading(true);
    try {
      await api.post("/stock/exit", {
        medicine_id: medicine.trim(),
        medicine_name: medicine.trim(),
        quantity,
        dosage,
        lot,
        notes,
        health_unit_id: selectedUnitId,
      });
      toast.success("Baixa registrada e salva na movimentação de estoque");
      window.localStorage.removeItem(STORAGE_KEY);
      setMedicine(""); setQuantity(1); setDosage(""); setLot(""); setNotes("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar baixa");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="overline text-[#457B9D]">Estoque · Dispensação</div>
      <h1 className="font-display text-2xl font-extrabold text-[#1D3557] mb-4">Registrar Saída (Entrega ao paciente)</h1>
      <div className="sc-card p-6">
        <div className="grid grid-cols-1 gap-4">
          <label className="text-sm">Atendente</label>
          <input value={user?.name || "Carregando..."} readOnly className="inp bg-slate-50" />
          <label className="text-sm">Unidade</label>
          <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} className="inp">
            <option value="">Selecione a unidade</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <label className="text-sm">Medicamento</label>
          <input value={medicine} onChange={(e) => setMedicine(e.target.value)} className="inp" placeholder="Nome ou código do medicamento" />
          <label className="text-sm">Dosagem</label>
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} className="inp" placeholder="Ex.: 500mg" />
          <label className="text-sm">Lote / Referência</label>
          <input value={lot} onChange={(e) => setLot(e.target.value)} className="inp" placeholder="Opcional" />
          <label className="text-sm">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="inp min-h-[90px]" placeholder="Informações adicionais do medicamento" />
          <label className="text-sm">Quantidade</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="inp" />
          <div className="flex justify-end">
            <button onClick={submit} disabled={loading} className="btn-primary">{loading ? 'Processando...' : 'Confirmar Entrega e Dar Baixa'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
