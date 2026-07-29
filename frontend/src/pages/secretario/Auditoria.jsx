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
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeDetails(details) {
  if (!details) return {};
  if (typeof details === "string") {
    const trimmed = details.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof details === "object" && !Array.isArray(details)) return details;
  return {};
}

function tryParseJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function getReadableSummary(log) {
  const details = normalizeDetails(log.details);
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

function formatScheduleDay(value) {
  const numeric = Number(value);
  switch (numeric) {
    case 0: return "Domingo";
    case 1: return "Segunda";
    case 2: return "Terça";
    case 3: return "Quarta";
    case 4: return "Quinta";
    case 5: return "Sexta";
    case 6: return "Sábado";
    default: return "";
  }
}

function formatScheduleDays(days) {
  if (!Array.isArray(days)) return "";
  const formatted = days
    .map((day) => {
      const value =
        typeof day === "object" && day !== null
          ? day.day_of_week ?? day.dayOfWeek ?? day.day ?? day.value
          : day;
      const label = formatScheduleDay(value);
      if (label) return label;
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean);
  return formatted.join(", ");
}

function translateFieldName(key) {
  const map = {
    medicineId: "ID do remédio",
    medicineName: "Nome do remédio",
    quantity: "Quantidade",
    dosage: "Dosagem",
    lot: "Lote",
    notes: "Observações",
    healthUnitId: "ID da unidade",
    unitName: "Nome da unidade",
    unit: "Unidade",
    patientName: "Nome do paciente",
    patientId: "ID do paciente",
    name: "Nome",
    role: "Perfil",
    status: "Situação",
    filtro: "Filtro",
    valor: "Valor",
    days: "Dias",
    createdAt: "Criado em",
    updatedAt: "Atualizado em",
    email: "E-mail",
    phone: "Telefone",
    cpf: "CPF",
    crm: "CRM",
    specialty: "Especialidade",
    doctorName: "Nome do médico",
    doctorCrm: "CRM do médico",
    createdBy: "Criado por",
  };
  return map[key] || key;
}

function renderDetailValue(value) {
  if (value == null) return "—";
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== null) return renderDetailValue(parsed);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((item) => typeof item === "object" && item !== null)) {
      return value
        .map((item) => {
          const raw = item.day_of_week ?? item.dayOfWeek ?? item.day ?? item.value;
          const label = formatScheduleDay(raw);
          return label || renderDetailValue(item);
        })
        .join(" • ");
    }
    return value.map((item) => renderDetailValue(item)).join(" • ");
  }
  if (typeof value === "object") {
    if (value.day_of_week != null || value.dayOfWeek != null || value.day != null) {
      return formatScheduleDays([value]);
    }
    if (Object.keys(value).length === 0) return "—";
    return Object.entries(value)
      .map(([key, nestedValue]) => `${translateFieldName(key)}: ${renderDetailValue(nestedValue)}`)
      .join(" • ");
  }
  return String(value);
}

function getDetailItems(details) {
  if (!details) return [];
  if (typeof details === "string") {
    const parsed = tryParseJson(details);
    if (parsed !== null) return getDetailItems(parsed);
    return [["Detalhes", details]];
  }
  if (Array.isArray(details)) {
    return details.map((value, index) => [`Item ${index + 1}`, renderDetailValue(value)]);
  }
  if (typeof details !== "object") return [];
  const ignored = ["timestamp", "action", "target", "summary", "message", "user"];
  return Object.entries(details)
    .filter(([key]) => !ignored.includes(key))
    .map(([key, value]) => [translateFieldName(key), renderDetailValue(value)]);
}

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/audit-logs").then((r) => setLogs(r.data));
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return logs.filter((log) => {
      if (!term) return true;
      return [
        log.action,
        log.user_name,
        log.user_role,
        getReadableSummary(log),
        JSON.stringify(normalizeDetails(log.details) || {}),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
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
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auditoria.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="overline text-[#457B9D]">Logs imutável</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
            Auditoria
          </h1>
          <p className="text-slate-500 mt-1">
            Acompanhe as ações principais do sistema com mensagens mais claras e os dados completos de cada registro.
          </p>
        </div>
        <button
          data-testid="export-json"
          onClick={exportJson}
          className="bg-white border border-slate-200 px-4 py-2 rounded-md text-sm font-semibold text-[#1D3557]"
        >
          <Download className="w-4 h-4 inline mr-1" /> Exportar JSON
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrar por ação, usuário ou detalhes..."
        className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-md text-sm"
      />

      <div className="sc-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Data/Hora</th>
              <th className="text-left px-4 py-3">Usuário</th>
              <th className="text-left px-4 py-3">Ação</th>
              <th className="text-left px-4 py-3">Resumo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const items = getDetailItems(log.details);
              const actionTone =
                log.action === "stock.entry"
                  ? "bg-emerald-100 text-emerald-700"
                  : log.action === "stock.exit"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-50 text-slate-700";

              return (
                <tr key={log.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-mono-nums text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{log.user_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{log.user_role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded ${actionTone}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{getReadableSummary(log)}</div>

                    {items.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                        {items.slice(0, 3).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-semibold">{key}:</span> {value}
                          </div>
                        ))}
                      </div>
                    )}

                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-xs font-semibold text-[#457B9D] hover:text-[#1D3557] select-none">
                        Ver dados completos ▾
                      </summary>

                      <div className="mt-2 space-y-3">
                        {items.length > 0 && (
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                              Campos legíveis
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {items.map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="font-semibold text-slate-700">{key}:</span>{" "}
                                  <span className="text-slate-600">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="rounded-md border border-slate-800 bg-slate-900 p-3 overflow-x-auto">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                            JSON bruto da ação
                          </div>
                          <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap break-all">
{JSON.stringify(
  {
    id: log.id,
    timestamp: log.timestamp,
    user_name: log.user_name,
    user_role: log.user_role,
    action: log.action,
    target: log.target,
    details: normalizeDetails(log.details),
  },
  null,
  2
)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400">
                  Nenhum registro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}