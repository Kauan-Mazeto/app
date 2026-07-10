import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Pill, LineChart, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(220,20%,97%)]">
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/logoProjeto.png"
              alt="Saúde na palma da mão"
              className="h-14 sm:h-16 w-auto object-contain"
            />  
          </div>
          <Link
            data-testid="header-login-btn"
            to="/login"
            className="text-sm font-semibold text-[#1D3557] hover:underline"
          >
            Entrar no sistema →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <div className="overline mb-4 text-[#457B9D]">
            Plataforma · Rede Municipal SUS
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1D3557] leading-[1.05] tracking-tight">
            Menos filas.
            <br />
            Mais adesão ao
            <br />
            <span className="text-[#E76F51]">tratamento contínuo.</span>
          </h1>
          <p className="mt-6 text-base text-slate-600 leading-relaxed max-w-lg">
            Um ERP integrado para médicos, atendentes e gestores da saúde
            pública acompanharem pacientes em uso de medicamentos controlados —
            com receitas digitais, painéis em tempo real e indicadores que
            resolvem gargalos reais do SUS.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              to="/login"
              data-testid="hero-cta-btn"
              className="inline-flex items-center gap-2 bg-[#1D3557] text-white px-6 py-3 rounded-md font-semibold hover:bg-[#152742] transition"
            >
              Acessar o sistema <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#recursos"
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-[#1D3557] px-6 py-3 rounded-md font-semibold hover:bg-slate-50 transition"
            >
              Conhecer recursos
            </a>
          </div>

          {/*<div className="mt-8 text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1E4620]" />
            Conformidade LGPD · Integração Gov.br (mock) · CID · TUSS · SIGTAP
          </div>
          */}
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-[#457B9D]/10 to-transparent rounded-2xl" />
          <img
            src="https://images.pexels.com/photos/668300/pexels-photo-668300.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Hospital"
            className="relative rounded-xl w-full aspect-[4/3] object-cover border border-slate-200"
          />
        </div>
      </section>

      {/* Feature grid */}
      <section id="recursos" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            {
              icon: Users,
              title: "4 perfis integrados",
              desc: "Médico, Atendente, Secretário e Admin em um único ERP.",
            },
            {
              icon: Pill,
              title: "Receita digital segura",
              desc: "Trava contra duplicidade + assinatura Gov.br.",
            },
            {
              icon: LineChart,
              title: "Dashboards gerenciais",
              desc: "Absenteísmo, adesão, NPS e previsão de demanda.",
            },
            {
              icon: ShieldCheck,
              title: "Auditoria completa",
              desc: "Log imutável de todas as ações críticas.",
            },
          ].map((f, i) => (
            <div key={i} className="sc-card">
              <f.icon className="w-6 h-6 text-[#457B9D] mb-3" />
              <div className="font-display font-bold text-[#1D3557]">
                {f.title}
              </div>
              <div className="text-sm text-slate-600 mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        SaúdeConecta · MVP · Sistema municipal de gestão de tratamentos
        contínuos
      </footer>
    </div>
  );
}
