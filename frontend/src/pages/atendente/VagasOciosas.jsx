import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bell, Clock } from "lucide-react";

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function VagasOciosas() {
  const [vacs, setVacs] = useState([]);
  const [wl, setWl] = useState([]);
  const [tick, setTick] = useState(0);

  const load = async () => {
    const v = await api.get("/vacancies/active");
    setVacs(v.data);
    const w = await api.get("/waiting-list");
    setWl(w.data);
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    const r = setInterval(load, 30000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="overline text-[#457B9D]">Fila em tempo real</div>
        <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
          Painel de Vagas Ociosas
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active notifications */}
        <div>
          <h2 className="overline mb-2">Notificações Ativas</h2>
          {vacs.length === 0 && (
            <div className="sc-card text-sm text-slate-400 text-center py-10">
              Nenhuma vaga em disparo no momento.
            </div>
          )}
          <div className="space-y-3">
            {vacs.map((v) => {
              const remaining = Math.max(0, v.remaining_seconds - (tick - 0));
              const critical = remaining < 300;
              return (
                <div
                  key={v.id}
                  className={`sc-card border-l-4 ${critical ? "border-l-[#E76F51] pulse-alert" : "border-l-[#457B9D]"}`}
                  data-testid={`vacancy-${v.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="overline text-[#457B9D] mb-1">
                        <Bell className="w-3 h-3 inline mr-1" /> Aguardando
                        resposta
                      </div>
                      <div className="font-display font-bold text-lg text-[#1D3557]">
                        {v.patient_name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {v.specialty} · {v.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="overline mb-1">
                        <Clock className="w-3 h-3 inline" /> Tempo restante
                      </div>
                      <div
                        className={`font-mono-nums text-3xl font-extrabold ${critical ? "text-[#E76F51]" : "text-[#1D3557]"}`}
                      >
                        {formatTime(remaining)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waiting list */}
        <div>
          <h2 className="overline mb-2">Fila de Espera</h2>
          <div className="sc-card p-0 overflow-hidden">
            {wl.length === 0 ? (
              <div className="p-8 text-sm text-slate-400 text-center">
                Fila vazia
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Paciente</th>
                    <th className="text-left px-4 py-3">Especialidade</th>
                  </tr>
                </thead>
                <tbody>
                  {wl.map((w, i) => (
                    <tr key={w.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono-nums text-slate-500">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {w.patient?.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {w.specialty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
