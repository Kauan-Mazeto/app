import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Users, AlertTriangle, Heart, Pill, Package, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";

const COLORS = ["#1D3557", "#457B9D", "#E76F51", "#E9C46A", "#2A9D8F", "#8D99AE"];

export default function SecretarioDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboard/secretario").then(r => setD(r.data));
  }, []);

  if (!d) return <div className="p-8 text-slate-400">Carregando indicadores...</div>;

  const k = d.kpis;
  const attendData = [
    { name: "Compareceu", value: k.total_appointments - Math.round(k.total_appointments * k.absenteeism_rate / 100) },
    { name: "Faltas", value: Math.round(k.total_appointments * k.absenteeism_rate / 100) },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Gestão Municipal · SUS</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Painel de Indicadores</h1>
          <p className="text-slate-500 mt-1">Visão consolidada da rede municipal.</p>
        </div>
        <Link data-testid="link-auditoria" to="/secretario/auditoria" className="text-sm font-semibold text-[#1D3557] hover:underline">
          Auditoria de Receitas →
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Kpi label="Pacientes ativos" value={k.total_patients} icon={Users} />
        <Kpi label="Adesão" value={`${k.adherence_rate}%`} icon={Heart} accent="#1E4620" />
        <Kpi label="Absenteísmo" value={`${k.absenteeism_rate}%`} icon={AlertTriangle} accent="#E76F51" />
        <Kpi label="NPS" value={k.nps} icon={TrendingUp} accent="#457B9D" />
        <Kpi label="Receitas emitidas" value={k.total_prescriptions} icon={Pill} />
        <Kpi label="Consultas totais" value={k.total_appointments} icon={Users} />
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

        <Card title="Compareceu × Faltou (histórico)">
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
        <Card title="Previsão de demanda de medicamentos">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.med_demand} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#64748B" style={{ fontSize: 11 }} />
              <YAxis dataKey="medication" type="category" stroke="#64748B" style={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="patients" fill="#457B9D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Últimas ações do sistema">
          <div className="space-y-3">
            {(d.recent_activity || []).slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-[#1D3557]/10 flex items-center justify-center mt-0.5">
                  <ClipboardList className="w-4 h-4 text-[#1D3557]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1D3557]">{item.action}</div>
                  <div className="text-xs text-slate-500">{item.user_name} · {item.target}</div>
                  <div className="text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleString("pt-BR")}</div>
                </div>
              </div>
            ))}
          </div>
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

      <Card title="Ranking de unidades por eficiência (menor absenteísmo)">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="text-left py-2">#</th><th className="text-left py-2">Unidade</th><th className="text-left py-2">Consultas</th><th className="text-left py-2">Absenteísmo</th></tr>
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
