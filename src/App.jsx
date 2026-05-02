
import React from "react";

export default function App() {
  const headers = [
    "DESCRIPTION", "MODE", "SEMAINE", "MOIS", "ANNÉE", "ÉCHÉANCE", "X", "ACCUMULÉ", "ACTION"
  ];

  return (
    <div style={{ padding: 20, background: "#0b1220", minHeight: "100vh" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={styles.tableHeader}>
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={styles.cell}>DÉPÔT DE PAYE 1</td>
            <td style={styles.cell}>Semaine</td>
            <td style={styles.cell}>1000.00</td>
            <td style={styles.cell}>4333.33</td>
            <td style={styles.cell}>52000.00</td>
            <td style={styles.cell}>--</td>
            <td style={styles.cell}>--</td>
            <td style={styles.cell}>--</td>
            <td style={styles.cell}>🗑️</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  tableHeader: {
    background: "linear-gradient(180deg, #2563eb, #1d4ed8)",
    color: "#fff",
    fontWeight: "900",
    fontSize: "10px",
    padding: "4px 6px",
    lineHeight: "1",
    textAlign: "center",
    height: "28px",
    borderRight: "1px solid rgba(255,255,255,0.15)",
  },

  cell: {
    background: "#e5e7eb",
    padding: "6px",
    textAlign: "center",
    borderBottom: "1px solid #cbd5f5",
  }
};
