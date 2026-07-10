import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Brain, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";

const TIPOS_FILTRO = [
    { value: "estacao", label: "Estacao do Ano" },
    { value: "medicamento", label: "Medicamento" },
    { value: "paciente", label: "Paciente" },
    { value: "unidade", label: "Unidade de Saude" },
    { value: "especialidade", label: "Especialidade" },
    { value: "medico", label: "Medico" },
];

const ESTACOES = [
    { value: "verao", label: "Verao (Dez-Jan-Fev)" },
    { value: "outono", label: "Outono (Mar-Abr-Mai)" },
    { value: "inverno", label: "Inverno (Jun-Jul-Ago)" },
    { value: "primavera", label: "Primavera (Set-Out-Nov)" },
];

const ESPECIALIDADES = [
    "Clinica Geral", "Pediatria", "Ginecologia", "Cardiologia",
    "Ortopedia", "Psiquiatria", "Neurologia", "Dermatologia", "Oftalmologia", "Endocrinologia",
];

const IMPACTO_COLOR = { alto: "text-[#E76F51]", medio: "text-[#E9C46A]", baixo: "text-[#1E4620]" };
const CONFIANCA_COLOR = { alta: "text-[#1E4620]", media: "text-[#457B9D]", baixa: "text-[#E9C46A]" };

export default function PrevisaoIA() {
    const [tipoFiltro, setTipoFiltro] = useState("estacao");
    const [valor, setValor] = useState("");
    const [opcoes, setOpcoes] = useState({ medicamentos: [], pacientes: [], medicos: [], unidades: [] });
    const [resultado, setResultado] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingOpcoes, setLoadingOpcoes] = useState(true);

    useEffect(() => {
        api.get("/ai/opcoes").then(r => setOpcoes(r.data)).finally(() => setLoadingOpcoes(false));
    }, []);

    useEffect(() => { setValor(""); setResultado(null); }, [tipoFiltro]);

    async function analisar() {
        if (!valor) return toast.error("Selecione um valor para o filtro");
        try {
            setLoading(true); setResultado(null);
            const { data } = await api.post("/ai/insights", { filtro: tipoFiltro, valor });
            setResultado(data.data);
        } catch (e) {
            toast.error(e.response?.data?.detail || "Erro ao consultar IA");
        } finally { setLoading(false); }
    }

    function renderValorInput() {
        if (tipoFiltro === "estacao") return (
            <select value={valor} onChange={e => setValor(e.target.value)} className="inp">
                <option value="">Selecionar estacao...</option>
                {ESTACOES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
        );

        if (tipoFiltro === "especialidade") return (
            <select value={valor} onChange={e => setValor(e.target.value)} className="inp">
                <option value="">Selecionar especialidade...</option>
                {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
        );

        if (tipoFiltro === "medicamento") return (
            <select value={valor} onChange={e => setValor(e.target.value)} className="inp">
                <option value="">Selecionar medicamento...</option>
                {opcoes.medicamentos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        );

        if (tipoFiltro === "unidade") return (
            <select value={valor} onChange={e => setValor(e.target.value)} className="inp">
                <option value="">Selecionar unidade...</option>
                {opcoes.unidades.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
        );

        if (tipoFiltro === "paciente") return (
            <select value={valor} onChange={e => setValor(e.target.value)} className="inp">
                <option value="">Selecionar paciente...</option>
                {opcoes.pacientes.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
        );

        if (tipoFiltro === "medico") return (
            <select value={valor} onChange={e => setValor(e.target.value)} className="inp">
                <option value="">Selecionar medico...</option>
                {opcoes.medicos.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <div className="overline text-[#457B9D]">Inteligencia Artificial · Analise</div>
                <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Previsao e Padroes</h1>
                <p className="text-slate-500 mt-1">Analise de padroes e previsao de demanda baseada nos dados reais do sistema.</p>
            </div>

            {/* Painel de filtros */}
            <div className="sc-card mb-6">
                <h3 className="font-display font-bold text-base text-[#1D3557] mb-4">Configurar Analise</h3>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo de Filtro">
                        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="inp">
                            {TIPOS_FILTRO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Valor">
                        {loadingOpcoes
                            ? <div className="inp text-slate-400 text-sm">Carregando opcoes...</div>
                            : renderValorInput()
                        }
                    </Field>
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={analisar} disabled={loading || !valor} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                        {loading ? "Analisando..." : "Analisar com IA"}
                    </button>
                </div>
            </div>

            {!resultado && !loading && (
                <div className="sc-card py-20 text-center">
                    <Brain className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="font-display font-bold text-lg text-[#1D3557]">Pronto para analisar</p>
                    <p className="text-slate-400 text-sm mt-1">Selecione o tipo de filtro, escolha o valor e clique em Analisar.</p>
                </div>
            )}

            {loading && (
                <div className="sc-card py-20 text-center">
                    <RefreshCw className="w-10 h-10 text-[#457B9D] mx-auto mb-4 animate-spin" />
                    <p className="font-display font-bold text-lg text-[#1D3557]">Analisando dados...</p>
                    <p className="text-slate-400 text-sm mt-1">A IA esta processando os padroes. Aguarde alguns segundos.</p>
                </div>
            )}

            {resultado && (
                <div className="space-y-6">
                    <div className="sc-card border-l-4 border-[#457B9D]">
                        <div className="overline text-[#457B9D] mb-2">Resumo da Analise</div>
                        <p className="text-[#1D3557] font-medium">{resultado.resumo}</p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <div className="sc-card">
                            <h3 className="font-display font-bold text-lg text-[#1D3557] mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-[#457B9D]" /> Padroes Identificados
                            </h3>
                            <div className="space-y-4">
                                {resultado.padroes?.map((p, i) => (
                                    <div key={i} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-sm text-[#1D3557]">{p.titulo}</span>
                                            <span className={`text-xs font-bold uppercase ${IMPACTO_COLOR[p.impacto]}`}>{p.impacto}</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{p.descricao}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="sc-card">
                            <h3 className="font-display font-bold text-lg text-[#1D3557] mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-[#E9C46A]" /> Previsoes
                            </h3>
                            <div className="space-y-4">
                                {resultado.previsoes?.map((p, i) => (
                                    <div key={i} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-sm text-[#1D3557]">{p.periodo}</span>
                                            <span className={`text-xs font-bold uppercase ${CONFIANCA_COLOR[p.confianca]}`}>confianca {p.confianca}</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{p.descricao}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="sc-card">
                        <h3 className="font-display font-bold text-lg text-[#1D3557] mb-4 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-[#E9C46A]" /> Recomendacoes
                        </h3>
                        <div className="grid lg:grid-cols-2 gap-4">
                            {resultado.recomendacoes?.map((r, i) => (
                                <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                                    <div className="font-semibold text-sm text-[#1D3557] mb-1">{r.titulo}</div>
                                    <p className="text-xs text-slate-500">{r.descricao}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .inp { width: 100%; padding: .5rem .75rem; border: 1px solid #E2E8F0; border-radius: .375rem; font-size: .875rem; background: #fff; }
        .btn-primary { background: #1D3557; color: #fff; padding: .5rem 1rem; border-radius: .375rem; font-weight: 600; font-size: .875rem; cursor: pointer; }
      `}</style>
        </div>
    );
}

function Field({ label, children }) {
    return <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">{label}</label>{children}</div>;
}