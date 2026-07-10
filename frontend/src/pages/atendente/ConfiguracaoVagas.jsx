import { useEffect, useMemo, useState } from "react";
import { api, formatError } from "@/lib/api";
import { toast } from "sonner";
import { Save, Calendar as CalendarIcon, Info } from "lucide-react";

const WEEKDAYS = [
  { day_of_week: 1, label: "Segunda-feira" },
  { day_of_week: 2, label: "Terça-feira" },
  { day_of_week: 3, label: "Quarta-feira" },
  { day_of_week: 4, label: "Quinta-feira" },
  { day_of_week: 5, label: "Sexta-feira" },
  { day_of_week: 6, label: "Sábado" },
  { day_of_week: 0, label: "Domingo" },
];

const DEFAULT_UNIT = "UBS Central";

export default function ConfiguracaoVagas() {
  const [units, setUnits] = useState([DEFAULT_UNIT]);
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [newUnit, setNewUnit] = useState("");
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState(null);
  const [addingUnit, setAddingUnit] = useState(false);

  // Carrega as unidades cadastradas de verdade (tabela HealthUnit no backend).
  const loadUnits = async () => {
    try {
      const r = await api.get("/health-units");
      const names = r.data.map((u) => u.name);
      setUnits(names.length ? names : [DEFAULT_UNIT]);
      if (names.length && !names.includes(unit)) setUnit(names[0]);
    } catch {
      // fallback: deriva das unidades já usadas por usuários cadastrados
      try {
        const r2 = await api.get("/users");
        const found = [...new Set(r2.data.map((u) => u.unit).filter(Boolean))].sort();
        setUnits(found.length ? found : [DEFAULT_UNIT]);
      } catch { }
    }
  };
  useEffect(() => { loadUnits(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConfig = async (u) => {
    setLoading(true);
    try {
      const r = await api.get(`/scheduling-config?unit=${encodeURIComponent(u)}`);
      const byDay = Object.fromEntries(r.data.days.map((d) => [d.day_of_week, d]));
      setDays(WEEKDAYS.map((w) => ({ ...w, ...byDay[w.day_of_week] })));
      const todayStr = new Date().toISOString().slice(0, 10);
      const av = await api.get(`/scheduling-config/availability?unit=${encodeURIComponent(u)}&date=${todayStr}`);
      setToday(av.data);
    } catch (e) {
      toast.error(formatError(e?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (unit) loadConfig(unit); }, [unit]);

  const updateDay = (dayOfWeek, field, value) => {
    setDays((prev) => prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/scheduling-config", {
        unit,
        days: days.map((d) => ({
          day_of_week: d.day_of_week,
          online_percentage: Number(d.online_percentage) || 0,
          max_online_slots: Number(d.max_online_slots) || 0,
        })),
      });
      toast.success("Configuração de vagas salva");
      loadConfig(unit);
    } catch (e) {
      toast.error(formatError(e?.response?.data?.detail) || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const addUnit = async () => {
    const u = newUnit.trim();
    if (!u) return;
    setAddingUnit(true);
    try {
      await api.post("/health-units", { name: u });
      toast.success(`Unidade "${u}" cadastrada`);
      await loadUnits();
      setUnit(u);
      setNewUnit("");
    } catch (e) {
      toast.error(formatError(e?.response?.data?.detail) || "Erro ao cadastrar unidade");
    } finally {
      setAddingUnit(false);
    }
  };

  const totalMax = useMemo(() => days.reduce((s, d) => s + (Number(d.max_online_slots) || 0), 0), [days]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Gestão de agenda</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
            Vagas Online × Presencial
          </h1>
          <p className="text-slate-500 mt-1">
            Defina, por unidade e dia da semana, o percentual-alvo de consultas online e o
            número máximo de vagas online disponíveis. Ao atingir o limite, novos agendamentos
            online daquele dia são bloqueados automaticamente.
          </p>
        </div>
      </div>

      {/* Seletor de unidade */}
      <div className="sc-card mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="overline block mb-1">Unidade de saúde</label>
            <select
              data-testid="cv-unit-select"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="inp min-w-[220px]"
            >
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="overline block mb-1">Adicionar nova unidade</label>
            <div className="flex gap-2">
              <input
                data-testid="cv-new-unit-input"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="Ex: UBS Zona Leste"
                className="inp"
              />
              <button
                data-testid="cv-new-unit-add"
                onClick={addUnit}
                disabled={addingUnit}
                className="bg-white border border-slate-200 px-3 py-2 rounded-md text-sm font-semibold text-[#1D3557] disabled:opacity-50"
              >
                {addingUnit ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status de hoje */}
      {today && (
        <div className="sc-card mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#457B9D]/10 shrink-0">
            <CalendarIcon className="w-4 h-4 text-[#457B9D]" />
          </div>
          <div className="text-sm text-slate-600">
            {today.max_online_slots === null ? (
              <>Hoje ({unit}) não tem limite de vagas online configurado, os agendamentos online são ilimitados.</>
            ) : (
              <>
                Hoje ({unit}): <strong className="text-[#1D3557]">{today.used_online_slots}</strong> de{" "}
                <strong className="text-[#1D3557]">{today.max_online_slots}</strong> vagas online já usadas
                {today.blocked && (
                  <span className="ml-2 text-[10px] bg-[#E76F51]/10 text-[#E76F51] px-2 py-1 rounded font-bold align-middle">
                    LIMITE ATINGIDO
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabela de configuração por dia da semana */}
      <div className="sc-card p-0 overflow-hidden mb-6">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Carregando configuração...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Dia da semana</th>
                <th className="text-left px-4 py-3">% agendamentos online (alvo)</th>
                <th className="text-left px-4 py-3">Máx. vagas online no dia</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day_of_week} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-[#1D3557]">{d.label}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        data-testid={`cv-pct-${d.day_of_week}`}
                        type="number"
                        min={0}
                        max={100}
                        value={d.online_percentage}
                        onChange={(e) => updateDay(d.day_of_week, "online_percentage", e.target.value)}
                        className="inp w-24"
                      />
                      <span className="text-slate-400 text-xs">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      data-testid={`cv-max-${d.day_of_week}`}
                      type="number"
                      min={0}
                      value={d.max_online_slots}
                      onChange={(e) => updateDay(d.day_of_week, "max_online_slots", e.target.value)}
                      className="inp w-24"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5" />
          Total de vagas online/semana nesta unidade: <strong className="text-[#1D3557]">{totalMax}</strong>
        </div>
        <button
          data-testid="cv-save"
          onClick={save}
          disabled={saving || loading}
          className="btn-primary disabled:opacity-50"
        >
          <Save className="w-4 h-4 inline mr-1" /> {saving ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </div>
  );
}