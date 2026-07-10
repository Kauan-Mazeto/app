import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const roleRedirect = {
  medico: "/medico",
  atendente: "/atendente",
  secretario: "/secretario",
  admin: "/admin",
};

const demoAccounts = [
  { role: "Médico", email: "medico@saudeconecta.gov.br" },
  { role: "Atendente", email: "atendente@saudeconecta.gov.br" },
  { role: "Secretário", email: "secretario@saudeconecta.gov.br" },
  { role: "Admin", email: "admin@saudeconecta.gov.br" },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success(`Bem-vindo(a), ${data.name}`);
      nav(roleRedirect[data.role] || "/");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fill = (em) => {
    setEmail(em);
    setPassword(em.startsWith("admin") ? "admin123" : "senha123");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between bg-[#1D3557] text-white p-14">
        <Link to="/" className="inline-flex items-center">
          <img
            src="/logoProjeto.png"
            alt="Saúde na palma da mão"
            className="h-20 w-auto object-contain"
          />
        </Link>

        <div>
          <div className="overline text-white/60 mb-3">Rede Municipal · SUS</div>
          <h2 className="font-display font-extrabold text-4xl leading-tight tracking-tight max-w-md">
            Acompanhamento clínico com validade jurídica e transparência.
          </h2>
          <p className="text-white/70 mt-6 max-w-sm">
            Painel de fila unificada, receitas digitais Gov.br e indicadores de
            gestão em tempo real.
          </p>
        </div>

        <div className="text-xs text-white/50">© {new Date().getFullYear()} Saúde na Palma da Mão - Todos os direitos reservados</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h1 className="font-display font-extrabold text-3xl text-[#1D3557]">Entrar</h1>

          <p className="text-sm text-slate-500 mt-1 mb-8">Acesse com seu email institucional.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email</label>
              <input
                data-testid="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Senha</label>
              <input
                data-testid="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]"
              />
            </div>

            <button
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full bg-[#1D3557] text-white py-2.5 rounded-md font-semibold hover:bg-[#152742] transition disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="overline mb-3">Contas de demonstração</div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((d) => (
                <button
                  key={d.email}
                  data-testid={`demo-${d.role.toLowerCase()}`}
                  onClick={() => fill(d.email)}
                  className="text-left text-xs border border-slate-200 hover:border-[#457B9D] rounded-md p-2 transition"
                >
                  <div className="font-semibold text-[#1D3557]">{d.role}</div>
                  <div className="text-slate-500 truncate">{d.email}</div>
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 mt-3">Senha: <b>senha123</b> (admin: <b>admin123</b>)</div>
          </div>
        </div>
      </div>
    </div>
  );
}