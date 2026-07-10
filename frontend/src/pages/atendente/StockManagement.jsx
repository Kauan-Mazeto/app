import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Download,
  Search,
} from "lucide-react";

const defaultForm = () => ({
  medicine: "",
  quantity: 1,
  dosage: "",
  lot: "",
  notes: "",
  selectedUnitId: "",
});

const ENTRY_STORAGE_KEY = "stock-entry-draft";
const EXIT_STORAGE_KEY = "stock-exit-draft";

export default function StockManagement({
  initialTab = "entry",
  mode = "atendente",
}) {
  const { user } = useAuth();
  const isSecretaryView = user?.role === "secretario" || mode === "secretario";
  const [activeTab, setActiveTab] = useState(
    isSecretaryView ? "stock" : initialTab,
  );
  const [entryForm, setEntryForm] = useState(defaultForm());
  const [exitForm, setExitForm] = useState(defaultForm());
  const [units, setUnits] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stockFilter, setStockFilter] = useState({
    medicine: "",
    unit: "",
    unitId: "",
  });
  const [historyFilterMode, setHistoryFilterMode] = useState("all");
  const [historyFilterValue, setHistoryFilterValue] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const savedEntry = JSON.parse(
        window.localStorage.getItem(ENTRY_STORAGE_KEY) || "null",
      );
      const savedExit = JSON.parse(
        window.localStorage.getItem(EXIT_STORAGE_KEY) || "null",
      );
      if (savedEntry) setEntryForm((prev) => ({ ...prev, ...savedEntry }));
      if (savedExit) setExitForm((prev) => ({ ...prev, ...savedExit }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(entryForm));
  }, [entryForm]);

  useEffect(() => {
    window.localStorage.setItem(EXIT_STORAGE_KEY, JSON.stringify(exitForm));
  }, [exitForm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unitsRes, stockRes, txRes] = await Promise.all([
        api.get("/health-units"),
        api.get("/stock/summary"),
        api.get("/stock/transactions"),
      ]);
      setUnits(unitsRes.data || []);
      setStockItems(stockRes.data || []);
      setMovements(txRes.data || []);

      const availableUnits = unitsRes.data || [];
      if (availableUnits.length && !entryForm.selectedUnitId) {
        const preferred =
          availableUnits.find((unit) => unit.id === user?.healthUnitId) ||
          availableUnits[0];
        setEntryForm((prev) => ({
          ...prev,
          selectedUnitId: preferred?.id || "",
        }));
      }
      if (availableUnits.length && !exitForm.selectedUnitId) {
        const preferred =
          availableUnits.find((unit) => unit.id === user?.healthUnitId) ||
          availableUnits[0];
        setExitForm((prev) => ({
          ...prev,
          selectedUnitId: preferred?.id || "",
        }));
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível carregar o estoque agora");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.healthUnitId]);

  const filteredStock = useMemo(() => {
    const medicineTerm = stockFilter.medicine.toLowerCase();
    const unitTerm = stockFilter.unit.toLowerCase();
    return stockItems.filter((item) => {
      const matchesMedicine =
        !medicineTerm ||
        [item.medicineId, item.medicineName]
          .join(" ")
          .toLowerCase()
          .includes(medicineTerm);
      const matchesUnit =
        !stockFilter.unitId && !unitTerm
          ? true
          : stockFilter.unitId
            ? item.unitId === stockFilter.unitId
            : item.unitName.toLowerCase().includes(unitTerm);
      return matchesMedicine && matchesUnit;
    });
  }, [stockItems, stockFilter]);

  const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const filteredMovements = useMemo(() => {
    return movements.filter((item) => {
      const term = historyFilterValue.trim().toLowerCase();
      if (historyFilterMode === "user") {
        if (!term) return true;
        return (item.user?.name || "").toLowerCase().includes(term);
      }
      if (historyFilterMode === "unit") {
        if (!term) return true;
        return (item.unit || "").toLowerCase().includes(term);
      }
      if (historyFilterMode === "medicine") {
        if (!term) return true;
        return (item.medicineName || "").toLowerCase().includes(term);
      }
      if (historyFilterMode === "type") {
        if (!term) return true;
        const selected =
          term === "entrada" ? "ENTRY" : term === "saida" ? "EXIT" : "";
        return selected ? item.type === selected : true;
      }
      if (historyFilterMode === "period") {
        const ts = new Date(item.createdAt).getTime();
        const from = historyDateFrom
          ? new Date(`${historyDateFrom}T00:00:00`).getTime()
          : null;
        const to = historyDateTo
          ? new Date(`${historyDateTo}T23:59:59`).getTime()
          : null;
        if (from !== null && ts < from) return false;
        if (to !== null && ts > to) return false;
        return true;
      }
      if (!term) return true;
      return [item.medicineName, item.unit, item.user?.name, item.type]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [
    movements,
    historyFilterMode,
    historyFilterValue,
    historyDateFrom,
    historyDateTo,
  ]);

  const updateEntryForm = (changes) =>
    setEntryForm((prev) => ({ ...prev, ...changes }));
  const updateExitForm = (changes) =>
    setExitForm((prev) => ({ ...prev, ...changes }));

  const exportMovementsCsv = () => {
    const rows = filteredMovements.map((item) => ({
      dataHora: formatDateTime(item.createdAt),
      tipo: item.type === "ENTRY" ? "Entrada" : "Saída",
      medicamento: item.medicineName || "",
      unidade: item.unit || "",
      usuario: item.user?.name || "",
      quantidade: item.quantity || 0,
    }));

    const headers = [
      "dataHora",
      "tipo",
      "medicamento",
      "unidade",
      "usuario",
      "quantidade",
    ];
    const csv = [headers.join(",")]
      .concat(
        rows.map((row) =>
          headers
            .map(
              (header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`,
            )
            .join(","),
        ),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimentacoes-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  const handleHistoryDateFromChange = (value) => {
    setHistoryDateFrom(value);
    if (value && historyDateTo && value > historyDateTo) {
      setHistoryDateTo(value);
      toast.warning(
        "A data final foi ajustada para a data inicial, pois não pode ser anterior.",
      );
    }
  };

  const handleHistoryDateToChange = (value) => {
    if (historyDateFrom && value && historyDateFrom > value) {
      setHistoryDateTo(historyDateFrom);
      toast.warning(
        "A data final foi ajustada para a data inicial, pois não pode ser anterior.",
      );
      return;
    }
    setHistoryDateTo(value);
  };

  const submitEntry = async () => {
    if (!entryForm.medicine.trim() || entryForm.quantity <= 0) {
      return toast.warning("Informe o medicamento e uma quantidade válida");
    }
    if (!entryForm.selectedUnitId) {
      return toast.warning("Selecione uma unidade de saúde");
    }

    setSubmitting(true);
    try {
      await api.post("/stock/entry", {
        medicine_id: entryForm.medicine.trim(),
        medicine_name: entryForm.medicine.trim(),
        quantity: Number(entryForm.quantity),
        dosage: entryForm.dosage,
        lot: entryForm.lot,
        notes: entryForm.notes,
        health_unit_id: entryForm.selectedUnitId,
      });
      toast.success("Entrada registrada com sucesso");
      window.localStorage.removeItem(ENTRY_STORAGE_KEY);
      setEntryForm({
        ...defaultForm(),
        selectedUnitId: entryForm.selectedUnitId,
      });
      await loadData();
      setActiveTab("stock");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar entrada");
    } finally {
      setSubmitting(false);
    }
  };

  const submitExit = async () => {
    if (!exitForm.medicine.trim() || exitForm.quantity <= 0) {
      return toast.warning("Informe o medicamento e uma quantidade válida");
    }
    if (!exitForm.selectedUnitId) {
      return toast.warning("Selecione uma unidade de saúde");
    }

    setSubmitting(true);
    try {
      await api.post("/stock/exit", {
        medicine_id: exitForm.medicine.trim(),
        medicine_name: exitForm.medicine.trim(),
        quantity: Number(exitForm.quantity),
        dosage: exitForm.dosage,
        lot: exitForm.lot,
        notes: exitForm.notes,
        health_unit_id: exitForm.selectedUnitId,
      });
      toast.success("Saída registrada com sucesso");
      window.localStorage.removeItem(EXIT_STORAGE_KEY);
      setExitForm({
        ...defaultForm(),
        selectedUnitId: exitForm.selectedUnitId,
      });
      await loadData();
      setActiveTab("stock");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar saída");
    } finally {
      setSubmitting(false);
    }
  };

  const renderForm = (
    kind,
    form,
    updateForm,
    title,
    description,
    submitLabel,
    submitAction,
    buttonTone,
  ) => (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="font-semibold text-[#1D3557]">{title}</div>
        <div>{description}</div>
      </div>
      <label className="text-sm">Atendente</label>
      <input
        value={user?.name || "Carregando..."}
        readOnly
        className="inp bg-slate-50"
      />
      <label className="text-sm">Unidade</label>
      <select
        value={form.selectedUnitId}
        onChange={(e) => updateForm({ selectedUnitId: e.target.value })}
        className="inp"
      >
        <option value="">Selecione a unidade</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
      <label className="text-sm">Medicamento</label>
      <input
        value={form.medicine}
        onChange={(e) => updateForm({ medicine: e.target.value })}
        className="inp"
        placeholder="Nome ou código do medicamento"
      />
      <label className="text-sm">Dosagem</label>
      <input
        value={form.dosage}
        onChange={(e) => updateForm({ dosage: e.target.value })}
        className="inp"
        placeholder="Ex.: 500mg"
      />
      <label className="text-sm">Lote / Referência</label>
      <input
        value={form.lot}
        onChange={(e) => updateForm({ lot: e.target.value })}
        className="inp"
        placeholder="Opcional"
      />
      <label className="text-sm">Observações</label>
      <textarea
        value={form.notes}
        onChange={(e) => updateForm({ notes: e.target.value })}
        className="inp min-h-[90px]"
        placeholder="Informações adicionais do medicamento"
      />
      <label className="text-sm">Quantidade</label>
      <input
        type="number"
        min={1}
        value={form.quantity}
        onChange={(e) => updateForm({ quantity: Number(e.target.value) })}
        className="inp"
      />
      <div className="flex justify-end">
        <button
          onClick={submitAction}
          disabled={submitting}
          className={buttonTone}
        >
          {submitting ? "Processando..." : submitLabel}
        </button>
      </div>
    </div>
  );

  const tabs = isSecretaryView
    ? [{ id: "stock", label: "Estoque", icon: Boxes }]
    : [
        { id: "entry", label: "Entrada", icon: ArrowUpCircle },
        { id: "exit", label: "Saída", icon: ArrowDownCircle },
      ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="overline text-[#457B9D]">
          {isSecretaryView ? "Estoque · Visualização" : "Estoque · Gestão"}
        </div>
        <h1 className="font-display text-3xl font-extrabold text-[#1D3557]">
          {isSecretaryView
            ? "Visualização de estoque"
            : "Controle de entradas, saídas e saldo"}
        </h1>
        <p className="text-slate-500 mt-2">
          {isSecretaryView
            ? "Acompanhe o saldo atual e o histórico de movimentações por medicamento e unidade."
            : "Registre movimentações e acompanhe o estoque por medicamento e unidade em um único lugar."}
        </p>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="sc-card p-4">
          <div className="mb-4">
            <div className="overline text-[#457B9D]">Estoque</div>
            <h2 className="font-display text-lg font-bold text-[#1D3557]">
              Controle de estoque
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Escolha a operação dentro do painel.
            </p>
          </div>

          {!isSecretaryView ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab("entry")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${activeTab === "entry" ? "bg-[#1D3557] text-white" : "bg-white text-[#1D3557] border border-slate-200"}`}
              >
                <ArrowUpCircle className="w-4 h-4" /> Entrada
              </button>
              <button
                onClick={() => setActiveTab("exit")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${activeTab === "exit" ? "bg-amber-600 text-white" : "bg-white text-[#1D3557] border border-slate-200"}`}
              >
                <ArrowDownCircle className="w-4 h-4" /> Saída
              </button>
              <button
                onClick={() => setActiveTab("stock")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${activeTab === "stock" ? "bg-[#1D3557] text-white" : "bg-white text-[#1D3557] border border-slate-200"}`}
              >
                <Boxes className="w-4 h-4" /> Saldo / Histórico
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <button className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold bg-white text-[#1D3557] border border-slate-200">
                <Boxes className="w-4 h-4" /> Ver estoque
              </button>
            </div>
          )}
        </aside>

        <div>
          {activeTab === "entry" && (
            <div className="sc-card p-6">
              {renderForm(
                "entry",
                entryForm,
                updateEntryForm,
                "Registrar entrada",
                "Cadastre o recebimento de medicamentos e mantenha o histórico da movimentação.",
                "Registrar Entrada",
                submitEntry,
                "btn-primary",
              )}
            </div>
          )}

          {activeTab === "exit" && (
            <div className="sc-card p-6">
              {renderForm(
                "exit",
                exitForm,
                updateExitForm,
                "Registrar saída",
                "Registre a entrega de medicamentos e atualize o estoque automaticamente.",
                "Confirmar Saída",
                submitExit,
                "btn-primary bg-amber-600 hover:bg-amber-700",
              )}
            </div>
          )}

          {activeTab === "stock" && (
            <div className="space-y-6">
              <div className="sc-card p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="overline text-[#457B9D]">Saldo atual</div>
                    <h2 className="text-xl font-bold text-[#1D3557]">
                      Estoque por medicamento e unidade
                    </h2>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={stockFilter.medicine}
                        onChange={(e) =>
                          setStockFilter((prev) => ({
                            ...prev,
                            medicine: e.target.value,
                          }))
                        }
                        placeholder="Filtrar por medicamento"
                        className="pl-10 inp min-w-[220px]"
                      />
                    </div>
                    <div className="relative">
                      <input
                        value={stockFilter.unit}
                        onChange={(e) => {
                          const value = e.target.value;
                          const matchingUnit = units.find(
                            (unit) =>
                              unit.name.toLowerCase() ===
                              value.trim().toLowerCase(),
                          );
                          setStockFilter((prev) => ({
                            ...prev,
                            unit: value,
                            unitId: matchingUnit?.id || "",
                          }));
                        }}
                        onBlur={() => {
                          const matchingUnit = units.find(
                            (unit) =>
                              unit.name.toLowerCase() ===
                              stockFilter.unit.trim().toLowerCase(),
                          );
                          if (!matchingUnit && stockFilter.unit.trim()) {
                            setStockFilter((prev) => ({ ...prev, unitId: "" }));
                          }
                        }}
                        list="stock-units-list"
                        placeholder="Selecionar ou pesquisar unidade"
                        className="inp min-w-[220px]"
                      />
                      <datalist id="stock-units-list">
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="mt-6 text-slate-500">
                    Carregando estoque...
                  </div>
                ) : (
                  <div className="mt-6 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Medicamento</th>
                          <th className="px-4 py-3">Unidade</th>
                          <th className="px-4 py-3">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStock.map((item) => (
                          <tr
                            key={`${item.unitId}-${item.medicineId}`}
                            className="border-t border-slate-100"
                          >
                            <td className="px-4 py-3 font-semibold text-[#1D3557]">
                              {item.medicineName || item.medicineId}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.unitName}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${item.quantity <= 0 ? "text-amber-600" : "text-emerald-600"}`}
                            >
                              {item.quantity}
                            </td>
                          </tr>
                        ))}
                        {filteredStock.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-10 text-center text-slate-400"
                            >
                              Nenhum saldo encontrado para os filtros
                              selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="sc-card p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="overline text-[#457B9D]">Histórico</div>
                    <h2 className="text-xl font-bold text-[#1D3557]">
                      Entradas e saídas
                    </h2>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={exportMovementsCsv}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#1D3557] transition hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      Exportar CSV
                    </button>
                    <select
                      value={historyFilterMode}
                      onChange={(e) => {
                        setHistoryFilterMode(e.target.value);
                        setHistoryFilterValue("");
                        setHistoryDateFrom("");
                        setHistoryDateTo("");
                      }}
                      className="inp h-10 min-w-[180px] bg-white"
                    >
                      <option value="all">Todos</option>
                      <option value="user">Por usuário</option>
                      <option value="unit">Por unidade</option>
                      <option value="medicine">Por medicamento</option>
                      <option value="type">Por tipo</option>
                      <option value="period">Por período</option>
                    </select>
                    {historyFilterMode === "type" ? (
                      <select
                        value={historyFilterValue}
                        onChange={(e) => setHistoryFilterValue(e.target.value)}
                        className="inp h-10 min-w-[140px] bg-white"
                      >
                        <option value="">Selecione</option>
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    ) : historyFilterMode === "period" ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="date"
                          value={historyDateFrom}
                          onChange={(e) =>
                            handleHistoryDateFromChange(e.target.value)
                          }
                          className="inp min-w-[140px]"
                        />
                        <input
                          type="date"
                          value={historyDateTo}
                          onChange={(e) =>
                            handleHistoryDateToChange(e.target.value)
                          }
                          className="inp min-w-[140px]"
                        />
                      </div>
                    ) : (
                      <input
                        value={historyFilterValue}
                        onChange={(e) => setHistoryFilterValue(e.target.value)}
                        placeholder={
                          historyFilterMode === "user"
                            ? "Nome do usuário"
                            : historyFilterMode === "unit"
                              ? "Nome da unidade"
                              : historyFilterMode === "medicine"
                                ? "Nome do medicamento"
                                : "Filtrar pelo texto"
                        }
                        className="inp min-w-[240px]"
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Data/Hora</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Medicamento</th>
                        <th className="px-4 py-3">Unidade</th>
                        <th className="px-4 py-3">Usuário</th>
                        <th className="px-4 py-3">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-4 py-3 font-mono-nums text-xs text-slate-500">
                            {formatDateTime(item.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-1 text-xs font-semibold ${item.type === "ENTRY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {item.type === "ENTRY" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#1D3557]">
                              {item.medicineName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.medicineDetails?.dosage || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.unit}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">
                              {item.user?.name || "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.user?.role || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                      {filteredMovements.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-10 text-center text-slate-400"
                          >
                            Nenhuma movimentação encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
