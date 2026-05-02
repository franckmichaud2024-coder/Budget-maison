import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const STORAGE_KEY = "budget_maison_revenus_ultra_stable_v1";

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const incomeOptions = [
  "DÉPÔT DE PAYE 1",
  "DÉPÔT DE PAYE 2",
  "PAIEMENT SOUTIEN ENF.PROV",
  "PREST.UNIVERS.GARDE ENFANT CANADA",
  "PRESTATION POUR ENFANT CANADA",
  "CSST 90%",
  "MATERNITÉ 70%",
  "PATERNITÉ 75%",
  "AUTRE",
];

const modeOptions = [
  { value: "semaine", label: "Semaine" },
  { value: "deuxSemaines", label: "Deux semaines" },
  { value: "mois", label: "Une fois par mois" },
  { value: "annee", label: "Une fois par année" },
];

const defaultRows = [
  { id: createId(), description: "DÉPÔT DE PAYE 1", mode: "semaine", montant: "" },
  { id: createId(), description: "DÉPÔT DE PAYE 2", mode: "semaine", montant: "" },
  { id: createId(), description: "PAIEMENT SOUTIEN ENF.PROV", mode: "semaine", montant: "" },
  { id: createId(), description: "PREST.UNIVERS.GARDE ENFANT CANADA", mode: "semaine", montant: "" },
  { id: createId(), description: "PRESTATION POUR ENFANT CANADA", mode: "semaine", montant: "" },
  { id: createId(), description: "CSST 90%", mode: "semaine", montant: "" },
  { id: createId(), description: "MATERNITÉ 70%", mode: "semaine", montant: "" },
  { id: createId(), description: "PATERNITÉ 75%", mode: "semaine", montant: "" },
];

function cleanNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const cleaned = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function calculate(row) {
  const montant = Number(row.montant || 0);

  switch (row.mode) {
    case "semaine":
      return {
        semaine: montant,
        mois: (montant * 52) / 12,
        annee: montant * 52,
      };

    case "deuxSemaines":
      return {
        semaine: montant / 2,
        mois: (montant * 26) / 12,
        annee: montant * 26,
      };

    case "mois":
      return {
        semaine: (montant * 12) / 52,
        mois: montant,
        annee: montant * 12,
      };

    case "annee":
      return {
        semaine: montant / 52,
        mois: montant / 12,
        annee: montant,
      };

    default:
      return { semaine: 0, mois: 0, annee: 0 };
  }
}

export default function App() {
  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row) => ({
          id: row.id || createId(),
          description: row.description || "",
          mode: row.mode || "semaine",
          montant: row.montant ?? "",
        }));
      }
    } catch {
      return defaultRows;
    }

    return defaultRows;
  });

  const [newType, setNewType] = useState("");
  const [newPrecision, setNewPrecision] = useState("");
  const [newMontant, setNewMontant] = useState("");
  const [newMode, setNewMode] = useState("semaine");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === "montant" ? cleanNumber(value) : value,
            }
          : row
      )
    );
  };

  const deleteRow = (id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const duplicateRow = (row) => {
    setRows((prev) => [
      ...prev,
      {
        ...row,
        id: createId(),
        description: `${row.description} COPIE`,
      },
    ]);
  };

  const addRow = () => {
    const type = newType.trim();
    const precision = newPrecision.trim();

    let description = "";

    if (type === "AUTRE") {
      description = precision || "AUTRE REVENU";
    } else if (type && precision) {
      description = `${type} - ${precision}`;
    } else {
      description = type;
    }

    if (!description) return;

    setRows((prev) => [
      ...prev,
      {
        id: createId(),
        description,
        mode: newMode,
        montant: cleanNumber(newMontant),
      },
    ]);

    setNewType("");
    setNewPrecision("");
    setNewMontant("");
    setNewMode("semaine");
  };

  const resetAll = () => {
    setRows(defaultRows.map((row) => ({ ...row, id: createId(), montant: "" })));
  };

  const clearAmounts = () => {
    setRows((prev) => prev.map((row) => ({ ...row, montant: "" })));
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const value = calculate(row);
        acc.semaine += value.semaine;
        acc.mois += value.mois;
        acc.annee += value.annee;
        return acc;
      },
      { semaine: 0, mois: 0, annee: 0 }
    );
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#07111f] text-white p-3 md:p-4">
      <div className="max-w-[1900px] mx-auto rounded-2xl overflow-hidden border border-cyan-400/40 shadow-[0_0_40px_rgba(0,200,255,0.22)]">
        <div className="bg-[#050b17] border-b border-cyan-400/40 p-3 flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 mr-2">
            <span className="w-7 h-7 rounded-full bg-cyan-500 grid place-items-center font-black shadow-lg">
              1
            </span>
            <span className="text-cyan-300 font-black tracking-wider whitespace-nowrap">
              ENTRÉE D’ARGENT
            </span>
          </div>

          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="h-10 min-w-[260px] flex-1 rounded-xl px-4 text-black font-bold"
          >
            <option value="">Choisir une entrée d’argent</option>
            {incomeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <input
            value={newPrecision}
            onChange={(e) => setNewPrecision(e.target.value)}
            placeholder="Précision ex: nom, enfant..."
            className="h-10 w-full md:w-[230px] rounded-xl px-4 text-black font-bold"
          />

          <input
            value={newMontant}
            onChange={(e) => setNewMontant(cleanNumber(e.target.value))}
            placeholder="Montant"
            inputMode="decimal"
            className="h-10 w-full md:w-[140px] rounded-xl px-4 text-black font-bold"
          />

          <select
            value={newMode}
            onChange={(e) => setNewMode(e.target.value)}
            className="h-10 w-full md:w-[190px] rounded-xl px-4 text-black font-bold"
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={addRow}
            className="h-10 px-8 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black shadow-[0_0_18px_rgba(255,196,0,0.55)] active:scale-95 transition"
          >
            + Ajouter
          </button>

          <button
            onClick={clearAmounts}
            className="h-10 px-5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black active:scale-95 transition"
          >
            Effacer montants
          </button>

          <button
            onClick={resetAll}
            className="h-10 px-5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-black active:scale-95 transition"
          >
            Reset
          </button>
        </div>

        <div className="bg-[#101827] p-5 border-b border-white/20">
          <div className="text-cyan-300 text-sm font-black tracking-[0.25em] uppercase">
            Module revenus
          </div>
          <h1 className="text-3xl font-black mt-1">Entrée d’argent</h1>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#020817] text-white">
                <th className="w-[45px] border border-slate-600 p-2"></th>
                <th className="min-w-[420px] border border-slate-600 p-3">DESCRIPTION</th>
                <th className="min-w-[190px] border border-slate-600 p-3">MODE</th>
                <th className="min-w-[180px] border border-slate-600 p-3">SEMAINE</th>
                <th className="min-w-[180px] border border-slate-600 p-3">MOIS</th>
                <th className="min-w-[180px] border border-slate-600 p-3">ANNÉE</th>
                <th className="min-w-[220px] border border-slate-600 p-3">ACTION</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => {
                const value = calculate(row);

                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-100 text-black hover:bg-cyan-50 transition"
                  >
                    <td className="border border-slate-300 text-center">
                      <span className="inline-flex items-center justify-center min-w-6 h-6 rounded-lg bg-cyan-100 border border-cyan-400 text-cyan-700 font-black">
                        {index + 1}
                      </span>
                    </td>

                    <td className="border border-slate-300 p-1">
                      <input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, "description", e.target.value)}
                        className="w-full h-8 rounded-lg border border-blue-300 bg-white px-3 font-black uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </td>

                    <td className="border border-slate-300 p-1">
                      <select
                        value={row.mode}
                        onChange={(e) => updateRow(row.id, "mode", e.target.value)}
                        className="w-full h-8 rounded-lg border border-blue-300 bg-slate-50 px-3 text-center font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        {modeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="border border-slate-300 p-1">
                      <input
                        value={row.montant}
                        onChange={(e) => updateRow(row.id, "montant", e.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="w-full h-8 rounded-lg border border-blue-300 bg-white px-3 text-right font-black focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </td>

                    <td className="border border-slate-300 p-1">
                      <div className="h-8 rounded-lg border border-blue-200 bg-slate-50 px-3 flex items-center justify-end font-black">
                        {formatMoney(value.mois)}
                      </div>
                    </td>

                    <td className="border border-slate-300 p-1">
                      <div className="h-8 rounded-lg border border-blue-200 bg-slate-50 px-3 flex items-center justify-end font-black">
                        {formatMoney(value.annee)}
                      </div>
                    </td>

                    <td className="border border-slate-300 p-1">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => duplicateRow(row)}
                          className="px-3 h-8 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-black shadow active:scale-95 transition"
                        >
                          Copier
                        </button>

                        <button
                          onClick={() => deleteRow(row.id)}
                          className="px-3 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black shadow active:scale-95 transition"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}

              <tr className="bg-[#4b812f] text-white font-black text-lg">
                <td colSpan={3} className="border border-[#2e5d20] p-3">
                  GAINS TOTAL
                </td>
                <td className="border border-[#2e5d20] p-3 text-right">
                  {formatMoney(totals.semaine)} $
                </td>
                <td className="border border-[#2e5d20] p-3 text-right">
                  {formatMoney(totals.mois)} $
                </td>
                <td className="border border-[#2e5d20] p-3 text-right">
                  {formatMoney(totals.annee)} $
                </td>
                <td className="border border-[#2e5d20] p-3"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="sticky bottom-0 bg-[#06101d]/95 backdrop-blur border-t border-cyan-400/40 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#0e1b2f] border border-cyan-400/30 p-4">
            <div className="text-cyan-300 text-xs font-black uppercase tracking-widest">
              Gain semaine
            </div>
            <div className="text-3xl font-black">{formatMoney(totals.semaine)} $</div>
          </div>

          <div className="rounded-2xl bg-[#0e1b2f] border border-cyan-400/30 p-4">
            <div className="text-cyan-300 text-xs font-black uppercase tracking-widest">
              Gain mois
            </div>
            <div className="text-3xl font-black">{formatMoney(totals.mois)} $</div>
          </div>

          <div className="rounded-2xl bg-[#0e1b2f] border border-cyan-400/30 p-4">
            <div className="text-cyan-300 text-xs font-black uppercase tracking-widest">
              Gain année
            </div>
            <div className="text-3xl font-black">{formatMoney(totals.annee)} $</div>
          </div>
        </div>
      </div>
    </div>
  );
}
