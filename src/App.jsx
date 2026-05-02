import { useEffect, useMemo, useState } from "react";
import "./index.css";

const STORAGE_KEY = "budget_maison_banque_complete_style_original_v1";

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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

  if (row.mode === "semaine") {
    return {
      semaine: montant,
      mois: (montant * 52) / 12,
      annee: montant * 52,
    };
  }

  if (row.mode === "mois") {
    return {
      semaine: (montant * 12) / 52,
      mois: montant,
      annee: montant * 12,
    };
  }

  if (row.mode === "annee") {
    return {
      semaine: montant / 52,
      mois: montant / 12,
      annee: montant,
    };
  }

  return { semaine: 0, mois: 0, annee: 0 };
}

export default function App() {
  const [activeModule, setActiveModule] = useState("revenus");

  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row) => ({
          id: row.id || createId(),
          description: row.description || "",
          mode: row.mode === "deuxSemaines" ? "semaine" : row.mode || "semaine",
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
    if (type === "AUTRE") description = precision || "AUTRE REVENU";
    else if (type && precision) description = `${type} - ${precision}`;
    else description = type;

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

  const clearAmounts = () => {
    setRows((prev) => prev.map((row) => ({ ...row, montant: "" })));
  };

  const resetAll = () => {
    setRows(defaultRows.map((row) => ({ ...row, id: createId(), montant: "" })));
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
    <div className="app">
      <div className="panel">

        {/* ACCÈS AUX COMPTES - STYLE BANQUE */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            padding: "12px",
            background: "#030712",
            borderBottom: "1px solid rgba(34,211,238,.35)",
          }}
        >
          <button
            onClick={() => setActiveModule("compte3185")}
            style={{
              height: 38,
              borderRadius: 12,
              border: activeModule === "compte3185" ? "1px solid #facc15" : "1px solid rgba(34,211,238,.35)",
              background: activeModule === "compte3185" ? "#facc15" : "#0e1b2f",
              color: activeModule === "compte3185" ? "#000" : "#fff",
              padding: "0 18px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Compte 3185
          </button>

          <button
            onClick={() => setActiveModule("revenus")}
            style={{
              height: 38,
              borderRadius: 12,
              border: activeModule === "revenus" ? "1px solid #facc15" : "1px solid rgba(34,211,238,.35)",
              background: activeModule === "revenus" ? "#facc15" : "#0e1b2f",
              color: activeModule === "revenus" ? "#000" : "#fff",
              padding: "0 18px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Entrée d’argent
          </button>
        </div>

        {activeModule === "compte3185" && (
          <>
            <div className="titlebox">
              <div className="kicker">Module compte</div>
              <h1>Compte 3185</h1>
              <p style={{ color: "#cbd5e1", fontWeight: 700, marginTop: 12 }}>
                Ton module Compte 3185 reste accessible ici. On peut remettre ton tableau complet de compte dans cette section.
              </p>
            </div>

            <div className="bottom-summary">
              <div className="summary-card">
                <div className="summary-label">Compte actif</div>
                <div className="summary-value">3185</div>
              </div>

              <div className="summary-card">
                <div className="summary-label">Module</div>
                <div className="summary-value">Banque</div>
              </div>

              <div className="summary-card">
                <div className="summary-label">Statut</div>
                <div className="summary-value">OK</div>
              </div>
            </div>
          </>
        )}

        {activeModule === "revenus" && (
          <>
            <div className="topbar">
              <div className="module-pill">
                <span className="badge">1</span>
                <span>ENTRÉE D’ARGENT</span>
              </div>

              <select
                className="select-large"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="">Choisir une entrée d’argent</option>
                {incomeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <input
                className="input-precision"
                value={newPrecision}
                onChange={(e) => setNewPrecision(e.target.value)}
                placeholder="Précision ex: nom, enfant..."
              />

              <input
                className="input-money"
                value={newMontant}
                onChange={(e) => setNewMontant(cleanNumber(e.target.value))}
                placeholder="Montant"
                inputMode="decimal"
              />

              <select
                className="select-mode"
                value={newMode}
                onChange={(e) => setNewMode(e.target.value)}
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button className="btn btn-add" onClick={addRow}>
                + Ajouter
              </button>

              <button className="btn btn-gray" onClick={clearAmounts}>
                Effacer montants
              </button>

              <button className="btn btn-red" onClick={resetAll}>
                Reset
              </button>
            </div>

            <div className="titlebox">
              <div className="kicker">Module revenus</div>
              <h1>Entrée d’argent</h1>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>DESCRIPTION</th>
                    <th>MODE</th>
                    <th>SEMAINE</th>
                    <th>MOIS</th>
                    <th>ANNÉE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const value = calculate(row);

                    return (
                      <tr className="data-row" key={row.id}>
                        <td className="row-number">
                          <span className="row-badge">{index + 1}</span>
                        </td>

                        <td>
                          <input
                            className="cell-input"
                            value={row.description}
                            onChange={(e) =>
                              updateRow(row.id, "description", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <select
                            className="cell-select"
                            value={row.mode}
                            onChange={(e) =>
                              updateRow(row.id, "mode", e.target.value)
                            }
                          >
                            {modeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <input
                            className="cell-input cell-money"
                            value={row.montant}
                            onChange={(e) =>
                              updateRow(row.id, "montant", e.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <div className="calculated">
                            {formatMoney(value.mois)}
                          </div>
                        </td>

                        <td>
                          <div className="calculated">
                            {formatMoney(value.annee)}
                          </div>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="btn-small btn-copy"
                              onClick={() => duplicateRow(row)}
                            >
                              Copier
                            </button>

                            <button
                              className="btn-small btn-delete"
                              onClick={() => deleteRow(row.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Plus de ligne verte ici */}

            <div className="bottom-summary">
              <div className="summary-card">
                <div className="summary-label">Gain semaine</div>
                <div className="summary-value">{formatMoney(totals.semaine)} $</div>
              </div>

              <div className="summary-card">
                <div className="summary-label">Gain mois</div>
                <div className="summary-value">{formatMoney(totals.mois)} $</div>
              </div>

              <div className="summary-card">
                <div className="summary-label">Gain année</div>
                <div className="summary-value">{formatMoney(totals.annee)} $</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
