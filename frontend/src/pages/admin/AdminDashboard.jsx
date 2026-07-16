import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff, Search } from "lucide-react";
import { SPECIALTIES } from "@/lib/specialties";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", password: "", role: "medico", crm: "", specialty: "", unit: "UBS Central" });
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const [showSpecialtyOptions, setShowSpecialtyOptions] = useState(false);

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/users", nu);
      toast.success("Profissional cadastrado");
      setShow(false);
      setNu({ name: "", email: "", password: "", role: "medico", crm: "", specialty: "", unit: "UBS Central" });
      setSpecialtyQuery("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro");
    }
  };

  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("Todas as unidades");
  const [activeTab, setActiveTab] = useState("medico");

  const grouped = users.reduce((acc, u) => { (acc[u.role] = acc[u.role] || []).push(u); return acc; }, {});
  const roleTitles = { medico: "Médicos", atendente: "Atendentes", secretario: "Secretários", admin: "Administradores" };
  const roleOrder = ["medico", "atendente", "secretario", "admin"];
  const units = [
    "Todas as unidades",
    ...Array.from(new Set(users.map((u) => u.unit).filter(Boolean))),
  ];

  const filteredUsers = (grouped[activeTab] || []).filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesText = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesUnit = unitFilter === "Todas as unidades" || u.unit === unitFilter;
    return matchesText && matchesUnit;
  });

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

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email"
            className="inp w-full"
          />
        </div>
        <div className="w-full md:w-64">
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="inp w-full"
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {roleOrder.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setActiveTab(role)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === role ? "bg-[#1D3557] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {roleTitles[role]} ({grouped[role]?.length || 0})
          </button>
        ))}
      </div>

      <div className="sc-card">
        <h2 className="font-display font-bold text-lg text-[#1D3557] mb-4">{roleTitles[activeTab]} <span className="text-slate-400 text-sm">({grouped[activeTab]?.length || 0})</span></h2>
        {filteredUsers.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Nenhum profissional encontrado com esses filtros
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {filteredUsers.map((u) => (
              <div key={u.id} className="border border-slate-200 rounded-md p-3">
                <div className="font-semibold text-[#1D3557]">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
                {u.crm && <div className="text-xs text-slate-500 mt-1">{u.crm} · {u.specialty}</div>}
                {u.unit && <div className="text-[11px] text-[#457B9D] font-semibold mt-1">{u.unit}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-extrabold text-xl text-[#1D3557] mb-4">Novo Profissional</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nome"><input data-testid="nu-name" value={nu.name} onChange={(e) => setNu({...nu, name: e.target.value})} className="inp" /></F>
              <F label="Email"><input data-testid="nu-email" value={nu.email} onChange={(e) => setNu({...nu, email: e.target.value})} className="inp" /></F>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">Senha</label>
                <div className="relative">
                  <input
                    data-testid="nu-password"
                    type={showPassword ? "text" : "password"}
                    value={nu.password}
                    onChange={(e) => setNu({...nu, password: e.target.value})}
                    className="inp pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">Senha temporária. O profissional deve trocá-la no primeiro acesso.</div>
              </div>
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
                <F label="Especialidade">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      data-testid="nu-specialty"
                      value={nu.specialty ? nu.specialty : specialtyQuery}
                      onChange={(e) => {
                        setSpecialtyQuery(e.target.value);
                        setNu({ ...nu, specialty: "" });
                        setShowSpecialtyOptions(true);
                      }}
                      onFocus={() => {
                        if (nu.specialty) { setSpecialtyQuery(nu.specialty); setNu({ ...nu, specialty: "" }); }
                        setShowSpecialtyOptions(true);
                      }}
                      placeholder="Buscar especialidade..."
                      className="inp pl-9"
                      autoComplete="off"
                    />
                    {showSpecialtyOptions && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                        {SPECIALTIES.filter((s) =>
                          s.toLowerCase().includes(specialtyQuery.trim().toLowerCase())
                        ).map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => {
                              setNu({ ...nu, specialty: s });
                              setSpecialtyQuery("");
                              setShowSpecialtyOptions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            {s}
                          </button>
                        ))}
                        {SPECIALTIES.filter((s) =>
                          s.toLowerCase().includes(specialtyQuery.trim().toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-400">
                            Nenhuma especialidade encontrada.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </F>
              </>}
              <F label="Unidade"><input value={nu.unit} onChange={(e) => setNu({...nu, unit: e.target.value})} className="inp" /></F>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => setNu((current) => ({ ...current, password: generatePassword(12) }))}
                className="px-4 py-2 border border-slate-200 rounded-md text-sm"
              >
                Gerar senha temporária
              </button>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShow(false)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancelar</button>
              <button
                data-testid="nu-submit"
                onClick={save}
                disabled={!nu.name || !nu.email || !nu.password || (nu.role === "medico" && (!nu.crm || !SPECIALTIES.includes(nu.specialty)))}
                className="px-4 py-2 bg-[#1D3557] text-white rounded-md text-sm font-semibold disabled:opacity-50"
              >
                Cadastrar
              </button>
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

function generatePassword(length = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}