import { useMemo, useState } from "react";
import { AlertTriangle, Download, MessageSquare, Star, Users } from "lucide-react";

const initialFeedbacks = [
  {
    id: 1,
    patient_name: "Maria Souza",
    professional_name: "Dr. João Pereira",
    professional_role: "medico",
    attendant_name: "Ana",
    consultation_type: "consulta",
    overall_score: 4,
    doctor_score: 5,
    attendant_score: 4,
    attestation_requested: true,
    attestation_received: false,
    reasons: ["Atestado", "Tempo de espera"],
    comments: "Gostei do atendimento, mas ainda estou aguardando o atestado.",
    created_at: "2026-07-08T09:15:00"
  },
  {
    id: 2,
    patient_name: "Carlos Lima",
    professional_name: "Dra. Beatriz Rocha",
    professional_role: "medico",
    attendant_name: "Renata",
    consultation_type: "retorno",
    overall_score: 2,
    doctor_score: 2,
    attendant_score: 3,
    attestation_requested: true,
    attestation_received: false,
    reasons: ["Explicação", "Atendimento"],
    comments: "A consulta foi rápida e eu esperava uma explicação melhor sobre o atestado.",
    created_at: "2026-07-07T14:40:00"
  },
  {
    id: 3,
    patient_name: "Fernanda Alves",
    professional_name: "Lúcia Mendes",
    professional_role: "atendente",
    attendant_name: "Lúcia Mendes",
    consultation_type: "exame",
    overall_score: 5,
    doctor_score: 5,
    attendant_score: 5,
    attestation_requested: false,
    attestation_received: false,
    reasons: ["Disponibilidade"],
    comments: "Atendimento muito bom e rápido.",
    created_at: "2026-07-06T11:00:00"
  }
];

export default function Feedbacks() {
  const [feedbacks] = useState(initialFeedbacks);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return feedbacks.filter((item) => {
      const haystack = [
        item.patient_name,
        item.professional_name,
        item.attendant_name,
        item.professional_role,
        item.consultation_type,
        item.comments,
        item.reasons?.join(" "),
        item.created_at
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !term || haystack.includes(term);
    });
  }, [feedbacks, q]);

  const avgRating = useMemo(() => {
    if (!filtered.length) return "0.0";
    const sum = filtered.reduce((acc, item) => acc + Number(item.overall_score || 0), 0);
    return (sum / filtered.length).toFixed(1);
  }, [filtered]);

  const negativeCount = filtered.filter((item) => {
    const overall = Number(item.overall_score || 0);
    const doctor = Number(item.doctor_score || 0);
    const attendant = Number(item.attendant_score || 0);
    return overall <= 2 || doctor <= 2 || attendant <= 2 || (item.attestation_requested && !item.attestation_received);
  }).length;

  const pendingAttestation = filtered.filter((item) => item.attestation_requested && !item.attestation_received).length;

  const byProfessional = useMemo(() => {
    const acc = {};
    filtered.forEach((item) => {
      const key = item.professional_name || "Sem profissional";
      acc[key] = (acc[key] || 0) + 1;
    });

    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filtered]);

  const exportCsv = () => {
    const rows = [["Data/Hora", "Paciente", "Profissional", "Nota", "Atestado pendente", "Motivos", "Comentários"]];
    filtered.forEach((item) => {
      rows.push([
        item.created_at || "",
        item.patient_name || "",
        item.professional_name || "",
        item.overall_score || "",
        item.attestation_requested && !item.attestation_received ? "Sim" : "Não",
        (item.reasons || []).join(" | "),
        item.comments || ""
      ]);
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedbacks-consultas.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <div className="overline text-[#457B9D]">Módulo visual</div>
          <h1 className="font-display text-4xl font-extrabold text-[#1D3557] tracking-tight">
            Avaliações das consultas
          </h1>
          <p className="text-slate-500 mt-1">
            Dashboard do secretário com visão geral de feedbacks, notas e pendências.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="bg-white border border-slate-200 px-4 py-2 rounded-md text-sm font-semibold text-[#1D3557]"
        >
          <Download className="w-4 h-4 inline mr-1" /> Exportar CSV
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="sc-card">
          <div className="text-sm text-slate-500">Total de feedbacks</div>
          <div className="text-2xl font-bold text-[#1D3557]">{filtered.length}</div>
        </div>

        <div className="sc-card">
          <div className="text-sm text-slate-500">Média geral</div>
          <div className="text-2xl font-bold text-[#1D3557]">{avgRating}</div>
        </div>

        <div className="sc-card">
          <div className="text-sm text-slate-500">Avaliações negativas</div>
          <div className="text-2xl font-bold text-rose-600">{negativeCount}</div>
        </div>

        <div className="sc-card">
          <div className="text-sm text-slate-500">Atestados pendentes</div>
          <div className="text-2xl font-bold text-amber-600">{pendingAttestation}</div>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrar por paciente, profissional, comentário ou motivo..."
        className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-md text-sm"
      />

      <div className="grid lg:grid-cols-[1.5fr_0.8fr] gap-6">
        <div className="sc-card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Paciente</th>
                <th className="text-left px-4 py-3">Profissional</th>
                <th className="text-left px-4 py-3">Nota</th>
                <th className="text-left px-4 py-3">Atestado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500">
                    {item.created_at?.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[#1D3557]">{item.patient_name}</div>
                    <div className="text-xs text-slate-500">{item.consultation_type}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[#1D3557]">{item.professional_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{item.professional_role}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span>{item.overall_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {item.attestation_requested && !item.attestation_received ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-1 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" /> Pendente
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">
                        {item.attestation_requested ? "Solicitado" : "Não solicitado"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="sc-card">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#457B9D]" />
              <h2 className="font-semibold text-[#1D3557]">Por profissional</h2>
            </div>

            <div className="space-y-3">
              {byProfessional.map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{name}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#457B9D]"
                      style={{ width: `${Math.min(100, count * 20)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sc-card">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#457B9D]" />
              <h2 className="font-semibold text-[#1D3557]">Comentários recentes</h2>
            </div>

            <div className="space-y-3">
              {filtered.slice(0, 5).map((item) => (
                <div key={item.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="text-sm font-semibold text-[#1D3557]">{item.patient_name}</div>
                  <div className="text-xs text-slate-500">
                    {item.professional_name} • {item.created_at?.slice(0, 10)}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{item.comments}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}