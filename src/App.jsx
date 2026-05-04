import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

/*
  APP BUDGET PRO MAX
  ---------------------------------------------------
  À installer si nécessaire :
  npm install recharts framer-motion

  Ce fichier est autonome.
  Tu peux remplacer les données de départ par tes vraies données.
*/

const initialEnvelopeData = [
  {
    id: 1,
    date: "2026-05-01",
    compte: "Compte enveloppe",
    categorie: "Épicerie",
    description: "IGA / Maxi",
    depense: 145.75,
    revenu: 0,
  },
  {
    id: 2,
    date: "2026-05-02",
    compte: "Compte enveloppe",
    categorie: "Essence",
    description: "Station-service",
    depense: 82.2,
    revenu: 0,
  },
  {
    id: 3,
    date: "2026-05-03",
    compte: "Compte enveloppe",
    categorie: "Restaurant",
    description: "Souper",
    depense: 64.5,
    revenu: 0,
  },
  {
    id: 4,
    date: "2026-05-04",
    compte: "Compte enveloppe",
    categorie: "Maison",
    description: "Achat maison",
    depense: 210.0,
    revenu: 0,
  },
  {
    id: 5,
    date: "2026-05-04",
    compte: "Entrée d'argent",
    categorie: "Salaire",
    description: "Paie",
    depense: 0,
    revenu: 2450.0,
  },
];

const money = new Intl.NumberFormat("fr-CA", {
  style: "currency",
  currency: "CAD",
});

const number = new Intl.NumberFormat("fr-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#64748b",
  "#ec4899",
  "#06b6d4",
];

function toAmount(value) {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function StatCard({ title, value, subtitle, tone = "neutral" }) {
  const toneClass =
    tone === "good"
      ? "from-emerald-500/20 to-emerald-900/20 border-emerald-400/30"
      : tone === "bad"
      ? "from-red-500/20 to-red-900/20 border-red-400/30"
      : tone === "warning"
      ? "from-amber-500/20 to-amber-900/20 border-amber-400/30"
      : "from-sky-500/20 to-slate-900/20 border-sky-400/30";

  return (
    <motion.div
      whileHover={{ scale: 1.015 }}
      className={`rounded-3xl border bg-gradient-to-br ${toneClass} p-5 shadow-xl`}
    >
      <div className="text-sm uppercase tracking-[0.2em] text-slate-300">{title}</div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
    </motion.div>
  );
}

function EmptyChart({ title }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-700 text-slate-400">
      {title}
    </div>
  );
}

export default function App() {
  const [rows, setRows] = useState(initialEnvelopeData);
  const [filterCategorie, setFilterCategorie] = useState("Toutes");
  const [filterCompte, setFilterCompte] = useState("Tous");
  const [hoveredRow, setHoveredRow] = useState(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    compte: "Compte enveloppe",
    categorie: "",
    description: "",
    depense: "",
    revenu: "",
  });

  const categories = useMemo(() => {
    return ["Toutes", ...Array.from(new Set(rows.map((r) => r.categorie).filter(Boolean)))];
  }, [rows]);

  const comptes = useMemo(() => {
    return ["Tous", ...Array.from(new Set(rows.map((r) => r.compte).filter(Boolean)))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const okCat = filterCategorie === "Toutes" || r.categorie === filterCategorie;
      const okCompte = filterCompte === "Tous" || r.compte === filterCompte;
      return okCat && okCompte;
    });
  }, [rows, filterCategorie, filterCompte]);

  const stats = useMemo(() => {
    const totalDepenses = filteredRows.reduce((s, r) => s + toAmount(r.depense), 0);
    const totalRevenus = filteredRows.reduce((s, r) => s + toAmount(r.revenu), 0);
    const benefices = totalRevenus - totalDepenses;
    const nbDepenses = filteredRows.filter((r) => toAmount(r.depense) > 0).length;
    const moyenneDepense = nbDepenses ? totalDepenses / nbDepenses : 0;

    const topDepense =
      [...filteredRows]
        .filter((r) => toAmount(r.depense) > 0)
        .sort((a, b) => toAmount(b.depense) - toAmount(a.depense))[0] || null;

    return {
      totalDepenses,
      totalRevenus,
      benefices,
      moyenneDepense,
      topDepense,
      nbDepenses,
    };
  }, [filteredRows]);

  const categoryData = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      const depense = toAmount(r.depense);
      if (depense <= 0) return;
      const key = r.categorie || "Sans catégorie";
      map.set(key, (map.get(key) || 0) + depense);
    });

    return Array.from(map, ([name, value]) => ({
      name,
      value,
      pourcentage: stats.totalDepenses ? (value / stats.totalDepenses) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [filteredRows, stats.totalDepenses]);

  const dailyData = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      const key = r.date || "Sans date";
      const current = map.get(key) || { date: key, depenses: 0, revenus: 0, solde: 0 };
      current.depenses += toAmount(r.depense);
      current.revenus += toAmount(r.revenu);
      current.solde = current.revenus - current.depenses;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [filteredRows]);

  const projectionFinMois = useMemo(() => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const depensesParJour = currentDay ? stats.totalDepenses / currentDay : 0;
    return depensesParJour * daysInMonth;
  }, [stats.totalDepenses]);

  function addRow(e) {
    e.preventDefault();

    const newRow = {
      id: Date.now(),
      date: form.date,
      compte: form.compte || "Compte enveloppe",
      categorie: form.categorie || "Sans catégorie",
      description: form.description || "",
      depense: toAmount(form.depense),
      revenu: toAmount(form.revenu),
    };

    setRows((prev) => [newRow, ...prev]);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      compte: "Compte enveloppe",
      categorie: "",
      description: "",
      depense: "",
      revenu: "",
    });
  }

  function deleteRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id, field, value) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              [field]: field === "depense" || field === "revenu" ? toAmount(value) : value,
            }
          : r
      )
    );
  }

  return (
    <div className="min-h-screen bg-[#07111f] p-4 text-white md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 rounded-[2rem] border border-sky-400/20 bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">
                Budget maison
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Dashboard compte enveloppe
              </h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Analyse automatique des dépenses, revenus, bénéfices, catégories, tendances et
                projection de fin de mois.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={filterCompte}
                onChange={(e) => setFilterCompte(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              >
                {comptes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>

              <select
                value={filterCategorie}
                onChange={(e) => setFilterCategorie(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total dépenses"
            value={money.format(stats.totalDepenses)}
            subtitle={`${stats.nbDepenses} dépense(s) analysée(s)`}
            tone="bad"
          />
          <StatCard
            title="Total revenus"
            value={money.format(stats.totalRevenus)}
            subtitle="Entrées d'argent filtrées"
            tone="good"
          />
          <StatCard
            title="Bénéfices"
            value={money.format(stats.benefices)}
            subtitle="Revenus - dépenses"
            tone={stats.benefices >= 0 ? "good" : "bad"}
          />
          <StatCard
            title="Moyenne dépense"
            value={money.format(stats.moyenneDepense)}
            subtitle="Moyenne par transaction"
            tone="neutral"
          />
          <StatCard
            title="Projection mois"
            value={money.format(projectionFinMois)}
            subtitle="Basée sur le rythme actuel"
            tone="warning"
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/80 p-5 shadow-xl xl:col-span-1">
            <h2 className="mb-4 text-xl font-black">Ajouter une transaction</h2>

            <form onSubmit={addRow} className="grid grid-cols-1 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none"
              />

              <select
                value={form.compte}
                onChange={(e) => setForm({ ...form, compte: e.target.value })}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none"
              >
                <option>Compte enveloppe</option>
                <option>Entrée d'argent</option>
                <option>Argent accumulé</option>
                <option>Compte 3185</option>
              </select>

              <input
                placeholder="Catégorie"
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none"
              />

              <input
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Dépense"
                  value={form.depense}
                  onChange={(e) => setForm({ ...form, depense: e.target.value })}
                  className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 outline-none"
                />

                <input
                  placeholder="Revenu"
                  value={form.revenu}
                  onChange={(e) => setForm({ ...form, revenu: e.target.value })}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 outline-none"
                />
              </div>

              <button className="mt-2 rounded-2xl bg-sky-500 px-5 py-3 font-black text-white shadow-lg transition hover:bg-sky-400">
                Ajouter
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/80 p-5 shadow-xl xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Dépenses par catégorie</h2>
              <div className="text-sm text-slate-400">Répartition automatique</div>
            </div>

            {categoryData.length ? (
              <ResponsiveContainer width="100%" height={330}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={115}
                    innerRadius={65}
                    paddingAngle={4}
                    label={({ name, pourcentage }) => `${name} ${number.format(pourcentage)}%`}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money.format(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart title="Aucune dépense à afficher" />
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/80 p-5 shadow-xl">
            <h2 className="mb-4 text-xl font-black">Revenus vs dépenses</h2>

            {dailyData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(v) => money.format(v)} />
                  <Legend />
                  <Bar dataKey="revenus" name="Revenus" fill="#22c55e" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart title="Aucune donnée à afficher" />
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/80 p-5 shadow-xl">
            <h2 className="mb-4 text-xl font-black">Évolution du solde</h2>

            {dailyData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(v) => money.format(v)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="solde"
                    name="Solde"
                    stroke="#38bdf8"
                    strokeWidth={4}
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart title="Aucune donnée à afficher" />
            )}
          </div>
        </div>

        <div className="mb-6 rounded-[2rem] border border-slate-800 bg-slate-950/80 p-5 shadow-xl">
          <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black">Tableau des transactions</h2>
              <p className="text-sm text-slate-400">
                Modification directe possible. Survol de ligne activé.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300">
              Top dépense :{" "}
              <span className="font-black text-white">
                {stats.topDepense
                  ? `${stats.topDepense.categorie} - ${money.format(stats.topDepense.depense)}`
                  : "Aucune"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-left text-slate-300">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Compte</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Dépense</th>
                  <th className="px-4 py-3 text-right">Revenu</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    onMouseEnter={() => setHoveredRow(r.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className={`border-t border-slate-800 transition ${
                      hoveredRow === r.id ? "bg-sky-500/15" : "bg-slate-950"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.id, "date", e.target.value)}
                        className="w-full rounded-xl bg-transparent px-2 py-1 outline-none"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        value={r.compte}
                        onChange={(e) => updateRow(r.id, "compte", e.target.value)}
                        className="w-full rounded-xl bg-transparent px-2 py-1 outline-none"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        value={r.categorie}
                        onChange={(e) => updateRow(r.id, "categorie", e.target.value)}
                        className="w-full rounded-xl bg-transparent px-2 py-1 outline-none"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        value={r.description}
                        onChange={(e) => updateRow(r.id, "description", e.target.value)}
                        className="w-full rounded-xl bg-transparent px-2 py-1 outline-none"
                      />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <input
                        value={r.depense}
                        onChange={(e) => updateRow(r.id, "depense", e.target.value)}
                        className="w-full rounded-xl bg-red-950/30 px-2 py-1 text-right text-red-200 outline-none"
                      />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <input
                        value={r.revenu}
                        onChange={(e) => updateRow(r.id, "revenu", e.target.value)}
                        className="w-full rounded-xl bg-emerald-950/30 px-2 py-1 text-right text-emerald-200 outline-none"
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteRow(r.id)}
                        className="rounded-xl bg-red-500/20 px-3 py-2 font-bold text-red-200 transition hover:bg-red-500/40"
                      >
                        Effacer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-900 font-black">
                  <td className="px-4 py-4" colSpan="4">
                    TOTAL
                  </td>
                  <td className="px-4 py-4 text-right text-red-300">
                    {money.format(stats.totalDepenses)}
                  </td>
                  <td className="px-4 py-4 text-right text-emerald-300">
                    {money.format(stats.totalRevenus)}
                  </td>
                  <td className="px-4 py-4 text-center text-sky-300">
                    {money.format(stats.benefices)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-[2rem] border border-sky-400/20 bg-gradient-to-r from-slate-950 to-blue-950 p-5 shadow-xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {categoryData.slice(0, 3).map((c, index) => (
              <div key={c.name} className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
                  Top {index + 1}
                </div>
                <div className="mt-2 text-2xl font-black">{c.name}</div>
                <div className="mt-1 text-slate-300">{money.format(c.value)}</div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${Math.min(c.pourcentage, 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {number.format(c.pourcentage)}% des dépenses
                </div>
              </div>
            ))}

            {!categoryData.length && (
              <div className="col-span-full text-center text-slate-400">
                Ajoute des dépenses pour afficher ton Top 3.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
