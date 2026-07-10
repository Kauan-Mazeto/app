import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Users, AlertTriangle, Heart, Pill, Package } from "lucide-react";
import { Link } from "react-router-dom";

export default function SecretarioDashboard() {
  const [d, setD] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [stockView, setStockView] = useState("day");

  useEffect(() => {
    api.get("/dashboard/secretario").then(r => setD(r.data));
    api.get("/stock/transactions").then(r => setStockMovements(r.data));
  }, []);

  if (!d) return <div className="p-8 text-slate-400">Carregando indicadores...</div>;

  const k = d.kpis;
  const attendData = [
    { name: "Compareceu", value: k.total_appointments - Math.round(k.total_appointments * k.absenteeism_rate / 100) },
    { name: "Faltas", value: Math.round(k.total_appointments * k.absenteeism_rate / 100) },
  ];

  const stockSeries = (() => {
    const normalized = stockMovements.map((item) => ({
      ...item,
      type: String(item.type || "").toLowerCase(),
      quantity: Number(item.quantity || 0),
      createdAt: item.createdAt ? new Date(item.createdAt) : null,
      unit: item.unit || "Sem unidade",
    }));

    if (stockView === "unit") {
      const grouped = {};
      normalized.forEach((item) => {
        if (!item.createdAt || Number.isNaN(item.createdAt.getTime())) return;
        const unit = item.unit || "Sem unidade";
        grouped[unit] ??= { label: unit, entradas: 0, saidas: 0 };
        if (item.type === "entry") grouped[unit].entradas += item.quantity;
        if (item.type === "exit") grouped[unit].saidas += item.quantity;
      });
      return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        entradas: 0,
        saidas: 0,
      };
    });

    normalized.forEach((item) => {
      if (!item.createdAt || Number.isNaN(item.createdAt.getTime())) return;
      const key = item.createdAt.toISOString().slice(0, 10);
      const bucket = days.find((day) => day.key === key);
      if (!bucket) return;
      if (item.type === "entry") bucket.entradas += item.quantity;
      if (item.type === "exit") bucket.saidas += item.quantity;
    });

    return days;
  })();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Gestão Municipal · SUS</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Painel de Indicadores</h1>
          <p className="text-slate-500 mt-1">Visão consolidada da rede municipal.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Kpi label="Pacientes ativos" value={k.total_patients} icon={Users} />
        <Kpi label="Adesão" value={`${k.adherence_rate}%`} icon={Heart} accent="#1E4620" />
        <Kpi label="Índice de faltas" value={`${k.absenteeism_rate}%`} icon={AlertTriangle} accent="#E76F51" />
        <Kpi label="Índice de Satisfação" value={k.nps} icon={TrendingUp} accent="#457B9D" />
        <Kpi label="Receitas emitidas" value={k.total_prescriptions} icon={Pill} />
        <Kpi label="Total de consultas" value={k.total_appointments} icon={Users} />
        <Kpi label="Exames pendentes" value={k.exams_pending} icon={Package} accent="#E9C46A" />
        <Kpi label="Exames p/ retirar" value={k.exams_abandoned} icon={Package} accent="#E76F51" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Tendência semanal · Consultas">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.weekly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} stroke="#64748B" style={{ fontSize: 11 }} />
              <YAxis stroke="#64748B" style={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="compareceu" stroke="#1D3557" strokeWidth={2.5} name="Compareceu" />
              <Line type="monotone" dataKey="faltas" stroke="#E76F51" strokeWidth={2.5} name="Faltas" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Comparecimento × Faltas">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={attendData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={55} paddingAngle={2}>
                {attendData.map((_, i) => <Cell key={i} fill={i === 0 ? "#1D3557" : "#E76F51"} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Previsão de demanda de medicamentos com base no consumo mensal">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.med_demand} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#64748B" style={{ fontSize: 11 }} />
              <YAxis dataKey="medication" type="category" stroke="#64748B" style={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="patients" name="Pacientes" fill="#457B9D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Mapa de gargalos · Absenteísmo por especialidade">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.by_specialty}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="specialty" stroke="#64748B" style={{ fontSize: 11 }} />
              <YAxis stroke="#64748B" style={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="absenteeism" fill="#E76F51" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Ranking de unidades de saúde por eficiência no atendimento">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="text-left py-2">#</th><th className="text-left py-2">Unidade</th><th className="text-left py-2">Consultas</th><th className="text-left py-2">Porcentagem de faltas</th></tr>
          </thead>
          <tbody>
            {d.unit_ranking.map((u, i) => (
              <tr key={u.unit} className="border-t border-slate-100">
                <td className="py-3 font-mono-nums text-slate-500">{i + 1}</td>
                <td className="py-3 font-semibold text-[#1D3557]">{u.unit}</td>
                <td className="py-3">{u.total}</td>
                <td className="py-3">
                  <span className={`font-mono-nums font-bold ${u.absenteeism < 15 ? "text-[#1E4620]" : u.absenteeism < 25 ? "text-[#E9C46A]" : "text-[#E76F51]"}`}>
                    {u.absenteeism}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6">
        <Card title="Fluxo de estoque · Entradas e saídas">
          <div className="flex justify-end mb-3">
            <div className="inline-flex rounded-full border border-slate-200 p-1 bg-slate-50">
              <button type="button" onClick={() => setStockView("day")} className={`rounded-full px-3 py-1 text-xs font-semibold ${stockView === "day" ? "bg-[#1D3557] text-white" : "text-slate-600"}`}>
                Por dia
              </button>
              <button type="button" onClick={() => setStockView("unit")} className={`rounded-full px-3 py-1 text-xs font-semibold ${stockView === "unit" ? "bg-[#1D3557] text-white" : "text-slate-600"}`}>
                Por unidade
              </button>
            </div>
          </div>
          {stockSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stockSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" stroke="#64748B" style={{ fontSize: 11 }} />
                <YAxis stroke="#64748B" style={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#1D3557" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#E76F51" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">Ainda não há movimentações de estoque para exibir.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent = "#1D3557" }) {
  return (
    <div className="sc-card">
      <div className="flex justify-between items-start">
        <div>
          <div className="overline">{label}</div>
          <div className="font-display text-2xl font-extrabold mt-2" style={{ color: accent }}>{value}</div>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="sc-card">
      <h3 className="font-display font-bold text-lg text-[#1D3557] mb-4">{title}</h3>
      {children}
    </div>
  );
}
