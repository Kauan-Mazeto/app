import { Link } from "react-router-dom";
import { Activity, ArrowRight, ShieldCheck, Pill, LineChart, Users } from "lucide-react"
import { useState } from "react";

export default function Landing() {
  const dobraDeImagens = [
    {src: "/images/filas.jpg", alt: "Pessoas enfrentando fila em um posto de saúde"},
    {src: "/images/pessoasNaFila.jpg", alt: "Pessoas enfrentando fila em um posto de saúde"},
    {src: "/images/pessoasNaFilaSaude.jpg", alt: "Pessoas enfrentando fila em um posto de saúde"},
    {src: "/images/moradoresCobrandoMelhoria.jfif", alt: "Pessoas enfrentando fila em um posto de saúde"}
  ]
  const [indiceAtual, setIndiceAtual] = useState(0);

  const irParaProxima = () => {
    setIndiceAtual((prevIndice) => 
      prevIndice === dobraDeImagens.length - 1 ? 0 : prevIndice + 1
    );
  };

  const irParaAnterior = () => {
    setIndiceAtual((prevIndice) => 
      prevIndice === 0 ? dobraDeImagens.length - 1 : prevIndice - 1
    );
  };
  return (
    <div className="min-h-screen bg-[hsl(220,20%,97%)]">
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#1D3557]" strokeWidth={2.5} />
            <span className="font-display font-extrabold text-lg text-[#1D3557]">Saúde Na Palma Da Mão</span>
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
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-13 items-center">
        <div>
          <h1 className="font-display text-4xl sm:text-4xl lg:text-6xl font-extrabold text-[#1D3557] leading-[1.05] tracking-tight">
            Menos filas e<br />
            <span className="text-[#E76F51]">desperdícios.</span><br />
            Mais adesão ao<br />
            <span className="text-[#E76F51]">tratamento contínuo.</span>
          </h1>
          <p className="mt-6 text-base text-slate-600 leading-relaxed max-w-lg">
            Essa não é apenas uma aplicação técnica. É uma solução que inspira esperança, economizando recursos públicos, otimizando processos no SUS e demonstrando como o conhecimento técnico pode gerar impacto real na comunidade, melhorando a qualidade de vida dos pacientes e o dia a dia dos profissionais de saúde.
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
            Em conformidade com a LGPD · Integração Gov.br para segurança dos dados
          </div>
          */}
        </div>

        <div className="relative group  ">
          <div className="absolute -inset-4 bg-gradient-to-br from-[#457B9D]/10 to-transparent rounded-2xl" />
            <img
              src={dobraDeImagens[indiceAtual].src}
              alt={dobraDeImagens[indiceAtual].alt}
              className="relative rounded-xl w-full aspect-[4/3] object-cover border border-slate-200 transition-all duration-300"
            />
            <button
              onClick={irParaAnterior}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Imagem anterior"
            >
              ❮
            </button>
            
            <button
              onClick={irParaProxima}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Próxima imagem"
            >
              ❯
            </button>
        </div>
      </section>

      {/* Feature grid */}
      <section id="recursos" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { icon: Users, title: "3 perfis integrados", desc: "Médico, Atendente, Secretário em um único sistema." },
            { icon: LineChart, title: "Dashboards gerenciais", desc: "Gargalos, adesão aos tratamentos, NPS e previsões de demandas." },
            { icon: ShieldCheck, title: "Auditoria completa", desc: "Log imutável de todas as ações críticas." },
            { icon: Pill, title: "Segurança e privacidade", desc: "Proteção dos dados sensíveis e controles de acesso." },

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
<<<<<<< HEAD
        Saúde Na Palma Da Mão · Sistema integrado usando aplicação mobile e web com o objetivo de reduzir filas e desperdícios de recursos públicos

=======
        Saúde na Palma da Mão · Sistema municipal de gestão de tratamentos
        contínuos
>>>>>>> 3b37b68451116ef223610a92153af4241f906b3f
      </footer>
    </div>
  );
}
