import { useEffect, useMemo, useState } from "react";
import { api, formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
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
  const { user } = useAuth();
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
    if (user?.role === "atendente") {
      const assigned = user.unit || DEFAULT_UNIT;
      setUnits([assigned]);
      setUnit(assigned);
      return;
    }

    try {
      const r = await api.get("/health-units");
      const names = r.data.map((u) => u.name);
      setUnits(names.length ? names : [DEFAULT_UNIT]);
      if (names.length && !names.includes(unit)) setUnit(names[0]);
    } catch {
      // fallback: deriva das unidades já usadas por usuários cadastrados
      try {
        const r2 = await api.get("/users");
        const found = [
          ...new Set(r2.data.map((u) => u.unit).filter(Boolean)),
        ].sort();
        setUnits(found.length ? found : [DEFAULT_UNIT]);
      } catch {}
    }
  };

  useEffect(() => {
    if (user) loadUnits();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConfig = async (u) => {
    setLoading(true);
    try {
      const r = await api.get(
        `/scheduling-config?unit=${encodeURIComponent(u)}`,
      );
      const byDay = Object.fromEntries(
        r.data.days.map((d) => [d.day_of_week, d]),
      );
      setDays(WEEKDAYS.map((w) => ({ ...w, ...byDay[w.day_of_week] })));
      const todayStr = new Date().toISOString().slice(0, 10);
      const av = await api.get(
        `/scheduling-config/availability?unit=${encodeURIComponent(u)}&date=${todayStr}`,
      );
      setToday(av.data);
    } catch (e) {
      toast.error(formatError(e?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unit) loadConfig(unit);
  }, [unit]);

  const updateDay = (dayOfWeek, field, value) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d,
      ),
    );
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
      toast.error(
        formatError(e?.response?.data?.detail) || "Erro ao cadastrar unidade",
      );
    } finally {
      setAddingUnit(false);
    }
  };

  const totalMax = useMemo(
    () => days.reduce((s, d) => s + (Number(d.max_online_slots) || 0), 0),
    [days],
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Gestão de agenda</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
            Vagas Online × Presencial
          </h1>
          <p className="text-slate-500 mt-1">
            Defina, por unidade e dia da semana, o percentual-alvo de consultas
            online e o número máximo de vagas online disponíveis. Essas regras
            são usadas no cadastro de novas consultas para bloquear
            automaticamente agendamentos online quando o limite diário for
            atingido.
          </p>
        </div>
      </div>

      {/* Seletor e Cadastro de Unidade Estilizados */}
      <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
        {/* Lado Esquerdo: Seleção da Unidade de Saúde */}
        <div className="flex flex-col justify-end min-w-[220px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 border-b border-slate-200 pb-1">
            Unidade de Saúde
          </span>
          <select
            data-testid="cv-unit-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={user?.role === "atendente"}
            className="text-lg font-bold text-[#1D3557] bg-transparent border-none outline-none cursor-pointer p-0 focus:ring-0 disabled:cursor-not-allowed"
          >
            {units.map((u) => (
              <option key={u} value={u} className="text-base font-normal text-slate-800">
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* Lado Direito: Formulário de Adicionar Nova Unidade */}
        {user?.role !== "atendente" && (
          <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Adicionar nova unidade
            </label>
            
            <div className="flex items-center gap-2">
              <input
                data-testid="cv-new-unit-input"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="Ex: UBS Zona Leste"
                className="px-3 py-1.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg outline-none transition-all placeholder:text-slate-400 focus:border-[#457B9D] focus:ring-2 focus:ring-[#457B9D]/20"
              />
              
              <button
                data-testid="cv-new-unit-add"
                onClick={addUnit}
                disabled={addingUnit || !newUnit.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-[#8291a1] hover:bg-[#1D3557] rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center min-w-[90px]"
              >
                {addingUnit ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Salvando
                  </span>
                ) : (
                  "Adicionar"
                )}
              </button>
            </div>
          </div>
        )}
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
                Hoje ({unit}):{" "}
                <strong className="text-[#1D3557]">
                  {today.used_online_slots}
                </strong>{" "}
                de{" "}
                <strong className="text-[#1D3557]">
                  {today.max_online_slots}
                </strong>{" "}
                vagas online já usadas
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
          <div className="p-10 text-center text-slate-400">
            Carregando configuração...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Dia da semana</th>
                <th className="text-left px-4 py-3">
                  % agendamentos (alvo)
                </th>
                <th className="text-left px-4 py-3">
                  Máx. vagas por agendamento no dia
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day_of_week} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-[#1D3557]">
                    {d.label}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        data-testid={`cv-pct-${d.day_of_week}`}
                        type="number"
                        min={0}
                        max={100}
                        value={d.online_percentage}
                        onChange={(e) =>
                          updateDay(
                            d.day_of_week,
                            "online_percentage",
                            e.target.value,
                          )
                        }
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
                      onChange={(e) =>
                        updateDay(
                          d.day_of_week,
                          "max_online_slots",
                          e.target.value,
                        )
                      }
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
          Total de vagas online/semana nesta unidade:{" "}
          <strong className="text-[#1D3557]">{totalMax}</strong>
        </div>
          <button
            data-testid="cv-save"
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1D3557] hover:bg-[#152742] text-white font-medium text-sm rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar configuração"}
          </button>
      </div>
    </div>
  );
}