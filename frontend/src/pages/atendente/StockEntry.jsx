import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  Pill,
  Package,
  Building2,
  Barcode,
  FileText,
  Calendar,
  Lock,
} from "lucide-react";

// Dosagens comuns pré-definidas
const DOSAGE_PRESETS = [
  "5mg", "10mg", "20mg", "25mg", "50mg", "75mg",
  "100mg", "150mg", "200mg", "250mg", "500mg",
  "750mg", "850mg", "1g", "5ml", "10ml", "15ml", "20ml",
];

const PHARMA_FORMS = [
  "Comprimido",
  "Cápsula",
  "Comprimido revestido",
  "Xarope",
  "Solução oral",
  "Suspensão oral",
  "Injetável (ampola)",
  "Injetável (frasco-ampola)",
  "Pomada",
  "Creme",
  "Gel",
  "Colírio",
  "Supositório",
];

const PRESENTATIONS = [
  "Caixa com 30 comprimidos",
  "Caixa com 60 comprimidos",
  "Caixa com 20 cápsulas",
  "Frasco com 100 ml",
  "Frasco com 150 ml",
  "Ampola 5 ml",
  "Bisnaga 30g",
];

const EMPTY_FORM = {
  commercialName: "",
  activeSubstance: "",
  anvisaCode: "",
  barcodeUnit: "",
  barcodeBox: "",
  ncm: "",
  cest: "",
  manufacturer: "",
  presentation: "",
  concentration: "",
  pharmaceuticalForm: "",
  lot: "",
  expiryDate: "",
  quantity: 1,
  notes: "",
};

export default function StockEntry() {
  const { user } = useAuth();
  const STORAGE_KEY = "stock-entry-draft";

  const [form, setForm] = useState(EMPTY_FORM);
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Restaura rascunho
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm((f) => ({ ...f, ...parsed.form }));
        if (parsed.selectedUnitId) setSelectedUnitId(parsed.selectedUnitId);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ form, selectedUnitId })
    );
  }, [form, selectedUnitId]);

  // Carrega unidades e trava para a unidade do atendente
  const loadUnits = async () => {
    try {
      const { data } = await api.get("/health-units");
      setUnits(data);
      if (user?.healthUnitId) {
        setSelectedUnitId(user.healthUnitId);
      } else if (data.length && !selectedUnitId) {
        setSelectedUnitId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.healthUnitId]);

  const lockedUnit = !!user?.healthUnitId;

  const submit = async () => {
    if (!form.commercialName.trim() || !form.activeSubstance.trim())
      return toast.warning(
        "Informe pelo menos o nome comercial e o princípio ativo"
      );
    if (Number(form.quantity) <= 0)
      return toast.warning("Quantidade inválida");
    if (!selectedUnitId) return toast.warning("Unidade obrigatória");

    setLoading(true);
    try {
      await api.post("/stock/entry", {
        medicine_id: form.anvisaCode || form.commercialName,
        medicine_name: `${form.commercialName} (${form.activeSubstance})`,
        commercial_name: form.commercialName,
        active_substance: form.activeSubstance,
        anvisa_code: form.anvisaCode,
        barcode_unit: form.barcodeUnit,
        barcode_box: form.barcodeBox,
        ncm: form.ncm,
        cest: form.cest,
        manufacturer: form.manufacturer,
        presentation: form.presentation,
        concentration: form.concentration,
        pharmaceutical_form: form.pharmaceuticalForm,
        lot: form.lot,
        expiry_date: form.expiryDate,
        quantity: Number(form.quantity),
        dosage: form.concentration,
        notes: form.notes,
        health_unit_id: selectedUnitId,
      });
      toast.success(`${form.commercialName} cadastrado no estoque`);
      window.localStorage.removeItem(STORAGE_KEY);
      setForm(EMPTY_FORM);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar entrada");
    } finally {
      setLoading(false);
    }
  };

  const selectedUnitName =
    units.find((u) => u.id === selectedUnitId)?.name || "—";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="overline text-[#457B9D]">Estoque · Recebimento</div>
        <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
          Cadastrar Medicamento no Estoque
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Preencha os dados fiscais e farmacêuticos para rastreabilidade completa.
        </p>
      </div>

      {/* Unidade (travada quando atendente pertence a uma) */}
      <div className="sc-card mb-6 flex items-center gap-4 bg-[#1D3557]/5 border-[#1D3557]/20">
        <div className="w-12 h-12 rounded-lg bg-[#1D3557] text-white flex items-center justify-center">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="overline">Unidade de saúde</div>
          {lockedUnit ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold text-[#1D3557] text-lg">
                {selectedUnitName}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> vinculado ao atendente
              </span>
            </div>
          ) : (
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="inp mt-1"
            >
              <option value="">Selecione a unidade</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bloco 1 — Identificação */}
      <Section title="Identificação" icon={Pill}>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nome comercial (marca)" required>
            <input
              className="inp"
              value={form.commercialName}
              onChange={(e) => update("commercialName", e.target.value)}
              placeholder="Ex.: Losartana Genérico Medley"
            />
          </Field>
          <Field label="Princípio ativo (DCB/DCI)" required>
            <input
              className="inp"
              value={form.activeSubstance}
              onChange={(e) => update("activeSubstance", e.target.value)}
              placeholder="Ex.: Losartana Potássica"
            />
          </Field>
          <Field label="Laboratório fabricante">
            <input
              className="inp"
              value={form.manufacturer}
              onChange={(e) => update("manufacturer", e.target.value)}
              placeholder="Ex.: EMS, Medley, Eurofarma..."
            />
          </Field>
          <Field label="Registro ANVISA (13 dígitos)">
            <input
              className="inp font-mono-nums"
              value={form.anvisaCode}
              onChange={(e) =>
                update(
                  "anvisaCode",
                  e.target.value.replace(/\D/g, "").slice(0, 13)
                )
              }
              placeholder="0000000000000"
              maxLength={13}
            />
          </Field>
        </div>
      </Section>

      {/* Bloco 2 — Farmacêutico */}
      <Section title="Informações Farmacêuticas" icon={Package}>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Concentração / Dosagem" required>
            <input
              className="inp"
              list="dosage-presets"
              value={form.concentration}
              onChange={(e) => update("concentration", e.target.value)}
              placeholder="Selecione ou digite"
            />
            <datalist id="dosage-presets">
              {DOSAGE_PRESETS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>
          <Field label="Forma farmacêutica">
            <select
              className="inp"
              value={form.pharmaceuticalForm}
              onChange={(e) => update("pharmaceuticalForm", e.target.value)}
            >
              <option value="">— Selecionar —</option>
              {PHARMA_FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Apresentação">
            <input
              className="inp"
              list="presentation-presets"
              value={form.presentation}
              onChange={(e) => update("presentation", e.target.value)}
              placeholder="Ex.: Caixa com 30 comprimidos"
            />
            <datalist id="presentation-presets">
              {PRESENTATIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>
      </Section>

      {/* Bloco 3 — Códigos fiscais e barras */}
      <Section title="Códigos Fiscais e Rastreabilidade" icon={Barcode}>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Código de barras — unidade (EAN)">
            <input
              className="inp font-mono-nums"
              value={form.barcodeUnit}
              onChange={(e) =>
                update("barcodeUnit", e.target.value.replace(/\D/g, ""))
              }
              placeholder="Ex.: 7891234567890"
            />
          </Field>
          <Field label="Código de barras — caixa fechada (EAN)">
            <input
              className="inp font-mono-nums"
              value={form.barcodeBox}
              onChange={(e) =>
                update("barcodeBox", e.target.value.replace(/\D/g, ""))
              }
              placeholder="Ex.: 17891234567897"
            />
          </Field>
          <Field label="NCM (Classificação Fiscal)">
            <input
              className="inp font-mono-nums"
              value={form.ncm}
              onChange={(e) => update("ncm", e.target.value)}
              placeholder="Ex.: 3004.90.99"
            />
          </Field>
          <Field label="CEST (Tributação)">
            <input
              className="inp font-mono-nums"
              value={form.cest}
              onChange={(e) => update("cest", e.target.value)}
              placeholder="Ex.: 13.001.00"
            />
          </Field>
        </div>
      </Section>

      {/* Bloco 4 — Lote e validade */}
      <Section title="Lote, Validade e Quantidade" icon={Calendar}>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Lote" required>
            <input
              className="inp"
              value={form.lot}
              onChange={(e) => update("lot", e.target.value)}
              placeholder="Ex.: L2024-A123"
            />
          </Field>
          <Field label="Validade" required>
            <input
              type="date"
              className="inp"
              value={form.expiryDate}
              onChange={(e) => update("expiryDate", e.target.value)}
            />
          </Field>
          <Field label="Quantidade recebida" required>
            <input
              type="number"
              min={1}
              className="inp font-mono-nums"
              value={form.quantity}
              onChange={(e) => update("quantity", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Observações */}
      <Section title="Observações" icon={FileText}>
        <textarea
          className="inp"
          rows={3}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Ex.: entrega parcial, avarias, procedência..."
        />
      </Section>

      {/* Rodapé de ação */}
      <div className="flex items-center justify-between mt-6 sticky bottom-4 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
        <div className="text-xs text-slate-500">
          Campos com <span className="text-[#E76F51] font-bold">*</span> são obrigatórios.
          Um registro imutável será criado na auditoria.
        </div>
        <button
          onClick={submit}
          disabled={loading}
          className="bg-[#1D3557] hover:bg-[#152742] text-white px-6 py-3 rounded-md font-semibold text-sm disabled:opacity-50 transition"
        >
          {loading ? "Salvando..." : "Registrar entrada no estoque"}
        </button>
      </div>

      <style>{`
        .inp {
          width: 100%;
          padding: .55rem .75rem;
          border: 1px solid #E2E8F0;
          border-radius: .5rem;
          font-size: .875rem;
          background: white;
          transition: border-color .15s, box-shadow .15s;
        }
        .inp:focus {
          outline: none;
          border-color: #457B9D;
          box-shadow: 0 0 0 3px rgba(69,123,157,0.15);
        }
      `}</style>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="sc-card mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#457B9D]/10 text-[#457B9D] flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-display font-bold text-lg text-[#1D3557]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-[#E76F51]">*</span>}
      </label>
      {children}
    </div>
  );
}