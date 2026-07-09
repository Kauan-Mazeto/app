import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Activity,
  BarChart3,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  UserCog,
  Search,
  Bell,
  Pill,
  Package,
  Clock,
  Users,
  Calendar,
  FileText,
  ListChecks
} from "lucide-react";

const navByRole = {
  medico: [
    { to: "/medico", label: "Fila do Dia", icon: LayoutDashboard, end: true },
  ],
  atendente: [
    {
      to: "/atendente",
      label: "Agenda & Pacientes",
      icon: LayoutDashboard,
      end: true,
    },
    { to: "/atendente/vagas", label: "Vagas Ociosas", icon: Bell },
    { to: "/atendente/exames", label: "Entrega de Exames", icon: Package },
    { to: "/atendente/refs", label: "CID / TUSS / SIGTAP", icon: Search },
  ],
  secretario: [
    { to: "/secretario", label: "Indicadores", icon: BarChart3, end: true },
    { to: "/secretario/auditoria", label: "Auditoria", icon: ShieldCheck },
  ],
  admin: [{ to: "/admin", label: "Profissionais", icon: UserCog, end: true }],
};

const roleLabel = {
  medico: "Médico(a)",
  atendente: "Atendente",
  secretario: "Secretário(a) de Saúde",
  admin: "Administrador",
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const links = navByRole[user.role] || [];

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen flex bg-[hsl(220,20%,97%)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#1D3557] text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center">
            <img
              src="/logoProjeto.png"
              alt="Saúde na palma da mão"
              className="h-20 w-auto object-contain"
            />
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                data-testid={`nav-${l.to.replace(/\//g, "-")}`}
                className={({ isActive }) =>
                  `sc-nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{l.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-white/60 mb-3">
            {roleLabel[user.role]}
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-sm text-white/80 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
