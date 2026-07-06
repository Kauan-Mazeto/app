import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", password: "senha123", role: "medico", crm: "", specialty: "", unit: "UBS Central" });

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/users", nu);
      toast.success("Profissional cadastrado");
      setShow(false); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro");
    }
  };

  const grouped = users.reduce((acc, u) => { (acc[u.role] = acc[u.role] || []).push(u); return acc; }, {});
  const roleTitles = { medico: "Médicos", atendente: "Atendentes", secretario: "Secretários", admin: "Administradores" };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Gestão de acesso</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Profissionais da Rede</h1>
        </div>
        <button data-testid="new-user-btn" onClick={() => setShow(true)} className="bg-[#1D3557] text-white px-4 py-2 rounded-md text-sm font-semibold">
          <UserPlus className="w-4 h-4 inline mr-1" /> Cadastrar profissional
        </button>
      </div>

      <div className="grid gap-6">
        {["medico", "atendente", "secretario", "admin"].map(r => (
          <div key={r} className="sc-card">
            <h2 className="font-display font-bold text-lg text-[#1D3557] mb-4">{roleTitles[r]} <span className="text-slate-400 text-sm">({grouped[r]?.length || 0})</span></h2>
            <div className="grid md:grid-cols-3 gap-3">
              {(grouped[r] || []).map(u => (
                <div key={u.id} className="border border-slate-200 rounded-md p-3">
                  <div className="font-semibold text-[#1D3557]">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  {u.crm && <div className="text-xs text-slate-500 mt-1">{u.crm} · {u.specialty}</div>}
                  {u.unit && <div className="text-[11px] text-[#457B9D] font-semibold mt-1">{u.unit}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-extrabold text-xl text-[#1D3557] mb-4">Novo Profissional</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nome"><input data-testid="nu-name" value={nu.name} onChange={(e) => setNu({...nu, name: e.target.value})} className="inp" /></F>
              <F label="Email"><input data-testid="nu-email" value={nu.email} onChange={(e) => setNu({...nu, email: e.target.value})} className="inp" /></F>
              <F label="Senha"><input value={nu.password} onChange={(e) => setNu({...nu, password: e.target.value})} className="inp" /></F>
              <F label="Perfil">
                <select data-testid="nu-role" value={nu.role} onChange={(e) => setNu({...nu, role: e.target.value})} className="inp">
                  <option value="medico">Médico</option>
                  <option value="atendente">Atendente</option>
                  <option value="secretario">Secretário</option>
                  <option value="admin">Admin</option>
                </select>
              </F>
              {nu.role === "medico" && <>
                <F label="CRM"><input value={nu.crm} onChange={(e) => setNu({...nu, crm: e.target.value})} className="inp" /></F>
                <F label="Especialidade"><input value={nu.specialty} onChange={(e) => setNu({...nu, specialty: e.target.value})} className="inp" /></F>
              </>}
              <F label="Unidade"><input value={nu.unit} onChange={(e) => setNu({...nu, unit: e.target.value})} className="inp" /></F>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShow(false)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancelar</button>
              <button data-testid="nu-submit" onClick={save} className="px-4 py-2 bg-[#1D3557] text-white rounded-md text-sm font-semibold">Cadastrar</button>
            </div>
          </div>
        </div>
      )}
      <style>{`.inp { width: 100%; padding: .5rem .75rem; border: 1px solid #E2E8F0; border-radius: .375rem; font-size: .875rem; }`}</style>
    </div>
  );
}

function F({ label, children }) {
  return <div><label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">{label}</label>{children}</div>;
}
