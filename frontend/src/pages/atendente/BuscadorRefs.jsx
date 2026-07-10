import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Search } from "lucide-react";

const tabs = [
  { key: "cid", label: "CID-10", url: "/refs/cid" },
  { key: "tuss", label: "TUSS", url: "/refs/tuss" },
  { key: "sigtap", label: "SIGTAP", url: "/refs/sigtap" },
];

export default function BuscadorRefs() {
  const [tab, setTab] = useState("cid");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);

  const load = async () => {
    const t = tabs.find((t) => t.key === tab);
    const { data } = await api.get(`${t.url}?q=${encodeURIComponent(q)}`);
    setResults(data);
  };
  useEffect(() => {
    load();
  }, [tab, q]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="overline text-[#457B9D]">Ferramenta de apoio</div>
        <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
          Buscador Técnico
        </h1>
        <p className="text-slate-500 mt-1">
          CID-10 · TUSS · SIGTAP — códigos padronizados do SUS/ANS.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md font-semibold ${tab === t.key ? "bg-[#1D3557] text-white" : "bg-white border border-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sc-card">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            data-testid="ref-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar em ${tabs.find((t) => t.key === tab).label}...`}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm"
          />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-2">
            Mostrando {results.length} resultado(s)
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto p-2 rounded border border-slate-100 bg-white">
            {results.map((r) => (
              <div
                key={r.code}
                className="flex items-start gap-4 py-2 border-b border-slate-100 last:border-0"
              >
                <div className="font-mono-nums text-xs bg-slate-100 px-2 py-1 rounded font-bold text-[#1D3557]">
                  {r.code}
                </div>
                <div className="text-sm text-slate-700">{r.desc}</div>
              </div>
            ))}
            {results.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-6">
                Nenhum código encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
