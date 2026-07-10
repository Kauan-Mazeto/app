import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AppLayout from "@/components/AppLayout";
import MedicoDashboard from "@/pages/medico/MedicoDashboard";
import Prontuario from "@/pages/medico/Prontuario";
import AtendenteDashboard from "@/pages/atendente/AtendenteDashboard";
import VagasOciosas from "@/pages/atendente/VagasOciosas";
import EntregaExames from "@/pages/atendente/EntregaExames";
import BuscadorRefs from "@/pages/atendente/BuscadorRefs";
import StockManagement from "@/pages/atendente/StockManagement";
import SecretarioDashboard from "@/pages/secretario/SecretarioDashboard";
import Auditoria from "@/pages/secretario/Auditoria";
import ConfiguracaoVagas from "@/pages/atendente/ConfiguracaoVagas";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import PrevisaoIa from "@/pages/secretario/PrevisaoIa";
import Feedbacks from "@/pages/secretario/Feedbacks";
import "./App.css";


const rolePath = {
  medico: "/medico",
  atendente: "/atendente",
  secretario: "/secretario",
  admin: "/admin",
};

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (user === null) return <div className="p-10 text-slate-500">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={rolePath[user.role] || "/"} replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return null;
  if (!user) return <Landing />;
  return <Navigate to={rolePath[user.role] || "/login"} replace />;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />

            {/* Rotas de Médico e Atendente */}
            <Route element={<Protected roles={["medico", "atendente"]}><AppLayout /></Protected>}>
              <Route path="/medico" element={<MedicoDashboard />} />
              <Route path="/medico/paciente/:id" element={<Prontuario />} />
              <Route path="/atendente/fila" element={<MedicoDashboard />} />
              <Route path="/atendente/refs" element={<BuscadorRefs />} />
            </Route>

            {/* Rotas exclusivas do Atendente */}
            <Route element={<Protected roles={["atendente"]}><AppLayout /></Protected>}>
              <Route path="/atendente" element={<AtendenteDashboard />} />
              <Route path="/atendente/vagas" element={<VagasOciosas />} />
              <Route path="/atendente/exames" element={<EntregaExames />} />
              <Route path="/atendente/refs" element={<BuscadorRefs />} />
              <Route path="/atendente/estoque" element={<StockManagement />} />
            </Route>

            {/* Rotas exclusivas do Secretário */}
            <Route element={<Protected roles={["secretario"]}><AppLayout /></Protected>}>
              <Route path="/secretario" element={<SecretarioDashboard />} />
              <Route path="/secretario/auditoria" element={<Auditoria />} />
              <Route path="/secretario/estoque" element={<StockManagement mode="secretario" />} />
              <Route path="/secretario/ia" element={<PrevisaoIa />} />
              <Route path="/secretario/Feedbacks" element={<Feedbacks />} />
            </Route>

            {/* Configuração de vagas online x presencial: acessível por Atendente e Secretário */}
            <Route element={<Protected roles={["atendente", "secretario"]}><AppLayout /></Protected>}>
              <Route path="/atendente/config-vagas" element={<ConfiguracaoVagas />} />
              <Route path="/secretario/config-vagas" element={<ConfiguracaoVagas />} />
            </Route>

            {/* Rotas exclusivas do Administrador */}
            <Route element={<Protected roles={["admin"]}><AppLayout /></Protected>}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            {/* Rota Padrão */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}


export default App;