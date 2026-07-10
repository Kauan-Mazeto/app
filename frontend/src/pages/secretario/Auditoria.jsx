import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Download } from "lucide-react";

const actionLabels = {
  "user.create": "Cadastro de usuário",
  "appointment.update": "Atualização de consulta",
  "health_unit.create": "Cadastro de unidade de saúde",
  "scheduling_config.update": "Atualização de agenda",
  "prescription.adherence": "Registro de adesão da receita",
  "prescription.create": "Criação de receita",
  "exam.request": "Solicitação de exame",
  "exam.status": "Atualização de status do exame",
  "stock.entry": "Entrada de estoque",
  "stock.exit": "Saída de estoque",
  "ai.insights": "Consulta com inteligência artificial",
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function getReadableSummary(log) {
  const details = log.details || {};
  const baseLabel = actionLabels[log.action] || "Ação registrada";

  switch (log.action) {
    case "stock.entry":
      return `${baseLabel} para o remédio ${details.medicineName || "selecionado"} na unidade ${details.unitName || details.unit || "selecionada"}.`;
    case "stock.exit":
      return `${baseLabel} para o remédio ${details.medicineName || "selecionado"} na unidade ${details.unitName || details.unit || "selecionada"}.`;
    case "user.create":
      return `${baseLabel} para ${details.name || details.role || "o novo usuário"}.`;
    case "health_unit.create":
      return `${baseLabel} com o nome ${details.name || "informado"}.`;
    case "appointment.update":
      return `${baseLabel} para ${details.patientName || details.patientId || "o paciente"}.`;
    case "prescription.create":
      return `${baseLabel} para ${details.patientName || details.patientId || "o paciente"}.`;
    case "prescription.adherence":
      return `${baseLabel} para ${details.patientName || details.patientId || "o paciente"}.`;
    case "exam.request":
      return `${baseLabel} para ${details.patientName || details.patientId || "o paciente"}.`;
    case "exam.status":
      return `${baseLabel} para ${details.status || "um novo valor"}.`;
    case "scheduling_config.update":
      return `${baseLabel} para ${details.unitName || details.unit || "a unidade"}.`;
    case "ai.insights":
      return `${baseLabel} com o filtro ${details.filtro || "informado"}.`;
    default:
      return `${baseLabel}${details.name ? ` para ${details.name}` : ""}${details.unit ? ` na unidade ${details.unit}` : ""}.`;
  }
}

function translateFieldName(key) {
  switch (key) {
    case "medicineId":
      return "ID do remédio";
    case "medicineName":
      return "Nome do remédio";
    case "quantity":
      return "Quantidade";
    case "dosage":
      return "Dosagem";
    case "lot":
      return "Lote";
    case "notes":
      return "Observações";
    case "healthUnitId":
      return "ID da unidade";
    case "unitName":
      return "Nome da unidade";
    case "unit":
      return "Unidade";
    case "patientName":
      return "Nome do paciente";
    case "patientId":
      return "ID do paciente";
    case "name":
      return "Nome";
    case "role":
      return "Perfil";
    case "status":
      return "Situação";
    case "filtro":
      return "Filtro";
    case "valor":
      return "Valor";
    case "createdAt":
      return "Criado em";
    default:
      return key;
  }
}

function getDetailItems(details) {
  if (!details || typeof details !== "object") return [];
  const ignored = ["timestamp", "action", "target", "summary", "message", "user"];
  return Object.entries(details)
    .filter(([key]) => !ignored.includes(key))
    .map(([key, value]) => [translateFieldName(key), value]);
}

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/audit-logs").then(r => setLogs(r.data)); }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return logs.filter((log) => {
      if (!term) return true;
      return [
        log.action,
        log.user_name,
        log.user_role,
        getReadableSummary(log),
        JSON.stringify(log.details || {}),
      ].join(" ").toLowerCase().includes(term);
    });
  }, [logs, q]);

  const exportJson = () => {
    const payload = filtered.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      user_name: log.user_name,
      user_role: log.user_role,
      action: log.action,
      summary: getReadableSummary(log),
      details: log.details || {},
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auditoria.json";
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="overline text-[#457B9D]">Log imutável</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">Auditoria</h1>
          <p className="text-slate-500 mt-1">Acompanhe as ações principais do sistema com mensagens mais claras e os dados completos de cada registro.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button data-testid="export-json" onClick={exportJson} className="bg-white border border-slate-200 px-4 py-2 rounded-md text-sm font-semibold text-[#1D3557]">
            <Download className="w-4 h-4 inline mr-1" /> Exportar JSON
          </button>
        </div>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por ação, usuário ou detalhes..."
        className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-md text-sm" />

      <div className="sc-card p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="text-left px-4 py-3">Data/Hora</th><th className="text-left px-4 py-3">Usuário</th><th className="text-left px-4 py-3">Ação</th><th className="text-left px-4 py-3">Resumo</th></tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const items = getDetailItems(log.details);
              const actionTone = log.action === "stock.entry"
                ? "bg-emerald-100 text-emerald-700"
                : log.action === "stock.exit"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-50 text-slate-700";

              return (
                <tr key={log.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-mono-nums text-xs text-slate-500">{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#1D3557]">{log.user_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{log.user_role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`rounded px-2 py-1 text-xs font-medium ${actionTone}`}>{log.action === "stock.entry" ? "Entrada de estoque" : log.action === "stock.exit" ? "Saída de estoque" : actionLabels[log.action] || log.action}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="font-semibold text-[#1D3557]">{getReadableSummary(log)}</div>
                    {items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {items.slice(0, 3).map(([key, value]) => (
                          <div key={key} className="text-slate-500">
                            <span className="font-medium text-slate-700">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[#457B9D]">Ver dados completos</summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] whitespace-pre-wrap text-slate-600">{JSON.stringify(log.details || {}, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-400">Nenhum registro.</td></tr>}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
