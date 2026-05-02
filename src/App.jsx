import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

const semaines = Array.from({ length: 52 }, (_, i) => i + 1);

const COMPTES_BUDGET = [
  "7570 - Procédures",
  "3185 - Enveloppes",
  "3177 - Argent accumulé",
  "Entrée d’argent",
];


const SNAPSHOT_KEY = "budget_maison_snapshots_v1";
const RESET_PASSWORD = "1234"; // Change ce mot de passe ici
// Login sécurisé via Supabase Auth

function lireSnapshots() {
  try {
    const brut = localStorage.getItem(SNAPSHOT_KEY);
    if (!brut) return [];

    const liste = JSON.parse(brut);
    return Array.isArray(liste) ? liste : [];
  } catch (err) {
    console.error("Erreur lecture Time Machine:", err);
    return [];
  }
}

function ecrireSnapshots(liste) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(liste.slice(0, 30)));
    return true;
  } catch (err) {
    console.error("Erreur écriture Time Machine:", err);
    return false;
  }
}

function normaliserSemaines(valeur) {
  if (Array.isArray(valeur)) {
    return valeur.map((n) => Number(n)).filter((n) => n >= 1 && n <= 52);
  }

  if (typeof valeur === "string") {
    try {
      const parsed = JSON.parse(valeur);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => Number(n)).filter((n) => n >= 1 && n <= 52);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function preparerLigneSnapshot(item) {
  return {
    bloc: String(item.bloc || "").trim().toUpperCase(),
    description: String(item.description || "").trim(),
    montant: Number(item.montant || item.montant_base || 0),
    mode: item.mode || "semaine",
    type: item.type || "depense",
    echeance:
      item.echeance === null || item.echeance === undefined || item.echeance === ""
        ? null
        : Number(item.echeance),
    semaines_payees: normaliserSemaines(item.semaines_payees),
    date: item.date || new Date().toISOString(),
  };
}

function preparerSnapshotDepuisData(data) {
  return data.map(preparerLigneSnapshot);
}

function creerIdSnapshot() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


const DESCRIPTIONS_REVENUS = [
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

const STRUCTURE_BUDGET = {
  MAISON: [
    "Versement sur prêt",
    "Intérêt sur prêt",
    "Frais mensuel",
    "Frais de blocs",
    "Taxe municipale",
    "Taxe scolaire",
    "Assurance maison",
    "Location réservoir propane",
    "Remplissage propane",
    "Hydro-Québec",
    "Remplacement réservoir à eau",
    "Télécommunication",
    "Épicerie",
    "Entretien terrain",
    "Carte membre",
    "Frais comptable",
    "Alarme",
    "Traitement pelouse",
    "Déneigement",
    "Piscine",
    "Installation saisonnière",
    "Argent familial",
    "Rénovation future maison",
    "Autre",
  ],

  "AUTOMOBILES - AUTOBUS - MOTOCYCLETTE - BATEAU": [
    "Péage",
    "Essence",
    "Carte automobile",
    "Paiement véhicule",
    "Permis de conduire",
    "Assurance auto",
    "Antirouille",
    "Plaque d'immatriculation",
    "Entretien véhicule",
    "Réparation véhicule",
    "Pneus",
    "Lavage",
    "Stationnement",
    "Autre",
  ],

  "ASSURANCES ET REER": [
    "REER",
    "Assurance vie",
    "Assurance invalidité",
    "Assurance médicaments",
    "Assurance personnelle",
    "Placement / épargne",
    "Autre",
  ],

  ECOLE: [
    "Frais scolaire",
    "Frais matériel scolaire",
    "Frais vêtements",
    "Transport scolaire",
    "Activités scolaires",
    "Sorties scolaires",
    "Service de garde",
    "Frais de repas",
    "Autre",
  ],

  DIVERS: [
    "Surplus",
    "Dépenses extra vêtements",
    "Cadeaux enfants",
    "Inscription loisirs",
    "Dépenses extra",
    "Budget informatique",
    "Loisirs",
    "Vacances",
    "Cadeaux",
    "Abonnements",
    "Autre",
  ],
};
const BLOCS_FIXES = Object.keys(STRUCTURE_BUDGET).sort((a, b) =>
  a.localeCompare(b, "fr", { sensitivity: "base" })
);

const colonnesFixes = [
  { key: "description", width: 360 },
  { key: "mode", width: 70 },
  { key: "semaine", width: 90 },
  { key: "mois", width: 90 },
  { key: "annee", width: 105 },
  { key: "echeance", width: 90 },
  { key: "x", width: 45 },
  { key: "accumule", width: 105 },
  { key: "action", width: 155 },
];

function leftOffset(index) {
  return colonnesFixes.slice(0, index).reduce((acc, col) => acc + col.width, 0);
}

function round2(val) {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

function formatArgent(val) {
  return `${round2(val).toFixed(2)} $`;
}

function normaliserBloc(valeur) {
  return String(valeur || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normaliserMode(valeur) {
  const v = String(valeur || "").trim().toLowerCase();

  if (v === "semaine") return "semaine";
  if (v === "mois") return "mois";
  if (v === "année" || v === "annee") return "annee";

  return "semaine";
}

function trierCategories(liste = []) {
  return [...liste].sort((a, b) => {
    const aAutre = String(a).toLowerCase() === "autre";
    const bAutre = String(b).toLowerCase() === "autre";

    if (aAutre && !bAutre) return 1;
    if (!aAutre && bAutre) return -1;

    return String(a).localeCompare(String(b), "fr", {
      sensitivity: "base",
      ignorePunctuation: true,
    });
  });
}

function semainesEnSerie(echeance) {
  const e = Number(echeance);

  if (!e || e < 1 || e > 52) {
    return semaines;
  }

  const apresEcheance = semaines.filter((s) => s > e);
  const debutAnnee = semaines.filter((s) => s <= e);

  return [...apresEcheance, ...debutAnnee];
}


function semainesAfficheesPourLigne(item) {
  const liste = semainesEnSerie(item.echeance);

  if (normaliserMode(item.mode) === "semaine") {
    return liste.slice(0, 5);
  }

  return liste;
}



function getWeekNumberISO(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getJoursCalendrier(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const jours = Array.from({ length: offset }, () => null);
  for (let j = 1; j <= last.getDate(); j += 1) jours.push(new Date(y, m, j));
  return jours;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const tableScrollRef = useRef(null);
  const lastScrollRef = useRef(0);
  const bottomScrollRef = useRef(null);
  const [scrollInfo, setScrollInfo] = useState({ left: 0, max: 1 });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem("budget_maison_guide_done") !== "true";
  });



  const [blocs] = useState(BLOCS_FIXES);
  const [blocActif, setBlocActif] = useState(BLOCS_FIXES[0]);
  const [comptesBudget, setComptesBudget] = useState(COMPTES_BUDGET);
  const [compteActif, setCompteActif] = useState(COMPTES_BUDGET[0]);
  const [nouveauCompte, setNouveauCompte] = useState("");
  const [dragCompte, setDragCompte] = useState(null);
  const [compteEdition, setCompteEdition] = useState(null);
  const [compteEditionValeur, setCompteEditionValeur] = useState("");



  const [description, setDescription] = useState("");
  const [descriptionAutre, setDescriptionAutre] = useState("");
  const [noteEnfant, setNoteEnfant] = useState("");
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("semaine");
  const [echeance, setEcheance] = useState("");
  const [type, setType] = useState("depense");

  const [showRevenuModal, setShowRevenuModal] = useState(false);
  const [revenuDescription, setRevenuDescription] = useState("");
  const [revenuDescriptionAutre, setRevenuDescriptionAutre] = useState("");
  const [revenuMontant, setRevenuMontant] = useState("");
  const [revenuMode, setRevenuMode] = useState("semaine");
  const [revenuDate, setRevenuDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [revenuPrecision, setRevenuPrecision] = useState("");

  const [data, setData] = useState([]);
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [tmMessage, setTmMessage] = useState("");
  const [ligneEdition, setLigneEdition] = useState(null);
  const [montantEdition, setMontantEdition] = useState("");
  const [echeanceEdition, setEcheanceEdition] = useState(null);
  const [echeanceEditionValue, setEcheanceEditionValue] = useState("");

  const [ligneEditionInfo, setLigneEditionInfo] = useState(null);
  const [descriptionEdition, setDescriptionEdition] = useState("");
  const [noteEdition, setNoteEdition] = useState("");
  const [valeurs3177, setValeurs3177] = useState({});
  const [input3177Actif, setInput3177Actif] = useState(null);

  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [nowLive, setNowLive] = useState(new Date());
  const [dockPositions, setDockPositions] = useState(() => {
    const defaults = {
      account: { x: 1030, y: 12 },
      calendar: { x: 1030, y: 76 },
      user: { x: 1210, y: 76 },
      actions: { x: 1420, y: 76 },
      security: { x: 1640, y: 76 },
    };

    try {
      const saved = localStorage.getItem("budget-dock-positions-v2");
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (err) {
      // ignore
    }

    return defaults;
  });



  function changerCompteActif(compte) {
    setCompteActif(compte);
    setDescription("");
    setDescriptionAutre("");
    setNoteEnfant("");
    setErreur("");
    setShowSnapshots(false);
  }

  function ajouterCompteBudget() {
    const nom = nouveauCompte.trim();
    if (!nom) return;

    if (comptesBudget.includes(nom)) {
      setCompteActif(nom);
      setNouveauCompte("");
      return;
    }

    const prochaineListe = [...comptesBudget, nom];
    setComptesBudget(prochaineListe);
    setCompteActif(nom);
    setNouveauCompte("");
  }

  async function renommerCompteActif() {
    setErreur("");

    const numeroActuel = numeroCompte(compteActif);
    const intituleFixe = intituleCompte(compteActif);

    const nouveauNumero = window.prompt(
      `Nouveau numéro pour le compte "${intituleFixe}" :`,
      numeroActuel
    );

    if (nouveauNumero === null) return;

    const numeroFinal = String(nouveauNumero).replace(/[^0-9]/g, "").trim();

    if (!numeroFinal) {
      setErreur("Le numéro du compte ne peut pas être vide.");
      return;
    }

    const nomFinal = `${numeroFinal} - ${intituleFixe}`;

    if (nomFinal === compteActif) return;

    if (comptesBudget.includes(nomFinal)) {
      setErreur("Ce numéro existe déjà pour un autre compte.");
      return;
    }

    const ancienCompte = compteActif;

    const nouvelleListe = comptesBudget.map((compte) =>
      compte === ancienCompte ? nomFinal : compte
    );

    setComptesBudget(nouvelleListe);
    setCompteActif(nomFinal);

    const { error } = await supabase
      .from("budget_transactions")
      .update({ compte: nomFinal })
      .eq("user_id", getUserId())
      .eq("compte", ancienCompte);

    if (error) {
      setErreur(error.message);
      setComptesBudget(comptesBudget);
      setCompteActif(ancienCompte);
      return;
    }

    await loadData();
  }

  async function supprimerCompteActif() {
    setErreur("");

    if (comptesBudget.length <= 1) {
      setErreur("Impossible de supprimer le dernier compte.");
      return;
    }

    const confirmation = window.confirm(
      `Supprimer le compte "${compteActif}" ?\n\nToutes les lignes associées à ce compte seront supprimées.`
    );

    if (!confirmation) return;

    const confirmationFinale = window.confirm(
      "Dernière confirmation : veux-tu vraiment supprimer ce compte ?"
    );

    if (!confirmationFinale) return;

    const { error } = await supabase
      .from("budget_transactions")
      .delete()
      .eq("user_id", getUserId())
      .eq("compte", compteActif);

    if (error) {
      setErreur(error.message);
      return;
    }

    const prochaineListe = comptesBudget.filter((c) => c !== compteActif);
    setComptesBudget(prochaineListe);
    setCompteActif(prochaineListe[0]);
    setData([]);
  }

  function couleurCompte(compte) {
    const couleurs = [
      "#22c55e",
      "#0ea5e9",
      "#f59e0b",
      "#a855f7",
      "#ef4444",
      "#14b8a6",
      "#84cc16",
      "#ec4899",
    ];

    let total = 0;
    for (let i = 0; i < compte.length; i += 1) {
      total += compte.charCodeAt(i);
    }

    return couleurs[total % couleurs.length];
  }

  function numeroCompte(compte) {
    const match = String(compte || "").match(/^\s*(\d+)/);
    return match ? match[1] : "";
  }

  function intituleCompte(compte) {
    return String(compte || "")
      .replace(/^\s*\d+\s*-\s*/, "")
      .trim();
  }

  function composerCompte(numero, compteReference) {
    const cleanNumero = String(numero || "").replace(/[^0-9]/g, "").trim();
    const intitule = intituleCompte(compteReference);

    if (!cleanNumero) return compteReference;
    return `${cleanNumero} - ${intitule}`;
  }

  function compteEst(compte, intitule) {
    return intituleCompte(compte).toLowerCase() === String(intitule).toLowerCase();
  }

  function compteEstEnveloppes(compte) {
    return compteEst(compte, "Enveloppes");
  }

  function compteEstArgentAccumule(compte) {
    return compteEst(compte, "Argent accumulé");
  }

  function compteEstEntreeArgent(compte) {
    const valeur = String(compte || "").toLowerCase();
    return valeur.includes("entrée d’argent") || valeur.includes("entree d'argent");
  }

  function trouverCompteParIntitule(intitule) {
    return comptesBudget.find((compte) => compteEst(compte, intitule)) || "";
  }

  function onDragStartCompte(compte) {
    setDragCompte(compte);
  }

  function onDropCompte(compteCible) {
    if (!dragCompte || dragCompte === compteCible) return;

    const liste = [...comptesBudget];
    const indexDepart = liste.indexOf(dragCompte);
    const indexCible = liste.indexOf(compteCible);

    if (indexDepart === -1 || indexCible === -1) return;

    const [item] = liste.splice(indexDepart, 1);
    liste.splice(indexCible, 0, item);

    setComptesBudget(liste);
    setDragCompte(null);
  }

  function commencerEditionCompte(compte) {
    setCompteEdition(compte);
    setCompteEditionValeur(numeroCompte(compte));
  }

  async function validerRenameCompte() {
    const numeroFinal = String(compteEditionValeur || "").replace(/[^0-9]/g, "").trim();

    if (!compteEdition || !numeroFinal) {
      setCompteEdition(null);
      return;
    }

    const nouveauNom = composerCompte(numeroFinal, compteEdition);

    if (nouveauNom !== compteEdition && comptesBudget.includes(nouveauNom)) {
      setErreur("Ce numéro existe déjà pour un autre compte.");
      return;
    }

    const ancienneValeur = compteEdition;

    const prochaineListe = comptesBudget.map((c) =>
      c === ancienneValeur ? nouveauNom : c
    );

    setComptesBudget(prochaineListe);

    if (compteActif === ancienneValeur) {
      setCompteActif(nouveauNom);
    }

    const { error } = await supabase
      .from("budget_transactions")
      .update({ compte: nouveauNom })
      .eq("user_id", getUserId())
      .eq("compte", ancienneValeur);

    if (error) {
      setErreur(error.message);
      return;
    }

    setCompteEdition(null);
    setCompteEditionValeur("");
    await loadData();
  }

  async function loadBlocs() {
    return BLOCS_FIXES;
  }

  async function loadData() {
    const userId = getUserId();

    if (!userId) {
      setData([]);
      return [];
    }

    const compteSource =
      compteEstArgentAccumule(compteActif)
        ? trouverCompteParIntitule("Enveloppes")
        : compteActif;

    const { data, error } = await supabase
      .from("budget_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("compte", compteSource)
      .order("bloc", { ascending: true })
      .order("date", { ascending: false });

    if (error) {
      setErreur(error.message);
      return [];
    }

    const lignes = (data || []).map((item) => ({
      ...item,
      bloc: normaliserBloc(item.bloc || "SANS BLOC"),
      compte: item.compte || compteSource,
      mode: normaliserMode(item.mode),
    }));

    setData(lignes);
    return lignes;
  }

  useEffect(() => {
    let mounted = true;

    async function verifierSession() {
      const { data } = await supabase.auth.getSession();

      if (mounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    }

    verifierSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setData([]);
      return;
    }

    loadBlocs();
    loadData();
    setSnapshots(lireSnapshots());
  }, [compteActif, session?.user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNowLive(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const table = tableScrollRef.current;
    if (!table) return;

    const updateInfo = () => {
      const max = Math.max(0, table.scrollWidth - table.clientWidth + 320);
      setScrollInfo({
        left: table.scrollLeft,
        max,
      });
    };

    table.addEventListener("scroll", updateInfo, { passive: true });
    window.addEventListener("resize", updateInfo);

    updateInfo();

    return () => {
      table.removeEventListener("scroll", updateInfo);
      window.removeEventListener("resize", updateInfo);
    };
  }, [data]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollLeft = lastScrollRef.current;
    });
  }, [data]);

  function obtenirScrollers() {
    return {
      table: tableScrollRef.current,
    };
  }

  function bougerScroll(left) {
    const table = tableScrollRef.current;
    if (!table) return;

    // Calcul réel du scroll disponible.
    // Le +220 donne un coussin visuel pour atteindre la dernière semaine complètement.
    const max = Math.max(0, table.scrollWidth - table.clientWidth + 320);
    if (max <= 0) return;

    const nextLeft = Math.max(0, Math.min(left, max));

    lastScrollRef.current = nextLeft;
    table.scrollLeft = nextLeft;

    setScrollInfo({
      left: nextLeft,
      max,
    });
  }

  function scrollTableBy(px) {
    const { table } = obtenirScrollers();
    if (!table) return;

    bougerScroll(table.scrollLeft + px);
  }

  function scrollTableTo(position) {
    const table = tableScrollRef.current;
    if (!table) return;

    const max = Math.max(0, table.scrollWidth - table.clientWidth + 320);

    if (position === "start") bougerScroll(0);
    if (position === "middle") bougerScroll(max / 2);
    if (position === "end") bougerScroll(max);
  }

  function enregistrerSnapshot(action = "Sauvegarde automatique") {
    const copie = preparerSnapshotDepuisData(data);

    const nouveau = {
      id: creerIdSnapshot(),
      action,
      date: new Date().toISOString(),
      lignes: copie,
    };

    const prochaineListe = [nouveau, ...lireSnapshots()].slice(0, 50);
    const ok = ecrireSnapshots(prochaineListe);

    if (ok) {
      setSnapshots(prochaineListe);
      setTimeIndex(0);
    }

    return ok;
  }


  async function restaurerSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.lignes)) {
      setErreur("Sauvegarde invalide ou vide.");
      return;
    }

    const ok = window.confirm(
      `Restaurer la sauvegarde du ${formatSnapshotDate(snapshot.date)} ?\n\nLe tableau actuel sera remplacé par cette version.`
    );

    if (!ok) return;

    setLoading(true);
    setErreur("");

    try {
      // Sauvegarde de sécurité AVANT restauration
      enregistrerSnapshot("Sécurité avant restauration");

      // 1) Supprimer toutes les lignes actuelles visibles dans l'app
      const idsActuels = data.map((item) => item.id).filter(Boolean);

      if (idsActuels.length > 0) {
        const { error: deleteError } = await supabase
          .from("budget_transactions")
          .delete()
          .in("id", idsActuels);

        if (deleteError) {
          throw deleteError;
        }
      }

      // 2) Réinsérer exactement les lignes de la sauvegarde
      if (!getUserId()) {
        throw new Error("Session Supabase introuvable. Déconnecte-toi puis reconnecte-toi.");
      }

      const lignesAInserer = snapshot.lignes
        .map(preparerLigneSnapshot)
        .filter((ligne) => ligne.description && ligne.montant > 0)
        .map((ligne) => ({
          ...ligne,
          user_id: getUserId(),
          compte: compteActif,
        }));

      if (lignesAInserer.length > 0) {
        const { error: insertError } = await supabase
          .from("budget_transactions")
          .insert(lignesAInserer);

        if (insertError) {
          throw insertError;
        }
      }

      // 3) Recharger l'écran
      await loadData();
      await loadBlocs();

      setSnapshots(lireSnapshots());
      setTimeIndex(0);
      setShowSnapshots(false);
      setTmMessage(`Version restaurée : ${formatSnapshotDate(snapshot.date)}`);
      window.setTimeout(() => setTmMessage(""), 2200);
    } catch (err) {
      setErreur(`Restauration impossible : ${err.message}`);
    } finally {
      setLoading(false);
    }
  }


  function formatSnapshotDate(dateISO) {
    return new Date(dateISO).toLocaleString("fr-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function sauvegardeManuelle() {
    try {
      const copie = preparerSnapshotDepuisData(data);

      const snapshot = {
        id: creerIdSnapshot(),
        action: "Sauvegarde manuelle",
        date: new Date().toISOString(),
        lignes: copie,
      };

      const prochaineListe = [snapshot, ...lireSnapshots()].slice(0, 50);
      const ok = ecrireSnapshots(prochaineListe);

      if (!ok) {
        setErreur("Impossible d'écrire la sauvegarde dans le navigateur.");
        return;
      }

      // Sauvegarder = seulement sauvegarder.
      // On ne force plus l'ouverture de la Time Machine.
      setSnapshots(prochaineListe);
      setTimeIndex(0);
      setTmMessage(`Sauvegarde créée : ${formatSnapshotDate(snapshot.date)}`);

      window.setTimeout(() => setTmMessage(""), 2200);
    } catch (err) {
      setErreur(`Impossible de créer la sauvegarde : ${err.message}`);
    }
  }


  function ouvrirTimeMachine() {
    const liste = lireSnapshots();
    setSnapshots(liste);
    setTimeIndex(0);
    setShowSnapshots(true);
  }

  function reinitialiserTout() {
    setErreur("");

    if (!getUserId()) {
      setErreur("Session Supabase introuvable. Déconnecte-toi puis reconnecte-toi.");
      return;
    }

    setResetPasswordInput("");
    setShowResetModal(true);
  }

  async function confirmerReinitialisation() {
    setErreur("");

    if (String(resetPasswordInput).trim() !== RESET_PASSWORD) {
      setErreur("Mot de passe incorrect. Réinitialisation annulée.");
      return;
    }

    const confirmationFinale = window.confirm(
      "Dernière confirmation : veux-tu vraiment tout effacer ?"
    );

    if (!confirmationFinale) return;

    setShowResetModal(false);
    setLoading(true);

    try {
      enregistrerSnapshot("Sécurité avant réinitialisation complète");

      const { error } = await supabase
        .from("budget_transactions")
        .delete()
        .eq("user_id", getUserId())
        .eq("compte", compteActif);

      if (error) {
        throw error;
      }

      setData([]);
      await loadData();
      await loadBlocs();

      setSnapshots(lireSnapshots());
      setTimeIndex(0);
      setTmMessage("Tableau réinitialisé. Sauvegarde de sécurité créée.");
      window.setTimeout(() => setTmMessage(""), 2600);
      setResetPasswordInput("");
    } catch (err) {
      setErreur(`Réinitialisation impossible : ${err.message}`);
    } finally {
      setLoading(false);
    }
  }



  const snapshotActif = snapshots[timeIndex] || null;
  const totalSnapshots = snapshots.length;

  function fermerGuide() {
    localStorage.setItem("budget_maison_guide_done", "true");
    setShowGuide(false);
  }

  function getUserId() {
    return session?.user?.id || null;
  }

  function getValeurs3177StorageKey() {
    return `budget_3177_valeurs_${getUserId() || "anonymous"}`;
  }

  useEffect(() => {
    if (!session?.user?.id) {
      setValeurs3177({});
      return;
    }

    try {
      setValeurs3177(JSON.parse(localStorage.getItem(getValeurs3177StorageKey()) || "{}"));
    } catch {
      setValeurs3177({});
    }
  }, [session?.user?.id]);

  async function seConnecter(e) {
    e.preventDefault();
    setLoginError("");
    setAuthLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });

    setAuthLoading(false);

    if (error) {
      setLoginError(error.message || "Courriel ou mot de passe incorrect.");
      return;
    }

    setSession(data.session);
    setLoginPassword("");
  }

  async function seDeconnecter() {
    await supabase.auth.signOut();
    setSession(null);
    setLoginEmail("");
    setLoginPassword("");
  }

  async function changerMotDePasse(e) {
    e.preventDefault();
    setPasswordMessage("");

    const pass = String(newPassword || "").trim();
    const confirm = String(newPasswordConfirm || "").trim();

    if (pass.length < 6) {
      setPasswordMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (pass !== confirm) {
      setPasswordMessage("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({ password: pass });

    setPasswordLoading(false);

    if (error) {
      setPasswordMessage(error.message);
      return;
    }

    setPasswordMessage("Mot de passe modifié avec succès.");
    setNewPassword("");
    setNewPasswordConfirm("");

    window.setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMessage("");
    }, 1400);
  }



  function calculerMontants(item) {
    const montantBase = Number(item.montant || 0);
    const itemMode = normaliserMode(item.mode);

    if (itemMode === "semaine") {
      const semaine = montantBase;
      const annee = semaine * 52;
      const mois = annee / 12;
      return { semaine, mois, annee };
    }

    if (itemMode === "mois") {
      const mois = montantBase;
      const annee = mois * 12;
      const semaine = annee / 52;
      return { semaine, mois, annee };
    }

    const annee = montantBase;
    const semaine = annee / 52;
    const mois = annee / 12;
    return { semaine, mois, annee };
  }

  function semainesPayees(item) {
    return Array.isArray(item.semaines_payees) ? item.semaines_payees : [];
  }

  function estPayee(item, semaine) {
    return semainesPayees(item).includes(semaine);
  }

  function montantAccumule(item) {
    return semainesPayees(item).length * calculerMontants(item).semaine;
  }

  function balance(item) {
    return montantAccumule(item) - calculerMontants(item).annee;
  }

  async function ajouterRevenu(e) {
    e.preventDefault();
    setErreur("");

    const montantNumber = Number(String(revenuMontant).replace(",", "."));

    const descriptionRevenuBase =
      revenuDescription === "AUTRE"
        ? revenuDescriptionAutre.trim()
        : revenuDescription.trim();

    const descriptionRevenuFinale = revenuPrecision.trim()
      ? `${descriptionRevenuBase} - ${revenuPrecision.trim()}`
      : descriptionRevenuBase;

    if (!descriptionRevenuFinale) {
      setErreur("Choisis une description pour l'entrée d'argent.");
      return;
    }

    if (!revenuMontant || montantNumber <= 0) {
      setErreur("Entre un montant valide pour l'entrée d'argent.");
      return;
    }

    if (!getUserId()) {
      setErreur("Session Supabase introuvable. Déconnecte-toi puis reconnecte-toi.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("budget_transactions").insert([
      {
        user_id: getUserId(),
        compte: "Entrée d’argent",
        bloc: "ENTRÉE D'ARGENT",
        description: descriptionRevenuFinale,
        montant: montantNumber,
        mode: normaliserMode(revenuMode),
        type: "revenu",
        echeance: null,
        semaines_payees: [],
        date: revenuDate ? new Date(`${revenuDate}T12:00:00`).toISOString() : new Date().toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      setErreur(error.message);
      return;
    }

    setRevenuDescription("");
    setRevenuDescriptionAutre("");
    setRevenuMontant("");
    setRevenuPrecision("");
    setRevenuMode("semaine");
    setRevenuDate(new Date().toISOString().slice(0, 10));
    setShowRevenuModal(false);
    await loadData();
  }

  async function ajouterLigne() {
    setErreur("");

    const montantNumber = Number(montant);
    const echeanceNumber = echeance ? Number(echeance) : null;

    if (!blocActif) {
      setErreur("Crée ou sélectionne un bloc.");
      return;
    }

    const descriptionChoisie =
      description === "Autre" ? descriptionAutre.trim() : description.trim();

    const descriptionFinale = noteEnfant.trim()
      ? `${descriptionChoisie} - ${noteEnfant.trim()}`
      : descriptionChoisie;

    if (!descriptionFinale) {
      setErreur("Choisis une dépense ou écris une description.");
      return;
    }

    if (!montant || montantNumber <= 0) {
      setErreur("Entre un montant valide.");
      return;
    }

    if (echeanceNumber !== null && (echeanceNumber < 1 || echeanceNumber > 52)) {
      setErreur("L'échéance doit être entre 1 et 52.");
      return;
    }

    if (!getUserId()) {
      setErreur("Session Supabase introuvable. Déconnecte-toi puis reconnecte-toi.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("budget_transactions").insert([
      {
        user_id: getUserId(),
        compte: compteActif,
        bloc: normaliserBloc(blocActif),
        description: descriptionFinale,
        montant: montantNumber,
        mode: normaliserMode(mode),
        type: "depense",
        echeance: echeanceNumber,
        semaines_payees: [],
        date: new Date().toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      setErreur(error.message);
      return;
    }

    setDescription("");
    setDescriptionAutre("");
    setNoteEnfant("");
    setMontant("");
    setMode("semaine");
    setEcheance("");
    setType("depense");
    loadData();
  }

  function resetTransfertSiTousXEffaces(item) {
    if (!item?.id) return;

    let valeursActuelles = {};
    try {
      valeursActuelles = JSON.parse(localStorage.getItem(getValeurs3177StorageKey()) || "{}");
    } catch {
      valeursActuelles = {};
    }

    if (!valeursActuelles[item.id]) return;

    const nextValues = {
      ...valeursActuelles,
      [item.id]: {
        ...valeursActuelles[item.id],
        transfertEffectue: false,
        montantTransfere: 0,
        dateTransfert: null,
      },
    };

    localStorage.setItem(getValeurs3177StorageKey(), JSON.stringify(nextValues));
    setValeurs3177(nextValues);
  }

  async function transfererChiffre(item) {
    setErreur("");

    const id = item.id;
    const nbX = semainesPayees(item).length;
    const montantATransferer = round2(montantAccumule(item));

    if (!id) {
      setErreur("Impossible de transférer : identifiant de ligne introuvable.");
      return;
    }

    if (nbX < 52) {
      setErreur(
        `Transfert impossible pour "${item.description}". Tu dois avoir les 52 X avant de transférer. Actuellement : ${nbX}/52.`
      );
      return;
    }

    if (!montantATransferer || montantATransferer <= 0) {
      setErreur("Aucun montant accumulé à transférer pour cette ligne.");
      return;
    }

    let valeursActuelles = {};
    try {
      valeursActuelles = JSON.parse(localStorage.getItem(getValeurs3177StorageKey()) || "{}");
    } catch {
      valeursActuelles = {};
    }

    const dejaTransfere = Boolean(valeursActuelles?.[id]?.transfertEffectue);

    if (dejaTransfere) {
      const dateTransfert = valeursActuelles?.[id]?.dateTransfert
        ? new Date(valeursActuelles[id].dateTransfert).toLocaleString("fr-CA")
        : "";

      setErreur(
        `Transfert déjà effectué pour "${item.description}". Pour retransférer, efface d'abord tous les X, puis remets les 52 X. ${dateTransfert ? "Date du transfert : " + dateTransfert : ""}`
      );
      return;
    }

    const gainDefaut = 0;
    const gainActuelRaw = valeursActuelles?.[id]?.gains;

    const gainActuel =
      gainActuelRaw === undefined || gainActuelRaw === null || gainActuelRaw === ""
        ? gainDefaut
        : round2(Number(String(gainActuelRaw).replace(",", ".")) || 0);

    const nouveauGain = round2(gainActuel + montantATransferer);

    const nextValues = {
      ...valeursActuelles,
      [id]: {
        ...(valeursActuelles[id] || {}),
        gains: nouveauGain,
        transfertEffectue: true,
        montantTransfere: montantATransferer,
        dateTransfert: new Date().toISOString(),
      },
    };

    localStorage.setItem(getValeurs3177StorageKey(), JSON.stringify(nextValues));
    setValeurs3177(nextValues);

    setErreur(
      `Transfert effectué : ${formatArgent(montantATransferer)} ajouté au gain 3177 de "${item.description}". Pour retransférer, il faudra effacer tous les X et remettre les 52 X.`
    );
  }

  function separerDescriptionEtNote(item) {
    const texte = String(item.description || "");
    const morceaux = texte.split(" - ");

    if (morceaux.length >= 2) {
      return {
        base: morceaux[0].trim(),
        note: morceaux.slice(1).join(" - ").trim(),
      };
    }

    return { base: texte, note: "" };
  }

  function commencerEditionInfo(item) {
    const parts = separerDescriptionEtNote(item);

    setErreur("");
    setLigneEditionInfo(item.id);
    setDescriptionEdition(parts.base);
    setNoteEdition(parts.note);
  }

  function annulerEditionInfo() {
    setLigneEditionInfo(null);
    setDescriptionEdition("");
    setNoteEdition("");
  }

  async function sauvegarderInfo(item) {
    setErreur("");

    const base = descriptionEdition.trim();
    const note = noteEdition.trim();

    if (!base) {
      setErreur("Choisis ou écris une description.");
      return;
    }

    const descriptionFinale = note ? `${base} - ${note}` : base;

    enregistrerSnapshot("Avant modification catégorie");

    const { error } = await supabase
      .from("budget_transactions")
      .update({ description: descriptionFinale })
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    setData((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, description: descriptionFinale } : row
      )
    );

    annulerEditionInfo();
  }

  function commencerEditionMontant(item) {
    setErreur("");
    setLigneEdition(item.id);
    setMontantEdition(String(item.montant || ""));
  }

  async function changerModeLigne(item, nouveauMode) {
    setErreur("");

    const modeNormalise = normaliserMode(nouveauMode);

    if (!["semaine", "mois", "annee"].includes(modeNormalise)) return;

    enregistrerSnapshot(`Avant changement mode : ${item.description}`);

    const { error } = await supabase
      .from("budget_transactions")
      .update({ mode: modeNormalise })
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    setData((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, mode: modeNormalise } : row
      )
    );
  }

  async function sauvegarderMontant(item) {
    setErreur("");

    const nouveauMontant = Number(montantEdition);

    if (!montantEdition || nouveauMontant <= 0) {
      setErreur("Entre un montant valide.");
      return;
    }

    const { error } = await supabase
      .from("budget_transactions")
      .update({ montant: nouveauMontant })
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    setData((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, montant: nouveauMontant } : row
      )
    );

    setLigneEdition(null);
    setMontantEdition("");
  }

  function annulerEditionMontant() {
    setLigneEdition(null);
    setMontantEdition("");
  }

  function commencerEditionEcheance(item) {
    setErreur("");
    setEcheanceEdition(item.id);
    setEcheanceEditionValue(String(item.echeance || ""));
  }

  function annulerEditionEcheance() {
    setEcheanceEdition(null);
    setEcheanceEditionValue("");
  }

  async function sauvegarderEcheance(item) {
    setErreur("");

    const nouvelleEcheance = Number(echeanceEditionValue);

    if (!echeanceEditionValue || nouvelleEcheance < 1 || nouvelleEcheance > 52) {
      setErreur("Entre une échéance valide entre 1 et 52.");
      return;
    }

    enregistrerSnapshot(`Avant changement échéance : ${item.description}`);

    const { error } = await supabase
      .from("budget_transactions")
      .update({ echeance: nouvelleEcheance })
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    setData((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, echeance: nouvelleEcheance } : row
      )
    );

    setEcheanceEdition(null);
    setEcheanceEditionValue("");
  }

  async function toggleSemaine(item, semaine) {
    setErreur("");

    let semainesListe = semainesPayees(item);

    if (semainesListe.includes(semaine)) {
      semainesListe = semainesListe.filter((s) => s !== semaine);
    } else {
      semainesListe = [...semainesListe, semaine].sort((a, b) => a - b);
    }

    enregistrerSnapshot("Avant modification calendrier");

    const { error } = await supabase
      .from("budget_transactions")
      .update({ semaines_payees: semainesListe })
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    setData((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, semaines_payees: semainesListe } : row
      )
    );

    if (semainesListe.length === 0) {
      resetTransfertSiTousXEffaces(item);
      setErreur(`Tous les X ont été effacés pour "${item.description}". Le transfert pourra être refait seulement après avoir remis les 52 X.`);
    }
  }

  async function viderXLigne(item) {
    setErreur("");

    const nbXActuels = semainesPayees(item).length;

    if (nbXActuels === 0) {
      setErreur("Aucun X à supprimer sur cette ligne.");
      return;
    }

    const ok = window.confirm(`Supprimer les ${nbXActuels} X de la ligne "${item.description}" ?`);
    if (!ok) return;

    enregistrerSnapshot(`Avant suppression des X : ${item.description}`);

    const { error } = await supabase
      .from("budget_transactions")
      .update({ semaines_payees: [] })
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    setData((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, semaines_payees: [] } : row
      )
    );

    resetTransfertSiTousXEffaces(item);
    setErreur(`Tous les X ont été effacés pour "${item.description}". Le transfert pourra être refait seulement après avoir remis les 52 X.`);
  }

  async function supprimerLigne(item) {
    const ok = window.confirm(`Supprimer la ligne "${item.description}" ?`);
    if (!ok) return;

    setErreur("");

    // IMPORTANT :
    // On capture l'état AVANT la suppression.
    // Comme ça, la Time Machine peut restaurer la ligne supprimée.
    enregistrerSnapshot(`Avant suppression : ${item.description}`);

    const { error } = await supabase
      .from("budget_transactions")
      .delete()
      .eq("id", item.id);

    if (error) {
      setErreur(error.message);
      return;
    }

    await loadData();
    await loadBlocs();

    // Recharge l'historique pour que la sauvegarde soit visible tout de suite.
    setSnapshots(lireSnapshots());
    setTimeIndex(0);
  }

  const groupes = useMemo(() => {
    const acc = {};

    for (const bloc of BLOCS_FIXES) {
      acc[bloc] = [];
    }

    for (const item of data) {
      const nomBloc = normaliserBloc(item.bloc || "");
      if (!BLOCS_FIXES.includes(nomBloc)) continue;
      acc[nomBloc].push(item);
    }

    return acc;
  }, [data]);

  const lignesBlocActif = data.filter((item) => normaliserBloc(item.bloc) === normaliserBloc(blocActif));

  const groupesFiltres = useMemo(() => {
    const acc = {};

    for (const bloc of BLOCS_FIXES) {
      const lignes = data.filter((item) => normaliserBloc(item.bloc) === bloc);

      if (lignes.length > 0) {
        acc[bloc] = lignes;
      }
    }

    return acc;
  }, [data]);

  const depenses = data.filter((item) => item.type === "depense");
  const revenus = data.filter((item) => item.type === "revenu");

  const totalDepenses = depenses.reduce(
    (acc, item) => acc + calculerMontants(item).mois,
    0
  );

  const totalRevenus = revenus.reduce(
    (acc, item) => acc + calculerMontants(item).mois,
    0
  );

  const solde = totalRevenus - totalDepenses;
  const semaineActuelle = getWeekNumberISO(nowLive);
  const weekHue = (semaineActuelle * 7) % 360;
  const weekGlowColor = `hsl(${weekHue} 95% 58%)`;
  const weekGlowSoft = `hsla(${weekHue}, 95%, 58%, 0.24)`;
  const jourActuelTexte = nowLive.toLocaleDateString("fr-CA", { weekday: "long" });
  const moisActuelTexte = nowLive.toLocaleDateString("fr-CA", { month: "long" });
  const joursCalendrier = getJoursCalendrier(calendarDate);
  const moisCalendrierTexte = calendarDate.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });

  function changerMoisCalendrier(delta) {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function choisirDateCalendrier(date) {
    if (!date) return;
    setEcheance(String(getWeekNumberISO(date)));
    setCalendarDate(date);
    setShowCalendarPanel(false);
  }

  function limiterPositionDock(position, largeurDock = 320, hauteurDock = 70) {
    const maxX = Math.max(10, window.innerWidth - largeurDock - 10);
    const maxY = Math.max(10, window.innerHeight - hauteurDock - 10);

    return {
      x: Math.min(Math.max(10, position.x), maxX),
      y: Math.min(Math.max(10, position.y), maxY),
    };
  }

  function sauvegarderPositionsDock(nextPositions) {
    setDockPositions(nextPositions);
    localStorage.setItem("budget-dock-positions-v2", JSON.stringify(nextPositions));
  }

  function resetPositionsDock() {
    const defaults = {
      account: { x: Math.max(10, window.innerWidth - 870), y: 12 },
      calendar: { x: Math.max(10, window.innerWidth - 870), y: 76 },
      user: { x: Math.max(10, window.innerWidth - 690), y: 76 },
      actions: { x: Math.max(10, window.innerWidth - 470), y: 76 },
      security: { x: Math.max(10, window.innerWidth - 250), y: 76 },
    };

    sauvegarderPositionsDock(defaults);
  }

  function demarrerDragDock(e, dockKey, options = {}) {
    if (
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "SELECT" ||
      e.target.tagName === "INPUT"
    ) {
      return;
    }

    e.preventDefault();

    const largeur = options.width || 320;
    const hauteur = options.height || 70;
    const departX = e.clientX;
    const departY = e.clientY;
    const positionDepart = dockPositions[dockKey] || { x: 10, y: 10 };

    function bouger(ev) {
      const nextPosition = limiterPositionDock(
        {
          x: positionDepart.x + (ev.clientX - departX),
          y: positionDepart.y + (ev.clientY - departY),
        },
        largeur,
        hauteur
      );

      setDockPositions((prev) => ({
        ...prev,
        [dockKey]: nextPosition,
      }));
    }

    function finir(ev) {
      const nextPosition = limiterPositionDock(
        {
          x: positionDepart.x + (ev.clientX - departX),
          y: positionDepart.y + (ev.clientY - departY),
        },
        largeur,
        hauteur
      );

      sauvegarderPositionsDock({
        ...dockPositions,
        [dockKey]: nextPosition,
      });

      window.removeEventListener("mousemove", bouger);
      window.removeEventListener("mouseup", finir);
    }

    window.addEventListener("mousemove", bouger);
    window.addEventListener("mouseup", finir);
  }


  function celluleFixe(content, index, extra = {}, attrs = {}) {
    return (
      <td
        {...attrs}
        style={{
          ...styles.td,
          ...styles.stickyCell,
          left: leftOffset(index),
          minWidth: colonnesFixes[index].width,
          width: colonnesFixes[index].width,
          ...extra,
        }}
      >
        {content}
      </td>
    );
  }

  function sauvegarderValeurs3177(nextValues) {
    setValeurs3177(nextValues);
    localStorage.setItem(getValeurs3177StorageKey(), JSON.stringify(nextValues));
  }

  function lireValeur3177(id, champ, defaut = 0) {
    const valeur = valeurs3177?.[id]?.[champ];
    return valeur === undefined || valeur === null || valeur === ""
      ? round2(defaut)
      : round2(Number(valeur) || 0);
  }

  function modifierValeur3177(id, champ, valeur) {
    const numericValue = String(valeur).replace(",", ".");
    const cleanValue = numericValue === "" ? "" : round2(Number(numericValue)).toFixed(2);

    const nextValues = {
      ...valeurs3177,
      [id]: {
        ...(valeurs3177[id] || {}),
        [champ]: cleanValue,
      },
    };

    sauvegarderValeurs3177(nextValues);
  }

  function construireTableau3177() {
    // IMPORTANT :
    // Le 3177 doit afficher exactement les mêmes lignes que le tableau visible du 3185.
    // On filtre donc avec BLOCS_FIXES, puis on garde l'ordre par bloc comme dans groupesFiltres.
    const lignesVisibles3185 = [];

    for (const bloc of BLOCS_FIXES) {
      const lignesBloc = data.filter((item) => normaliserBloc(item.bloc) === bloc);
      lignesVisibles3185.push(...lignesBloc);
    }

    return lignesVisibles3185.map((item, index) => {
      const id = item.id || `ligne-${index}`;

      // Correction : le 3177 commence à 0.
      // Avant, le gain reprenait automatiquement le montant du 3185,
      // ce qui créait un total de gains élevé même quand tout était à 0.
      const gainDefaut = 0;
      const gains = round2(lireValeur3177(id, "gains", gainDefaut));

      const depenses = Array.from({ length: 7 }, (_, i) =>
        round2(lireValeur3177(id, `depense${i + 1}`, 0))
      );

      const totalDepenses = round2(depenses.reduce((acc, val) => acc + Number(val || 0), 0));
      const solde = round2(gains - totalDepenses);

      return {
        id,
        index,
        bloc: item.bloc || "SANS BLOC",
        description: item.description || "-",
        gains,
        depenses,
        totalDepenses,
        solde,
        echeance: item.echeance || "",
      };
    });
  }

  function renduInput3177(ligne, champ, valeur, align = "right") {
    const cleInput = `${ligne.id}-${champ}`;
    const valeurSauvee = valeurs3177?.[ligne.id]?.[champ];
    const estActif = input3177Actif === cleInput;

    const valeurAffichee = estActif
      ? String(valeurSauvee ?? "")
      : Number(
          valeurSauvee === undefined || valeurSauvee === null || valeurSauvee === ""
            ? valeur || 0
            : valeurSauvee
        ).toFixed(2);

    return (
      <input
        type="text"
        inputMode="decimal"
        value={valeurAffichee}
        onFocus={() => setInput3177Actif(cleInput)}
        onChange={(e) => {
          const texte = e.target.value.replace(",", ".");
          if (/^-?\d*\.?\d*$/.test(texte)) {
            const nextValues = {
              ...valeurs3177,
              [ligne.id]: {
                ...(valeurs3177[ligne.id] || {}),
                [champ]: texte,
              },
            };
            sauvegarderValeurs3177(nextValues);
          }
        }}
        onBlur={(e) => {
          modifierValeur3177(ligne.id, champ, e.target.value);
          setInput3177Actif(null);
        }}
        style={{
          ...styles.bank3177Input,
          textAlign: align,
        }}
      />
    );
  }

  function renduTableauEntreeArgent() {
    const revenusLignes = data.filter((item) => item.type === "revenu");

    const totalGains = revenusLignes.reduce((acc, item) => acc + calculerMontants(item).semaine, 0);

    const lignesAffichage = revenusLignes.length
      ? revenusLignes
      : DESCRIPTIONS_REVENUS.filter((desc) => desc !== "AUTRE").map((desc, index) => ({
          id: `revenu-vide-${index}`,
          description: desc,
          montant: 0,
          mode: "semaine",
          type: "revenu",
          semaines_payees: [],
          echeance: null,
          date: "",
          __vide: true,
        }));

    return (
      <div key={compteActif} style={styles.pageSwitchAnimation}>
        <div style={styles.incomeBankShell}>
          <div style={styles.incomeBankTitle}>ENTRÉE D’ARGENT</div>

          <div style={styles.incomeBankToolbar}>
            <div style={styles.stepPill}>1</div>
            <span style={styles.toolbarLabel}>DESCRIPTION</span>

            <select
              value={revenuDescription}
              onChange={(e) => setRevenuDescription(e.target.value)}
              style={styles.incomeSelect}
            >
              <option value="">Choisir une entrée d’argent</option>
              {DESCRIPTIONS_REVENUS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {revenuDescription === "AUTRE" && (
              <input
                value={revenuDescriptionAutre}
                onChange={(e) => setRevenuDescriptionAutre(e.target.value)}
                placeholder="Nouvelle description"
                style={styles.incomeTextInput}
              />
            )}

            <input
              value={revenuPrecision}
              onChange={(e) => setRevenuPrecision(e.target.value)}
              placeholder="Précision ex: nom, enfant..."
              style={styles.incomeTextInput}
            />

            <input
              value={revenuMontant}
              onChange={(e) => setRevenuMontant(e.target.value)}
              placeholder="Montant"
              type="number"
              step="0.01"
              style={styles.incomeAmountInput}
            />

            <select
              value={revenuMode}
              onChange={(e) => setRevenuMode(e.target.value)}
              style={styles.incomeModeSelect}
            >
              <option value="semaine">Semaine</option>
              <option value="mois">Mois</option>
              <option value="annee">Année</option>
            </select>

            <input
              type="date"
              value={revenuDate}
              onChange={(e) => setRevenuDate(e.target.value)}
              style={styles.incomeDateInput}
            />

            <button
              onClick={ajouterRevenu}
              style={styles.incomeAddButtonBank}
              type="button"
              disabled={loading}
            >
              {loading ? "..." : "+ Ajouter"}
            </button>
          </div>

          <div style={styles.bank3177TableShell}>
            <table style={styles.bank3177Table}>
              <thead>
                <tr>
                  <th style={{ ...styles.bank3177Header, width: "34%" }}>DESCRIPTION</th>
                  <th style={{ ...styles.bank3177Header, width: "12%" }}>GAINS</th>
                  <th style={{ ...styles.bank3177Header }} colSpan={7}>DÉPENSES</th>
                  <th style={{ ...styles.bank3177Header, width: "12%" }}>SOLDE</th>
                </tr>
                <tr>
                  <th style={styles.bank3177SubHeader}></th>
                  <th style={styles.bank3177SubHeader}></th>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <th key={index} style={styles.bank3177SubHeader}>Dép. {index + 1}</th>
                  ))}
                  <th style={styles.bank3177SubHeader}></th>
                </tr>
              </thead>

              <tbody>
                {lignesAffichage.map((item, index) => {
                  const gain = item.__vide ? 0 : calculerMontants(item).semaine;
                  return (
                    <tr key={item.id || index}>
                      <td style={styles.bank3177DescriptionCell}>
                        <span style={styles.bank3177RowNumber}>{index + 1}</span>
                        {item.description}
                      </td>

                      <td style={styles.bank3177InputCell}>
                        <div style={styles.bank3177AmountBox}>{formatArgent(gain)}</div>
                      </td>

                      {Array.from({ length: 7 }).map((_, depIndex) => (
                        <td key={depIndex} style={styles.bank3177InputCell}>
                          <div style={styles.bank3177AmountBox}>0.00</div>
                        </td>
                      ))}

                      <td style={styles.bank3177SoldeCell}>{formatArgent(gain)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={styles.bank3177Footer}>
              <div style={styles.bank3177FooterMetric}>
                <span style={styles.bank3177FooterLabel}>Gains</span>
                <strong style={styles.bank3177FooterValue}>{formatArgent(totalGains)}</strong>
              </div>

              <div style={{ ...styles.bank3177FooterMetric, ...styles.bank3177FooterSolde }}>
                <span style={styles.bank3177FooterLabel}>Solde total</span>
                <strong style={styles.bank3177FooterValue}>{formatArgent(totalGains)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renduTableau3177() {
    const lignes3177 = construireTableau3177();
    const totalGains = lignes3177.reduce((acc, item) => acc + Number(item.gains || 0), 0);
    const totalSolde = lignes3177.reduce((acc, item) => acc + Number(item.solde || 0), 0);

    return (
      <div key={compteActif} style={styles.pageSwitchAnimation}>
        <div style={styles.bank3177Shell}>
          <div style={styles.bank3177Header}>
            <div>
              <div style={styles.bank3177Kicker}>Compte miroir automatique</div>
              <div style={styles.bank3177Title}>{compteArgentAccumule || compteActif}</div>
            </div>
          </div>

          <div style={styles.bank3177Note}>
            Les descriptions sont synchronisées automatiquement avec le compte <strong>{comptePrincipalBudget}</strong>. Tu peux modifier les gains et entrer jusqu’à 7 dépenses par ligne.
          </div>

          <div style={styles.bank3177TableWrap}>
            <table style={styles.bank3177Table}>
              <thead>
                <tr>
                  <th style={{ ...styles.bank3177Th, width: "31%" }}>DESCRIPTION</th>
                  <th style={{ ...styles.bank3177Th, width: "11%" }}>GAINS</th>
                  <th style={styles.bank3177Th} colSpan={7}>DÉPENSES</th>
                  <th style={{ ...styles.bank3177Th, width: "11%" }}>SOLDE</th>
                </tr>
                <tr>
                  <th style={styles.bank3177SubTh}></th>
                  <th style={styles.bank3177SubTh}></th>
                  {Array.from({ length: 7 }, (_, i) => (
                    <th key={`dep-head-${i}`} style={styles.bank3177SubTh}>Dép. {i + 1}</th>
                  ))}
                  <th style={styles.bank3177SubTh}></th>
                </tr>
              </thead>

              <tbody>
                {lignes3177.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={styles.bank3177Empty}>
                      Aucune ligne dans le compte Enveloppes.
                    </td>
                  </tr>
                ) : (
                  lignes3177.map((ligne) => {
                    const sectionColor =
                      ligne.bloc.includes("ECOLE")
                        ? "#fdf2f8"
                        : ligne.bloc.includes("AUTOMOBILES")
                        ? "#f8fafc"
                        : ligne.bloc.includes("MAISON")
                        ? "#f0fdf4"
                        : "#ffffff";

                    return (
                      <tr key={ligne.id}>
                        <td style={{ ...styles.bank3177TdDescription, background: sectionColor }}>
                          <span style={styles.bank3177LineNumber}>{ligne.index + 1}</span>
                          <span>{ligne.description}</span>
                        </td>

                        <td style={styles.bank3177TdInput}>
                          {renduInput3177(ligne, "gains", ligne.gains)}
                        </td>

                        {ligne.depenses.map((valeur, depIndex) => (
                          <td key={`${ligne.id}-dep-${depIndex}`} style={styles.bank3177TdInput}>
                            {renduInput3177(ligne, `depense${depIndex + 1}`, valeur)}
                          </td>
                        ))}

                        <td style={styles.bank3177TdSolde}>
                          {formatArgent(ligne.solde)}
                        </td>
                      </tr>
                    );
                  })
                )}

                <tr>
                  <td colSpan={10} style={styles.bank3177BottomSpacer}></td>
                </tr>
              </tbody>
            </table>
            <div style={styles.bottomSafeSpacer} />
          </div>

          <div style={styles.bank3177Footer}>
            <div style={{ ...styles.bank3177FooterMetric, ...styles.bank3177FooterGains }}>
              <span style={styles.bank3177FooterLabel}>Gains</span>
              <strong style={styles.bank3177FooterValue}>{formatArgent(totalGains)}</strong>
            </div>

            <div style={{ ...styles.bank3177FooterMetric, ...styles.bank3177FooterSolde }}>
              <span style={styles.bank3177FooterLabel}>Solde total</span>
              <strong style={styles.bank3177FooterValue}>{formatArgent(totalSolde)}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function headerFixe(content, index, extra = {}) {
    return (
      <th
        style={{
          ...styles.th,
          ...styles.stickyHeader,
          left: leftOffset(index),
          minWidth: colonnesFixes[index].width,
          width: colonnesFixes[index].width,
          ...extra,
        }}
      >
        {content}
      </th>
    );
  }

  const categoriesTriees = trierCategories(STRUCTURE_BUDGET[blocActif] || ["Autre"]);
  const comptePrincipalBudget = trouverCompteParIntitule("Enveloppes");
  const compteArgentAccumule = trouverCompteParIntitule("Argent accumulé");
  const afficherTableauDetaille = compteEstEnveloppes(compteActif);


  if (authLoading) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={styles.loginTitle}>Chargement...</div>
          <div style={styles.loginSubtitle}>Vérification de la session sécurisée</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <style>{`
          html, body, #root {
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100vh;
            background: radial-gradient(circle at 18% 8%, rgba(34, 211, 238, 0.14), transparent 28%), linear-gradient(135deg, #020617 0%, #06101f 55%, #000000 100%);
          }

          * {
            box-sizing: border-box;
          }
 
          @media (max-width: 1450px) {
            .budget-title-wrap {
              margin-top: 46px !important;
            }
          }

          body {
            overflow-x: hidden;
            overflow-y: hidden;
          }

          @keyframes teslaPulse {
            0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.55); }
            70% { box-shadow: 0 0 0 8px rgba(56,189,248,0); }
            100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
          }

          @keyframes teslaGlow {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.18); }
          }

          @keyframes pageFadeSlide {
            from {
              opacity: 0;
              transform: translateY(10px);
              filter: blur(3px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
              filter: blur(0);
            }
          }

          @keyframes bankGlow {
            0%, 100% {
              transform: translateY(0) rotate(-2deg);
              box-shadow:
                0 0 18px rgba(250,204,21,0.32),
                0 0 38px rgba(14,165,233,0.18),
                inset 0 1px 0 rgba(255,255,255,0.32);
            }
            50% {
              transform: translateY(-2px) rotate(-2deg);
              box-shadow:
                0 0 28px rgba(250,204,21,0.55),
                0 0 54px rgba(14,165,233,0.28),
                inset 0 1px 0 rgba(255,255,255,0.42);
            }
          }

          @keyframes bankScan {
            0% { transform: translateX(-90px) rotate(22deg); opacity: 0; }
            30% { opacity: 0.9; }
            100% { transform: translateX(110px) rotate(22deg); opacity: 0; }
          }
        `}</style>

        <div style={styles.loginPage}>
          <form onSubmit={seConnecter} style={styles.loginCard}>
            <div style={styles.loginGlow}></div>

            <div style={styles.loginTitle}>DASHBOARD BUDGET MAISON</div>
            <div style={styles.loginSubtitle}>
              Connexion sécurisée — accès autorisé seulement
            </div>

            <label style={styles.loginLabel}>Courriel</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={styles.loginInput}
              autoFocus
            />

            <label style={styles.loginLabel}>Mot de passe</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={styles.loginInput}
            />

            {loginError && <div style={styles.loginError}>{loginError}</div>}

            <button type="submit" style={styles.loginButton} disabled={authLoading}>
              {authLoading ? "Connexion..." : "Se connecter"}
            </button>

            <div style={styles.loginNote}>
              Accès sécurisé par Supabase Auth
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100vh;
          background: radial-gradient(circle at 18% 8%, rgba(34, 211, 238, 0.14), transparent 28%), radial-gradient(circle at 82% 12%, rgba(250, 204, 21, 0.10), transparent 24%), linear-gradient(135deg, #06101f 0%, #08172a 48%, #020617 100%);
        }

        * {
          box-sizing: border-box;
        }

        body {
          overflow: hidden;
        }

        button {
          transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
        }

        button:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .budget-row:hover td {
          background-color: #eef6ff !important;
          box-shadow: inset 0 0 0 9999px rgba(14, 165, 233, 0.055);
        }

        .budget-row:hover .delete-row-button {
          opacity: 1 !important;
          transform: scale(1) !important;
        }

        .delete-row-button:hover {
          filter: brightness(1.16);
          transform: scale(1.08) !important;
          box-shadow: 0 0 24px rgba(239,68,68,0.62), inset 0 1px 0 rgba(255,255,255,0.34) !important;
        }

        .glass-glow {
          position: relative;
          overflow: hidden;
        }

        .glass-glow::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.07) 45%, transparent 70%);
          transform: translateX(-120%);
          animation: glassSweep 5.5s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes floatingHeaderPulse {
          0%, 100% { transform: translateY(0); filter: brightness(1); }
          50% { transform: translateY(-1px); filter: brightness(1.08); }
        }

        @keyframes glassSweep {
          0% { transform: translateX(-120%); }
          48% { transform: translateX(-120%); }
          70% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }

      `}</style>

      <div style={styles.page}>
        <div className="budget-title-wrap" style={styles.titleHero}>
        <div style={styles.bankPremiumIcon}>
              <div style={styles.bankCardChip}></div>
              <div style={styles.bankCardLine}></div>
              <div style={styles.bankCardDot}></div>
              <div style={styles.bankCardScan}></div>
            </div>
        <div>
          <div style={styles.titleSmall}>Budget personnel · Interface PRO</div>
          <h1 style={styles.title}>DASHBOARD BUDGET MAISON</h1>
        </div>
      </div>

      <div
        onMouseDown={(e) => demarrerDragDock(e, "account", { width: 700, height: 64 })}
        style={{
          ...styles.floatingMiniDock,
          left: dockPositions.account.x,
          top: dockPositions.account.y,
          borderColor: weekGlowSoft,
          boxShadow: `0 14px 42px rgba(0,0,0,0.34), 0 0 22px ${weekGlowSoft}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
        title="Glisse cette barre pour la déplacer"
      >
        <div style={styles.miniDockHandle}>☰ Compte</div>

        <span style={styles.commandLabel}>Page / compte</span>

        <select
          value={compteActif}
          onChange={(e) => changerCompteActif(e.target.value)}
          style={styles.accountSelectClean}
          title="Changer de page comme un onglet Excel"
        >
          {comptesBudget.map((compte) => (
            <option key={compte} value={compte}>
              {compte}
            </option>
          ))}
        </select>

        <button onClick={renommerCompteActif} style={styles.cleanButton} type="button">
          Changer numéro
        </button>

        <input
          value={nouveauCompte}
          onChange={(e) => setNouveauCompte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ajouterCompteBudget();
          }}
          placeholder="Nouveau compte"
          style={styles.accountInputClean}
        />

        <button onClick={ajouterCompteBudget} style={styles.cleanButton} type="button">
          + Page
        </button>

        <button onClick={supprimerCompteActif} style={styles.cleanDangerIconButton} type="button">
          🗑
        </button>
      </div>

      <div
        onMouseDown={(e) => demarrerDragDock(e, "calendar", { width: 180, height: 58 })}
        style={{
          ...styles.floatingMiniDock,
          left: dockPositions.calendar.x,
          top: dockPositions.calendar.y,
          borderColor: weekGlowSoft,
          boxShadow: `0 14px 32px rgba(0,0,0,0.30), 0 0 18px ${weekGlowSoft}`,
        }}
        title="Glisse cette barre pour la déplacer"
      >
        <div style={styles.miniDockHandle}>☰ Date</div>

        <button
          onClick={() => setShowCalendarPanel(true)}
          style={{
            ...styles.weekCalendarButtonClean,
            borderColor: weekGlowColor,
            boxShadow: `0 0 16px ${weekGlowSoft}, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
          type="button"
        >
          S{semaineActuelle}
        </button>

        <div style={styles.dateMiniBoxClean}>
          {nowLive.getDate()} {moisActuelTexte}
        </div>
      </div>

      <div
        onMouseDown={(e) => demarrerDragDock(e, "user", { width: 250, height: 58 })}
        style={{
          ...styles.floatingMiniDock,
          left: dockPositions.user.x,
          top: dockPositions.user.y,
          borderColor: "rgba(34,197,94,0.28)",
        }}
        title="Glisse cette barre pour la déplacer"
      >
        <div style={styles.miniDockHandle}>☰ Utilisateur</div>
        <div style={styles.userBadge}>🟢 {session?.user?.email}</div>
        <button
          onClick={() => {
            setPasswordMessage("");
            setNewPassword("");
            setNewPasswordConfirm("");
            setShowPasswordModal(true);
          }}
          style={styles.passwordChangeButton}
          type="button"
          title="Modifier mon mot de passe"
        >
          🔐 Mot de passe
        </button>
      </div>

      <div
        onMouseDown={(e) => demarrerDragDock(e, "actions", { width: 280, height: 58 })}
        style={{
          ...styles.floatingMiniDock,
          left: dockPositions.actions.x,
          top: dockPositions.actions.y,
          borderColor: "rgba(56,189,248,0.28)",
        }}
        title="Glisse cette barre pour la déplacer"
      >
        <div style={styles.miniDockHandle}>☰ Actions</div>

        <button onClick={sauvegardeManuelle} style={styles.cleanButton} type="button">
          Sauvegarder
        </button>

        <button onClick={ouvrirTimeMachine} style={styles.cleanButton} type="button">
          Time Machine
        </button>
      </div>

      <div
        onMouseDown={(e) => demarrerDragDock(e, "security", { width: 220, height: 96 })}
        style={{
          ...styles.floatingMiniDock,
          left: dockPositions.security.x,
          top: dockPositions.security.y,
          borderColor: "rgba(248,113,113,0.30)",
        }}
        title="Glisse cette barre pour la déplacer"
      >
        <div style={styles.miniDockHandle}>
          ☰ Sécurité
          <button
            onClick={resetPositionsDock}
            style={styles.dockResetButton}
            type="button"
            title="Replacer toutes les barres"
          >
            ↺
          </button>
        </div>

        <button onClick={reinitialiserTout} style={styles.cleanWarningButton} type="button">
          Réinitialiser
        </button>

        <button onClick={seDeconnecter} style={styles.cleanLogoutButton} type="button">
          Déconnexion
        </button>
      </div>

      {showRevenuModal && (
        <div style={styles.passwordModalOverlay}>
          <form onSubmit={ajouterRevenu} style={styles.revenuModalCard}>
            <div style={styles.passwordModalTitle}>Entrée d’argent</div>
            <div style={styles.passwordModalSubtitle}>
              Ajoute un revenu dans le compte : {compteActif}
            </div>

            <label style={styles.loginLabel}>Description</label>
            <select
              value={revenuDescription}
              onChange={(e) => setRevenuDescription(e.target.value)}
              style={styles.loginInput}
              autoFocus
            >
              <option value="">Choisir une entrée d’argent</option>
              {DESCRIPTIONS_REVENUS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {revenuDescription === "AUTRE" && (
              <input
                type="text"
                value={revenuDescriptionAutre}
                onChange={(e) => setRevenuDescriptionAutre(e.target.value)}
                placeholder="Écrire la description"
                style={{ ...styles.loginInput, marginTop: "8px" }}
              />
            )}

            <label style={styles.loginLabel}>Montant</label>
            <input
              type="number"
              step="0.01"
              value={revenuMontant}
              onChange={(e) => setRevenuMontant(e.target.value)}
              placeholder="Ex: 1468.45"
              style={styles.loginInput}
            />

            <label style={styles.loginLabel}>Mode</label>
            <select
              value={revenuMode}
              onChange={(e) => setRevenuMode(e.target.value)}
              style={styles.loginInput}
            >
              <option value="semaine">Semaine</option>
              <option value="mois">Mois</option>
              <option value="annee">Année</option>
            </select>

            <label style={styles.loginLabel}>Date</label>
            <input
              type="date"
              value={revenuDate}
              onChange={(e) => setRevenuDate(e.target.value)}
              style={styles.loginInput}
            />

            <div style={styles.passwordModalActions}>
              <button
                type="button"
                onClick={() => {
                  setShowRevenuModal(false);
                  setRevenuDescription("");
                  setRevenuDescriptionAutre("");
                  setRevenuMontant("");
    setRevenuPrecision("");
                  setRevenuMode("semaine");
                  setRevenuDate(new Date().toISOString().slice(0, 10));
                }}
                style={styles.cleanButton}
              >
                Annuler
              </button>

              <button type="submit" style={styles.incomeSubmitButton} disabled={loading}>
                {loading ? "Ajout..." : "Ajouter l’entrée"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPasswordModal && (
        <div style={styles.passwordModalOverlay}>
          <form onSubmit={changerMotDePasse} style={styles.passwordModalCard}>
            <div style={styles.passwordModalTitle}>Modifier mon mot de passe</div>
            <div style={styles.passwordModalSubtitle}>
              Utilisateur : {session?.user?.email}
            </div>

            <label style={styles.loginLabel}>Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.loginInput}
              autoFocus
            />

            <label style={styles.loginLabel}>Confirmer le mot de passe</label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              style={styles.loginInput}
            />

            {passwordMessage && (
              <div style={passwordMessage.includes("succès") ? styles.passwordSuccess : styles.loginError}>
                {passwordMessage}
              </div>
            )}

            <div style={styles.passwordModalActions}>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordMessage("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                }}
                style={styles.cleanButton}
              >
                Annuler
              </button>

              <button type="submit" style={styles.loginButton} disabled={passwordLoading}>
                {passwordLoading ? "Modification..." : "Modifier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showGuide && (
        <div style={styles.guideOverlay}>
          <div style={styles.guidePanel}>
            <div style={styles.guideGlow}></div>

            <div style={styles.guideHeader}>
              <div>
                <div style={styles.guideKicker}>Assistant interactif</div>
                <div style={styles.guideTitle}>Assistant intelligent budget</div>
              </div>

              <button onClick={fermerGuide} style={styles.guideClose} title="Fermer">
                ×
              </button>
            </div>

            <div style={styles.guideGrid}>
              <div style={styles.guideCard}>
                <div style={styles.guideIcon}>1</div>
                <div>
                  <strong>Choisis un bloc</strong>
                  <p>Maison, assurances, école, automobile ou divers.</p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideIcon}>2</div>
                <div>
                  <strong>Ajoute une catégorie</strong>
                  <p>Choisis une dépense, ajoute une précision au besoin, puis entre le montant.</p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideIcon}>3</div>
                <div>
                  <strong>Choisis le mode</strong>
                  <p>Semaine, mois ou année. Tu peux aussi le changer directement dans le tableau.</p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideIcon}>4</div>
                <div>
                  <strong>Utilise le calendrier</strong>
                  <p>Clique une semaine pour ajouter ou enlever un X. Tout se recalcule automatiquement.</p>
                </div>
              </div>
            </div>

            <div style={styles.guideFooter}>
              <button onClick={fermerGuide} style={styles.guidePrimary}>
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalendarPanel && (
        <div style={styles.calendarOverlay}>
          <div style={styles.calendarPanel}>
            <div style={styles.calendarHeader}>
              <div>
                <div style={styles.calendarKicker}>Calendrier interactif</div>
                <div style={styles.calendarTitle}>{moisCalendrierTexte}</div>
              </div>
              <button onClick={() => setShowCalendarPanel(false)} style={styles.calendarClose} type="button">×</button>
            </div>

            <div style={styles.calendarActions}>
              <button onClick={() => changerMoisCalendrier(-1)} style={styles.calendarNavButton} type="button">◀ Mois précédent</button>
              <div style={styles.calendarWeekBadge}>Semaine actuelle <strong>{semaineActuelle}</strong></div>
              <button onClick={() => changerMoisCalendrier(1)} style={styles.calendarNavButton} type="button">Mois suivant ▶</button>
            </div>

            <div style={styles.calendarDaysHeader}>
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => <div key={j}>{j}</div>)}
            </div>

            <div style={styles.calendarGrid}>
              {joursCalendrier.map((date, index) => {
                const isToday = date && date.toDateString() === new Date().toDateString();
                const week = date ? getWeekNumberISO(date) : "";
                return (
                  <button
                    key={index}
                    onClick={() => choisirDateCalendrier(date)}
                    disabled={!date}
                    style={{ ...styles.calendarDay, ...(isToday ? styles.calendarToday : {}), ...(!date ? styles.calendarEmptyDay : {}) }}
                    type="button"
                    title={date ? `Choisir la semaine ${week}` : ""}
                  >
                    {date && (<><span style={styles.calendarDayNumber}>{date.getDate()}</span><span style={styles.calendarWeekSmall}>S{week}</span></>)}
                  </button>
                );
              })}
            </div>

            <div style={styles.calendarFooter}>
              Clique une date pour remplir automatiquement l’échéance avec le numéro de semaine.
            </div>
          </div>
        </div>
      )}

      {tmMessage && <div style={styles.tmToast}>✅ {tmMessage}</div>}

      {showResetModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.resetModal}>
            <div style={styles.modalGlow}></div>

            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalKicker}>Zone sécurisée</div>
                <div style={styles.modalTitle}>Réinitialisation complète</div>
              </div>

              <button
                onClick={() => setShowResetModal(false)}
                style={styles.modalClose}
                title="Fermer"
              >
                ×
              </button>
            </div>

            <div style={styles.modalWarning}>
              Cette action effacera toutes les lignes du tableau.
              Une sauvegarde de sécurité sera créée avant l’effacement.
            </div>

            <label style={styles.modalLabel}>Mot de passe de réinitialisation</label>
            <input
              type="password"
              value={resetPasswordInput}
              onChange={(e) => setResetPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmerReinitialisation();
                if (e.key === "Escape") setShowResetModal(false);
              }}
              placeholder="Entrer le mot de passe"
              style={styles.modalInput}
              autoFocus
            />

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowResetModal(false)}
                style={styles.cancelResetButton}
              >
                Annuler
              </button>

              <button
                onClick={confirmerReinitialisation}
                style={styles.confirmResetButton}
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.rightHeaderDock}>
        {showSnapshots && (
          <div style={styles.timeMachinePanel}>
            <div style={styles.tmHeader}>
              <div>
                <div style={styles.tmTitle}>Time Machine visuelle</div>
                <div style={styles.tmSubTitle}>
                  Ici, tu peux revenir dans le temps. Choisis une sauvegarde, puis restaure-la.
                  <br />
                  {totalSnapshots} sauvegarde(s) disponible(s)
                </div>
              </div>

              <button
                onClick={() => setShowSnapshots(false)}
                style={styles.tmClose}
                title="Fermer"
              >
                ×
              </button>
            </div>

            {totalSnapshots === 0 ? (
              <div style={styles.historyEmpty}>
                Aucune sauvegarde trouvée. Clique sur “💾 Sauvegarder” : la sauvegarde doit apparaître immédiatement ici.
              </div>
            ) : (
              <>
                <div style={styles.tmCurrentCard}>
                  <div style={styles.tmBadge}>Version sélectionnée</div>
                  <div style={styles.tmDate}>{formatSnapshotDate(snapshotActif.date)}</div>
                  <div style={styles.tmAction}>{snapshotActif.action}</div>
                  <div style={styles.tmCount}>
                    {snapshotActif.lignes.length} ligne(s) dans cette sauvegarde
                  </div>
                </div>

                <div style={styles.tmSliderWrap}>
                  <div style={styles.tmLabels}>
                    <span>Plus récent</span>
                    <span>Plus ancien</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max={Math.max(totalSnapshots - 1, 0)}
                    value={timeIndex}
                    onChange={(e) => setTimeIndex(Number(e.target.value))}
                    style={styles.tmSlider}
                  />

                  <div style={styles.tmDots}>
                    {snapshots.map((snap, index) => (
                      <button
                        key={snap.id}
                        onClick={() => setTimeIndex(index)}
                        title={`${formatSnapshotDate(snap.date)} - ${snap.action}`}
                        style={{
                          ...styles.tmDot,
                          ...(index === timeIndex ? styles.tmDotActive : {}),
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={styles.tmPreview}>
                  <div style={styles.tmPreviewTitle}>Aperçu rapide</div>
                  {snapshotActif.lignes.slice(0, 5).map((ligne, index) => (
                    <div key={`${snapshotActif.id}-${index}`} style={styles.tmPreviewRow}>
                      <span>{ligne.bloc}</span>
                      <strong>{ligne.description}</strong>
                    </div>
                  ))}
                  {snapshotActif.lignes.length > 5 && (
                    <div style={styles.tmMore}>
                      + {snapshotActif.lignes.length - 5} autre(s) ligne(s)
                    </div>
                  )}
                </div>

                <button
                  onClick={() => restaurerSnapshot(snapshotActif)}
                  style={styles.restoreBigButton}
                >
                  Restaurer cette version
                </button>
              </>
            )}
          </div>
        )}
      </div>

        {afficherTableauDetaille ? (
          <>
        <div style={styles.compactProToolbar}>
          <div style={styles.compactGroup}>
            <span style={styles.compactStep}>1</span>
            <span style={styles.compactLabel}>Bloc</span>

            <select
              value={blocActif}
              onChange={(e) => {
                setBlocActif(e.target.value);
                setDescription("");
                setDescriptionAutre("");
                setNoteEnfant("");
              }}
              style={styles.compactSelectBloc}
            >
              {BLOCS_FIXES.map((bloc) => (
                <option key={bloc} value={bloc}>
                  {bloc}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowGuide(true)}
              style={styles.compactAssistantButton}
              title="Ouvrir l’assistant intelligent"
              type="button"
            >
              ✦ Assistant
            </button>
          </div>

          <div style={styles.compactDivider} />

          <div style={styles.compactGroupLarge}>
            <span style={styles.compactStep}>2</span>
            <span style={styles.compactLabel}>Dépense</span>

            <select
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.compactSelectDepense}
            >
              <option value="">Choisir une dépense</option>
              {categoriesTriees.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {description === "Autre" && (
              <input
                placeholder="Nom de la dépense"
                value={descriptionAutre}
                onChange={(e) => setDescriptionAutre(e.target.value)}
                style={styles.compactInput}
              />
            )}

            <input
              placeholder="Précision ex: nom, enfant..."
              value={noteEnfant}
              onChange={(e) => setNoteEnfant(e.target.value)}
              style={styles.compactInput}
            />

            <input
              type="number"
              placeholder="Montant"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              style={styles.compactMoneyInput}
            />

            <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.compactModeSelect}>
              <option value="semaine">Semaine</option>
              <option value="mois">Mois</option>
              <option value="annee">Année</option>
            </select>

            <input
              type="number"
              placeholder="Éch. 1-52"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              style={styles.compactEcheanceInput}
            />

            


            <button onClick={ajouterLigne} style={styles.compactAddButton} disabled={loading}>
              {loading ? "..." : "+ Ajouter"}
            </button>
          </div>
        </div>

        {erreur && <div style={styles.error}>Erreur : {erreur}</div>}
<div key={compteActif} style={styles.pageSwitchAnimation}>
          {afficherTableauDetaille ? (
          <div
            ref={tableScrollRef}
            className="glass-glow"
            style={styles.tableWrapper}
            onScroll={(e) => {
              lastScrollRef.current = e.currentTarget.scrollLeft;
            }}
          >
            <table style={styles.table}>
            <thead>
              <tr>
                {headerFixe("DESCRIPTION", 0)}
                {headerFixe("MODE", 1)}
                {headerFixe("SEMAINE", 2)}
                {headerFixe("MOIS", 3)}
                {headerFixe("ANNÉE", 4)}
                {headerFixe("ÉCHÉANCE", 5)}
                {headerFixe("X", 6)}
                {headerFixe("ACCUMULÉ", 7)}
                {headerFixe("ACTION", 8)}
                <th style={styles.calendarTitle} colSpan={52}>
                  CALENDRIER POUR LES SEMAINES
                </th>
                <th style={styles.transferHeader}>
                  TRANSFERT
                </th>
              </tr>

            </thead>

            <tbody>
              {Object.keys(groupesFiltres).length === 0 ? (
                <tr>
                  <td colSpan={62} style={styles.empty}>
                    Sélectionne une dépense et ajoute une ligne.
                  </td>
                </tr>
              ) : (
                Object.entries(groupesFiltres).map(([nomBloc, lignes]) => {
                  const totalSemaine = lignes.reduce(
                    (acc, item) => acc + calculerMontants(item).semaine,
                    0
                  );
                  const totalMois = lignes.reduce(
                    (acc, item) => acc + calculerMontants(item).mois,
                    0
                  );
                  const totalAnnee = lignes.reduce(
                    (acc, item) => acc + calculerMontants(item).annee,
                    0
                  );

                  return (
                    <Fragment key={nomBloc}>
                      <tr>
                        <td colSpan={62} style={styles.blocRow}>
                          DÉPENSES : {nomBloc}
                        </td>
                      </tr>
{lignes.length === 0 ? (
                        <tr>
                          {celluleFixe("Aucune ligne dans ce bloc", 0, styles.tdLeft)}
                          {celluleFixe("", 1)}
                          {celluleFixe("", 2)}
                          {celluleFixe("", 3)}
                          {celluleFixe("", 4)}
                          {celluleFixe("", 5)}
                          {celluleFixe("", 6)}
                          {celluleFixe("", 7)}
                          {celluleFixe("", 8)}
                          <td colSpan={53} style={styles.emptyLine}></td>
                        </tr>
                      ) : (
                        lignes.map((item) => {
                          const calcul = calculerMontants(item);
                          const isDepense = item.type === "depense";
                          const nbX = semainesPayees(item).length;
                          const acc = montantAccumule(item);
                          const bal = balance(item);
                          const serieSemaines = semainesAfficheesPourLigne(item);

                          return (
                            <Fragment key={item.id}>
                              {/* Ligne du haut : progression / numéros */}
                              <tr className="budget-row">
                                {celluleFixe(
                                  ligneEditionInfo === item.id ? (
                                    <div style={styles.editInfoWrap}>
                                      <select
                                        value={descriptionEdition}
                                        onChange={(e) => setDescriptionEdition(e.target.value)}
                                        style={styles.editInfoSelect}
                                      >
                                        <option value="">Choisir</option>
                                        {trierCategories(STRUCTURE_BUDGET[item.bloc] || ["Autre"]).map((nom) => (
                                          <option key={nom} value={nom}>
                                            {nom}
                                          </option>
                                        ))}
                                      </select>

                                      <input
                                        value={noteEdition}
                                        onChange={(e) => setNoteEdition(e.target.value)}
                                        placeholder="Précision"
                                        style={styles.editInfoInput}
                                      />

                                      <button onClick={() => sauvegarderInfo(item)} style={styles.saveButton}>✓</button>
                                      <button onClick={annulerEditionInfo} style={styles.cancelButton}>×</button>
                                    </div>
                                  ) : (
                                    <div style={styles.descriptionRowTools}>
                                      <button
                                        onClick={() => commencerEditionInfo(item)}
                                        style={{ ...styles.descriptionEditButton, width: "100%" }}
                                        title="Cliquer pour modifier la catégorie / note"
                                      >
                                        {item.description || "-"}
                                      </button>
                                    </div>
                                  ),
                                  0,
                                  { ...styles.tdLeft, verticalAlign: "middle" },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(
                                  <select
                                    value={normaliserMode(item.mode)}
                                    onChange={(e) => changerModeLigne(item, e.target.value)}
                                    style={styles.modeSelectTable}
                                    title="Changer le mode de calcul"
                                  >
                                    <option value="semaine">Semaine</option>
                                    <option value="mois">Mois</option>
                                    <option value="annee">Année</option>
                                  </select>,
                                  1,
                                  { verticalAlign: "middle" },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(
                                  item.mode === "semaine" ? (
                                    ligneEdition === item.id ? (
                                      <div style={styles.editWrap}>
                                        <input
                                          type="number"
                                          value={montantEdition}
                                          onChange={(e) => setMontantEdition(e.target.value)}
                                          style={styles.editInput}
                                          autoFocus
                                        />
                                        <button onClick={() => sauvegarderMontant(item)} style={styles.saveButton}>✓</button>
                                        <button onClick={annulerEditionMontant} style={styles.cancelButton}>×</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => commencerEditionMontant(item)}
                                        style={styles.blueEditButton}
                                        title="Cliquer pour modifier le montant"
                                      >
                                        {formatArgent(calcul.semaine)}
                                      </button>
                                    )
                                  ) : (
                                    <span style={styles.amountPaleBadge}>{formatArgent(calcul.semaine)}</span>
                                  ),
                                  2,
                                  {
                                    ...(item.mode === "semaine" ? styles.blueInputCell : {}),
                                    verticalAlign: "middle",
                                  },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(
                                  item.mode === "mois" ? (
                                    ligneEdition === item.id ? (
                                      <div style={styles.editWrap}>
                                        <input
                                          type="number"
                                          value={montantEdition}
                                          onChange={(e) => setMontantEdition(e.target.value)}
                                          style={styles.editInput}
                                          autoFocus
                                        />
                                        <button onClick={() => sauvegarderMontant(item)} style={styles.saveButton}>✓</button>
                                        <button onClick={annulerEditionMontant} style={styles.cancelButton}>×</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => commencerEditionMontant(item)}
                                        style={styles.blueEditButton}
                                        title="Cliquer pour modifier le montant"
                                      >
                                        {formatArgent(calcul.mois)}
                                      </button>
                                    )
                                  ) : (
                                    <span style={styles.amountPaleBadge}>{formatArgent(calcul.mois)}</span>
                                  ),
                                  3,
                                  {
                                    ...(item.mode === "mois" ? styles.blueInputCell : {}),
                                    verticalAlign: "middle",
                                  },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(
                                  item.mode === "annee" ? (
                                    ligneEdition === item.id ? (
                                      <div style={styles.editWrap}>
                                        <input
                                          type="number"
                                          value={montantEdition}
                                          onChange={(e) => setMontantEdition(e.target.value)}
                                          style={styles.editInput}
                                          autoFocus
                                        />
                                        <button onClick={() => sauvegarderMontant(item)} style={styles.saveButton}>✓</button>
                                        <button onClick={annulerEditionMontant} style={styles.cancelButton}>×</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => commencerEditionMontant(item)}
                                        style={styles.blueEditButton}
                                        title="Cliquer pour modifier le montant"
                                      >
                                        {formatArgent(calcul.annee)}
                                      </button>
                                    )
                                  ) : (
                                    <span style={styles.amountPaleBadge}>{formatArgent(calcul.annee)}</span>
                                  ),
                                  4,
                                  {
                                    ...(item.mode === "annee" ? styles.blueInputCell : {}),
                                    verticalAlign: "middle",
                                  },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(
                                  echeanceEdition === item.id ? (
                                    <div style={styles.editWrap}>
                                      <input
                                        type="number"
                                        min="1"
                                        max="52"
                                        value={echeanceEditionValue}
                                        onChange={(e) => setEcheanceEditionValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") sauvegarderEcheance(item);
                                          if (e.key === "Escape") annulerEditionEcheance();
                                        }}
                                        style={styles.echeanceEditInput}
                                        autoFocus
                                      />
                                      <button onClick={() => sauvegarderEcheance(item)} style={styles.saveButton}>✓</button>
                                      <button onClick={annulerEditionEcheance} style={styles.cancelButton}>×</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => commencerEditionEcheance(item)}
                                      style={styles.echeanceEditButton}
                                      title="Cliquer pour modifier l’échéance"
                                    >
                                      {item.echeance || "-"}
                                    </button>
                                  ),
                                  5,
                                  { ...styles.blueText, verticalAlign: "middle" },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(nbX, 6, { verticalAlign: "middle" }, { rowSpan: 2 })}
                                {celluleFixe(formatArgent(acc), 7, { ...styles.accumuleCell, verticalAlign: "middle" }, { rowSpan: 2 })}
                                {celluleFixe(
                                  <div style={{ ...styles.actionGroup, justifyContent: "center" }}>
                                    <button
                                      onClick={() => viderXLigne(item)}
                                      style={{
                                        ...styles.clearXRowButton,
                                        opacity: nbX > 0 ? 1 : 0.45,
                                      }}
                                      title={nbX > 0 ? `Supprimer les ${nbX} X de cette ligne` : "Aucun X sur cette ligne"}
                                      type="button"
                                    >
                                      🧹 X
                                    </button>

                                    <button
                                      className="delete-row-button"
                                      onClick={() => supprimerLigne(item)}
                                      style={{ ...styles.deleteButton, opacity: 1, transform: "scale(1)" }}
                                      title="Supprimer la ligne"
                                      type="button"
                                    >
                                      🗑️
                                    </button>
                                  </div>,
                                  8,
                                  { verticalAlign: "middle" },
                                  { rowSpan: 2 }
                                )}

                                {serieSemaines.map((semaine) => {
                                  const payee = estPayee(item, semaine);
                                  const isEcheance = Number(item.echeance) === semaine;

                                  return (
                                    <td
                                      key={`top-${item.id}-${semaine}`}
                                      title={`Semaine ${semaine}`}
                                      style={{
                                        ...styles.weekTopCell,
                                        background: payee
                                          ? isDepense
                                            ? "#ff1b1b"
                                            : "#0058ff"
                                          : isEcheance
                                          ? "#c6e0b4"
                                          : "#ffffff",
                                        color: payee ? "#000" : "#000",
                                        outline: "none",
                                      }}
                                    >
                                      {semaine}
                                    </td>
                                  );
                                })}

                                <td style={styles.transferColumnCell} rowSpan={2}>
                                  <button
                                    type="button"
                                    onClick={() => transfererChiffre(item)}
                                    style={styles.transferButton}
                                    title="Transfert permis seulement avec 52 X. Pour retransférer : effacer tous les X puis remettre les 52 X."
                                  >
                                    ⇄
                                  </button>
                                </td>
                              </tr>

                              {/* Ligne du bas : cases X cliquables */}
                              <tr>
                                {serieSemaines.map((semaine) => {
                                  const payee = estPayee(item, semaine);
                                  const isEcheance = Number(item.echeance) === semaine;

                                  return (
                                    <td
                                      key={`x-${item.id}-${semaine}`}
                                      onClick={() => toggleSemaine(item, semaine)}
                                      title={`Semaine ${semaine}`}
                                      style={{
                                        ...styles.weekCell,
                                        background: payee
                                          ? isDepense
                                            ? "#ff1b1b"
                                            : "#0058ff"
                                          : isEcheance
                                          ? "#c6e0b4"
                                          : "#ffffff",
                                        outline: "none",
                                      }}
                                    >
                                      {payee ? "X" : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            </Fragment>
                          );
                        })
                      )}

                      <tr>
                        {celluleFixe("TOTAL", 0, styles.totalLeft)}
                        {celluleFixe("", 1, styles.totalCell)}
                        {celluleFixe(formatArgent(totalSemaine), 2, styles.totalCell)}
                        {celluleFixe(formatArgent(totalMois), 3, styles.totalCell)}
                        {celluleFixe(formatArgent(totalAnnee), 4, styles.totalCell)}
                        {celluleFixe("", 5, styles.totalCell)}
                        {celluleFixe("", 6, styles.totalCell)}
                        {celluleFixe("", 7, styles.totalCell)}
                        {celluleFixe("", 8, styles.totalCell)}
                        <td colSpan={53} style={styles.totalCalendar}></td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
            </table>
            <div style={styles.bottomSafeSpacer} />
          </div>
          ) : (
            <div style={styles.blankAccountPage}>
              <div style={styles.blankAccountCard}>
                <div style={styles.blankAccountKicker}>Page secondaire</div>
                <div style={styles.blankAccountTitle}>{compteActif}</div>
                <div style={styles.blankAccountText}>
                  Cette page est volontairement vide. Le tableau détaillé avec les semaines est affiché seulement dans le compte principal : <strong>{comptePrincipalBudget}</strong>.
                </div>
              </div>
            </div>
          )}
        </div>
          </>
        ) : compteEstEntreeArgent(compteActif) ? (
          renduTableauEntreeArgent()
        ) : compteEstArgentAccumule(compteActif) ? (
          renduTableau3177()
        ) : (
          <div key={compteActif} style={styles.pageSwitchAnimation}>
            <div style={styles.blankAccountPage}>
              <div style={styles.blankAccountCard}>
                <div style={styles.blankAccountKicker}>Compte sans tableau détaillé</div>
                <div style={styles.blankAccountTitle}>{compteActif}</div>
                <div style={styles.blankAccountText}>
                  Cette page est volontairement blanche. Les lignes avec montants et semaines sont conservées uniquement dans <strong>{comptePrincipalBudget}</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.excelTabsBar}>
          {comptesBudget.map((compte) => {
            const couleur = couleurCompte(compte);
            const actif = compteActif === compte;

            return (
              <button
                key={compte}
                draggable
                onDragStart={() => onDragStartCompte(compte)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropCompte(compte)}
                onDoubleClick={() => commencerEditionCompte(compte)}
                onClick={() => changerCompteActif(compte)}
                style={{
                  ...styles.excelTab,
                  borderTop: `4px solid ${couleur}`,
                  ...(actif ? styles.excelTabActive : {}),
                  ...(actif ? { color: couleur } : {}),
                }}
                title="Clique pour ouvrir. Double-clic pour changer le numéro. Glisse pour déplacer."
              >
                {compteEdition === compte ? (
                  <input
                    value={compteEditionValeur}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setCompteEditionValeur(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") validerRenameCompte();
                      if (e.key === "Escape") setCompteEdition(null);
                    }}
                    onBlur={validerRenameCompte}
                    style={styles.excelTabRenameInput}
                    autoFocus
                  />
                ) : (
                  compte
                )}
              </button>
            );
          })}
        </div>

        {afficherTableauDetaille && (
          <div style={styles.financeNavBar}>
            <div style={styles.financeNavShell}>
              <button onClick={() => scrollTableTo("start")} style={styles.financeNavButton}>
                ⏮ Début
              </button>

              <button onClick={() => scrollTableBy(-700)} style={styles.financeNavButton}>
                ◀ Gauche
              </button>

              <div style={styles.financeNavCenter}>
                <div style={styles.financeNavTopLine}>
                  <span>Navigation calendrier</span>
                  <strong>{Math.round((scrollInfo.left / Math.max(scrollInfo.max, 1)) * 100)}%</strong>
                </div>

                <div style={styles.financeTrackOuter}>
                  <div
                    style={{
                      ...styles.financeTrackFill,
                      width: `${Math.round((scrollInfo.left / Math.max(scrollInfo.max, 1)) * 100)}%`,
                    }}
                  />
                </div>

                <div ref={bottomScrollRef} style={styles.financeBottomScroll}>
                  <div style={{ width: "4000px", height: "1px" }} />
                </div>
              </div>

              <button onClick={() => scrollTableBy(700)} style={styles.financeNavButton}>
                Droite ▶
              </button>

              <button onClick={() => scrollTableTo("end")} style={styles.financeNavButton}>
                Fin ⏭
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  bank3177FooterMetric: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    height: "100%",
    padding: "0 10px",
  },

  bank3177FooterGains: {
    gridColumn: "2 / 3",
    justifyContent: "center",
    justifySelf: "center",
  },

  bank3177FooterSolde: {
    gridColumn: "4 / 5",
    justifyContent: "center",
    justifySelf: "center",
    transform: "translateX(-18px)",
  },

  bank3177FooterSpacer: {
    minWidth: 0,
  },

  bank3177FooterValue: {
    minWidth: "155px",
    height: "40px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(34,197,94,0.85)",
    background: "linear-gradient(180deg, #071a12 0%, #020617 100%)",
    color: "#86efac",
    fontSize: "18px",
    fontWeight: "950",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    fontVariantNumeric: "tabular-nums",
    boxShadow: "0 0 20px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.16)",
  },

  bank3177FooterLabel: {
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    whiteSpace: "nowrap",
  },

  bank3177Footer: {
    height: "72px",
    minHeight: "72px",
    padding: "10px 22px 10px 0",
    display: "grid",
    gridTemplateColumns: "31% 11% 47% 11%",
    alignItems: "center",
    gap: "0",
    background: "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
    borderTop: "1px solid rgba(56,189,248,0.55)",
    boxShadow: "0 -12px 28px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  bank3177BottomSpacer: {
    height: "18px",
    background: "#ffffff",
    border: "none",
  },

  bottomSafeSpacer: {
    height: "150px",
    minHeight: "150px",
    width: "100%",
    pointerEvents: "none",
  },

  financeNavigationDock: {
    position: "fixed",
    left: "50%",
    bottom: "78px",
    transform: "translateX(-50%)",
    width: "min(1180px, calc(100vw - 32px))",
    zIndex: 990,
    borderRadius: "18px",
    padding: "10px",
    background: "linear-gradient(180deg, rgba(2,8,23,0.95), rgba(3,15,35,0.98))",
    border: "1px solid rgba(56,189,248,0.35)",
    boxShadow: "0 -10px 28px rgba(0,0,0,0.42), 0 0 24px rgba(14,165,233,0.18)",
  },

  bank3177Input: {
    width: "100%",
    height: "24px",
    borderRadius: "7px",
    border: "1px solid #93c5fd",
    background: "linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)",
    color: "#020617",
    fontWeight: "800",
    fontSize: "12px",
    padding: "0 6px",
    outline: "none",
    fontVariantNumeric: "tabular-nums",
    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.08)",
  },

  bank3177TdInput: {
    border: "1px solid rgba(15,23,42,0.24)",
    padding: "3px 5px",
    background: "#ffffff",
    textAlign: "right",
  },

  bank3177SubTh: {
    position: "sticky",
    top: "29px",
    zIndex: 3,
    background: "#eaf3ff",
    color: "#0f172a",
    border: "1px solid rgba(148,163,184,0.45)",
    padding: "4px",
    fontSize: "11px",
    fontWeight: "650",
    textAlign: "center",
  },

  bank3177Empty: {
    padding: "36px",
    textAlign: "center",
    color: "#475569",
    fontWeight: "700",
    background: "#ffffff",
  },

  bank3177TotalSolde: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "7px 8px",
    fontWeight: "750",
    textAlign: "right",
  },

  bank3177TotalCell: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "7px 8px",
    fontWeight: "650",
    textAlign: "right",
  },

  bank3177TotalLabel: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "7px 8px",
    fontWeight: "650",
    textAlign: "right",
  },

  bank3177TdSolde: {
    border: "1px solid rgba(15,23,42,0.24)",
    padding: "5px 8px",
    color: "#0f172a",
    background: "#fdf4ff",
    fontWeight: "900",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },

  bank3177TdMoney: {
    border: "1px solid rgba(15,23,42,0.24)",
    padding: "5px 8px",
    color: "#0f172a",
    background: "#f8fafc",
    fontWeight: "600",
    textAlign: "right",
  },

  bank3177LineNumber: {
    minWidth: "24px",
    height: "20px",
    borderRadius: "6px",
    background: "#eaf3ff",
    border: "1px solid #93c5fd",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "650",
  },

  bank3177TdDescription: {
    border: "1px solid rgba(15,23,42,0.35)",
    padding: "4px 8px",
    color: "#0f172a",
    fontWeight: "600",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "28px",
  },

  bank3177Th: {
    position: "sticky",
    top: 0,
    zIndex: 3,
    background: "#020617",
    color: "#ffffff",
    border: "1px solid rgba(15,23,42,0.55)",
    padding: "6px",
    fontSize: "12px",
    fontWeight: "750",
    textAlign: "center",
    letterSpacing: "0.4px",
  },

  bank3177Table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    color: "#0f172a",
    fontSize: "12px",
  },

  bank3177TableWrap: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    background: "#ffffff",
    paddingBottom: "20px",
    scrollPaddingBottom: "90px",
  },

  bank3177Note: {
    padding: "8px 18px",
    background: "#eaf3ff",
    color: "#0f172a",
    borderBottom: "1px solid #bfdbfe",
    fontSize: "12px",
    fontWeight: "650",
  },

  bank3177SummaryCard: {
    minWidth: "135px",
    padding: "8px 10px",
    borderRadius: "12px",
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(147,197,253,0.24)",
    color: "#e5e7eb",
    display: "grid",
    gap: "2px",
    textAlign: "right",
  },

  bank3177Summary: {
    display: "none",
  },

  bank3177Title: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "950",
    letterSpacing: "1px",
    textShadow: "0 2px 0 rgba(0,0,0,0.40)",
  },

  bank3177Kicker: {
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "1.4px",
    textTransform: "uppercase",
  },

  bank3177Header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "16px",
    padding: "14px 18px",
    background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
    borderBottom: "1px solid rgba(147,197,253,0.30)",
  },

  bank3177Shell: {
    width: "calc(100vw - 12px)",
    maxWidth: "none",
    height: "calc(100vh - 305px)",
    minHeight: "390px",
    margin: "0 auto",
    borderRadius: "14px",
    border: "1px solid rgba(147,197,253,0.42)",
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
    overflow: "hidden",
    boxShadow: "0 18px 48px rgba(0,0,0,0.38), 0 0 34px rgba(56,189,248,0.13)",
    display: "flex",
    flexDirection: "column",
  },

  transferButton: {
    minWidth: "58px",
    height: "28px",
    borderRadius: "9px",
    border: "1px solid #93c5fd",
    background: "#eaf3ff",
    color: "#0f172a",
    fontWeight: "850",
    fontSize: "16px",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  transferColumnCell: {
    width: "82px",
    minWidth: "82px",
    textAlign: "center",
    verticalAlign: "middle",
    background: "#f8fafc",
    borderRight: "1px solid rgba(15,23,42,0.16)",
    borderBottom: "1px solid rgba(15,23,42,0.16)",
  },

  transferHeader: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "linear-gradient(180deg, #1d4ed8 0%, #2563eb 100%)",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "12px",
    padding: "6px",
    borderRight: "1px solid rgba(15,23,42,0.22)",
    textAlign: "center",
    whiteSpace: "nowrap",
    minWidth: "82px",
  },

  amountPaleBadge: {
    minWidth: "72px",
    height: "26px",
    padding: "0 9px",
    borderRadius: "8px",
    border: "1px solid #93c5fd",
    background: "#eaf3ff",
    color: "#0f172a",
    fontWeight: "650",
    fontSize: "12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
    whiteSpace: "nowrap",
  },

  yellowEditButton: {
    minWidth: "72px",
    height: "26px",
    padding: "0 9px",
    borderRadius: "8px",
    border: "1px solid #93c5fd",
    background: "#eaf3ff",
    color: "#0f172a",
    fontWeight: "650",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
    transition: "background 0.15s ease, border-color 0.15s ease",
    whiteSpace: "nowrap",
  },

  blueEditButton: {
    minWidth: "72px",
    height: "26px",
    padding: "0 9px",
    borderRadius: "8px",
    border: "1px solid #93c5fd",
    background: "#eaf3ff",
    color: "#0f172a",
    fontWeight: "650",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
    transition: "background 0.15s ease, border-color 0.15s ease",
    whiteSpace: "nowrap",
  },

  blueInputCell: {
    background: "#ffffff",
    border: "1px solid rgba(147,197,253,0.80)",
    color: "#0f172a",
    fontWeight: "650",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  descriptionEditButton: {
    minHeight: "24px",
    maxWidth: "calc(100% - 70px)",
    padding: "2px 6px",
    border: "1px solid rgba(15,23,42,0.18)",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "650",
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
  },

  clearXRowButton: {
    minWidth: "58px",
    height: "28px",
    padding: "0 10px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.58)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.32), rgba(2,6,23,0.12))",
    color: "#0f172a",
    fontWeight: "900",
    fontSize: "11px",
    cursor: "pointer",
    boxShadow: "0 0 12px rgba(56,189,248,0.16), inset 0 1px 0 rgba(255,255,255,0.45)",
    whiteSpace: "nowrap",
    backdropFilter: "blur(8px)",
  },

  descriptionRowTools: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    width: "100%",
  },

  compactAddButton: {
    height: "36px",
    padding: "0 16px",
    borderRadius: "12px",
    border: "1px solid rgba(250,204,21,0.52)",
    background: "linear-gradient(180deg, #facc15 0%, #ca8a04 100%)",
    color: "#111827",
    fontWeight: "950",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 0 16px rgba(250,204,21,0.20), inset 0 1px 0 rgba(255,255,255,0.20)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  compactAssistantButton: {
    height: "34px",
    padding: "0 13px",
    borderRadius: "11px",
    border: "1px solid rgba(56,189,248,0.36)",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#f0f9ff",
    fontWeight: "950",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 12px rgba(56,189,248,0.18), inset 0 1px 0 rgba(255,255,255,0.15)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  compactEcheanceInput: {
    height: "34px",
    width: "105px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: "900",
    textAlign: "center",
    outline: "none",
    flexShrink: 0,
  },

  compactModeSelect: {
    height: "34px",
    width: "120px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: "850",
    outline: "none",
    flexShrink: 0,
  },

  compactMoneyInput: {
    height: "34px",
    width: "120px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: "900",
    textAlign: "center",
    outline: "none",
    flexShrink: 0,
  },

  compactInput: {
    height: "34px",
    minWidth: "180px",
    flex: "0 1 210px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: "800",
    outline: "none",
  },

  compactSelectDepense: {
    height: "34px",
    minWidth: "240px",
    flex: "1 1 260px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: "850",
    outline: "none",
  },

  compactSelectBloc: {
    height: "34px",
    width: "420px",
    minWidth: "420px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: "850",
    outline: "none",
  },

  compactDivider: {
    width: "1px",
    height: "34px",
    background: "linear-gradient(180deg, transparent, rgba(125,211,252,0.45), transparent)",
    flexShrink: 0,
  },

  compactLabel: {
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "950",
    letterSpacing: "1px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },

  compactStep: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #0ea5e9, #075985)",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "950",
    boxShadow: "0 0 12px rgba(56,189,248,0.20)",
    flexShrink: 0,
  },

  compactGroupLarge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
    flexWrap: "nowrap",
  },

  compactGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
    minWidth: "620px",
  },

  compactProToolbar: {
    width: "min(1840px, calc(100vw - 20px))",
    margin: "0 auto 6px",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.90), rgba(15,23,42,0.68))",
    border: "1px solid rgba(56,189,248,0.22)",
    boxShadow: "0 14px 38px rgba(0,0,0,0.28), 0 0 22px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.07)",
    overflow: "visible",
  },

  dualPanelsWrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "10px",
  },

  dualPanelRight: {
    minWidth: 0,
  },

  dualPanelLeft: {
    minWidth: 0,
  },

  dualPanelsRow: {
    width: "min(1550px, calc(100vw - 28px))",
    display: "grid",
    gridTemplateColumns: "minmax(430px, 0.78fr) minmax(760px, 1.35fr)",
    gap: "14px",
    alignItems: "stretch",
  },

  financeBottomScroll: {
    width: "100%",
    height: "8px",
    overflow: "hidden",
    pointerEvents: "none",
  },

  financeTrackFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #22c55e, #06b6d4, #3b82f6)",
    boxShadow: "0 0 16px rgba(34,211,238,0.45)",
    transition: "width 0.18s ease",
  },

  financeTrackOuter: {
    height: "9px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.96)",
    border: "1px solid rgba(148,163,184,0.16)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 6px rgba(0,0,0,0.55)",
  },

  financeNavTopLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "950",
    letterSpacing: "1.1px",
    textTransform: "uppercase",
    textShadow: "0 0 10px rgba(34,211,238,0.34)",
  },

  financeNavCenter: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  financeNavButton: {
    height: "38px",
    borderRadius: "13px",
    border: "1px solid rgba(56,189,248,0.38)",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#ecfeff",
    fontWeight: "950",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 14px rgba(56,189,248,0.22), inset 0 1px 0 rgba(255,255,255,0.16)",
    whiteSpace: "nowrap",
  },

  financeNavShell: {
    minHeight: "54px",
    display: "grid",
    gridTemplateColumns: "116px 116px minmax(280px, 1fr) 116px 116px",
    alignItems: "center",
    gap: "10px",
    maxWidth: "1520px",
    margin: "0 auto",
    padding: "9px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.98), rgba(15,23,42,0.88))",
    border: "1px solid rgba(56,189,248,0.34)",
    boxShadow: "0 -8px 34px rgba(0,0,0,0.45), 0 0 28px rgba(34,211,238,0.16), inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  financeNavBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 980,
    padding: "8px 14px",
    background: "linear-gradient(180deg, rgba(2,6,23,0.22), rgba(2,6,23,0.98))",
    backdropFilter: "blur(14px)",
    borderTop: "1px solid rgba(34,211,238,0.22)",
    boxShadow: "0 -14px 38px rgba(0,0,0,0.50), 0 -2px 24px rgba(34,211,238,0.10)",
  },

  blankAccountText: {
    color: "#475569",
    fontSize: "14px",
    fontWeight: "750",
    lineHeight: 1.55,
  },

  blankAccountTitle: {
    color: "#0f172a",
    fontSize: "28px",
    fontWeight: "950",
    marginBottom: "10px",
  },

  blankAccountKicker: {
    color: "#0284c7",
    fontSize: "12px",
    fontWeight: "950",
    textTransform: "uppercase",
    letterSpacing: "1.3px",
    marginBottom: "8px",
  },

  blankAccountCard: {
    width: "min(760px, 92vw)",
    padding: "30px",
    borderRadius: "24px",
    background: "linear-gradient(180deg, #ffffff, #f1f5f9)",
    border: "1px solid rgba(15,23,42,0.10)",
    boxShadow: "0 22px 60px rgba(15,23,42,0.12)",
    color: "#0f172a",
    textAlign: "center",
  },

  blankAccountPage: {
    minHeight: "calc(100vh - 330px)",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    borderTop: "1px solid rgba(15,23,42,0.08)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "90px 20px 120px",
  },

  echeanceEditInput: {
    width: "54px",
    height: "26px",
    borderRadius: "7px",
    border: "1px solid rgba(14,165,233,0.45)",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: "900",
    textAlign: "center",
    outline: "none",
  },

  echeanceEditButton: {
    minWidth: "42px",
    height: "28px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid #93c5fd",
    background: "#eaf3ff",
    color: "#0f172a",
    fontWeight: "650",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  miniDockHandle: {
    height: "26px",
    padding: "0 8px",
    borderRadius: "10px",
    background: "rgba(2,6,23,0.48)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "950",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    cursor: "grab",
    whiteSpace: "nowrap",
  },

  floatingMiniDock: {
    position: "fixed",
    zIndex: 850,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    flexWrap: "wrap",
    padding: "8px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.96), rgba(15,23,42,0.78))",
    border: "1px solid rgba(56,189,248,0.22)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
    cursor: "grab",
    userSelect: "none",
  },

  dockResetButton: {
    height: "20px",
    width: "26px",
    padding: 0,
    borderRadius: "8px",
    border: "1px solid rgba(56,189,248,0.28)",
    background: "rgba(14,165,233,0.22)",
    color: "#e0f2fe",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "none",
  },

  dockDragHandle: {
    height: "26px",
    padding: "0 8px",
    borderRadius: "10px",
    background: "rgba(2,6,23,0.45)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "950",
    letterSpacing: "1px",
    textTransform: "uppercase",
    cursor: "grab",
  },

  loginPage: {
    minHeight: "100vh",
    width: "100vw",
    background:
      "radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.10), transparent 28%), linear-gradient(135deg, #020617 0%, #06101f 55%, #000000 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    color: "white",
  },

  loginCard: {
    position: "relative",
    width: "460px",
    padding: "28px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, rgba(8, 22, 40, 0.96), rgba(3, 7, 18, 0.98))",
    border: "1px solid rgba(56,189,248,0.28)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  loginGlow: {
    position: "absolute",
    top: "-80px",
    right: "-80px",
    width: "180px",
    height: "180px",
    borderRadius: "50%",
    background: "rgba(56,189,248,0.12)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },

  loginTitle: {
    position: "relative",
    fontSize: "23px",
    fontWeight: "900",
    letterSpacing: "0.5px",
    marginBottom: "8px",
    color: "#f8fafc",
    textShadow: "0 2px 0 #000",
  },

  loginSubtitle: {
    position: "relative",
    color: "#93c5fd",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "22px",
  },

  loginLabel: {
    display: "block",
    fontWeight: "900",
    marginBottom: "7px",
    marginTop: "14px",
    fontSize: "14px",
  },

  loginInput: {
    width: "100%",
    height: "42px",
    borderRadius: "10px",
    border: "1px solid rgba(250, 204, 21, 0.24)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(8,22,40,0.92))",
    color: "#f8fafc",
    padding: "0 12px",
    fontSize: "15px",
    fontWeight: "800",
    outline: "none",
    boxShadow: "inset 0 0 12px rgba(250,204,21,0.10)",
  },

  loginButton: {
    width: "100%",
    marginTop: "22px",
    padding: "13px",
    borderRadius: "11px",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "linear-gradient(180deg, #155e75, #075985)",
    color: "white",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(56,189,248,0.18), inset 0 1px 0 rgba(255,255,255,0.20)",
  },

  loginNote: {
    marginTop: "10px",
    padding: "10px",
    textAlign: "center",
    borderRadius: "10px",
    border: "1px solid rgba(250,204,21,0.22)",
    color: "#facc15",
    fontSize: "12px",
    fontWeight: "900",
    background: "rgba(250,204,21,0.05)",
  },

  loginError: {
    marginTop: "12px",
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: "13px",
  },

  logoutButton: {
    padding: "10px 15px",
    background: "linear-gradient(180deg, #7f1d1d 0%, #450a0a 100%)",
    color: "white",
    border: "1px solid rgba(248,113,113,0.48)",
    borderRadius: "12px",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(239,68,68,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
  },

  page: {
    minHeight: "100vh",
    background: "#020817",
    color: "#e5e7eb",
    paddingTop: "88px",
    paddingBottom: "132px",
    position: "relative",
  },

  title: {
    margin: 0,
    fontSize: "32px",
    letterSpacing: "4px",
    color: "#f8fafc",
    textShadow: "0 0 20px rgba(56,189,248,0.25), 0 2px 0 #000",
    lineHeight: 1.05,
    whiteSpace: "nowrap",
  },

  bankPremiumIcon: {
    position: "relative",
    width: "58px",
    height: "42px",
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, #facc15 0%, #eab308 36%, #0ea5e9 100%)",
    border: "1px solid rgba(250,204,21,0.58)",
    boxShadow:
      "0 0 22px rgba(250,204,21,0.38), 0 0 40px rgba(14,165,233,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
    overflow: "hidden",
    flexShrink: 0,
    animation: "bankGlow 3s ease-in-out infinite",
  },


  bankCardChip: {
    position: "absolute",
    left: "9px",
    top: "11px",
    width: "15px",
    height: "12px",
    borderRadius: "4px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.24))",
    border: "1px solid rgba(15,23,42,0.22)",
  },


  bankCardLine: {
    position: "absolute",
    left: "9px",
    bottom: "9px",
    width: "35px",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.34)",
  },


  bankCardDot: {
    position: "absolute",
    right: "9px",
    top: "10px",
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "#ffffff",
    boxShadow: "0 0 12px rgba(255,255,255,0.9)",
  },


  bankCardScan: {
    position: "absolute",
    top: "-20px",
    left: "-40px",
    width: "20px",
    height: "90px",
    background: "rgba(255,255,255,0.28)",
    filter: "blur(1px)",
    animation: "bankScan 3.4s ease-in-out infinite",
  },


  titleHero: {
    width: "fit-content",
    maxWidth: "720px",
    margin: "0 auto 18px",
    padding: "14px 26px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.96), rgba(15,23,42,0.76))",
    border: "1px solid rgba(56,189,248,0.28)",
    borderRadius: "22px",
    boxShadow: "0 18px 55px rgba(0,0,0,0.38), 0 0 34px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  titleIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #facc15, #b8860b)",
    boxShadow: "0 0 22px rgba(250,204,21,0.24)",
    fontSize: "25px",
  },

  titleSmall: {
    color: "#67e8f9",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "3px",
    textTransform: "uppercase",
    marginBottom: "4px",
  },

  smartHelpBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    margin: "6px 12px 8px",
    minHeight: "32px",
  },

  smartPill: {
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#cbd5e1",
    fontSize: "12px",
    fontWeight: "800",
    cursor: "help",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },

  helpButtonMini: {
    padding: "8px 18px",
    borderRadius: "999px",
    border: "1px solid rgba(56, 189, 248, 0.45)",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#f0f9ff",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "0.4px",
    cursor: "pointer",
    boxShadow: "0 0 16px rgba(56,189,248,0.24), inset 0 1px 0 rgba(255,255,255,0.18)",
  },

  guideOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10020,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(2, 6, 23, 0.68)",
    backdropFilter: "blur(10px)",
  },

  guidePanel: {
    position: "relative",
    width: "720px",
    maxWidth: "92vw",
    padding: "24px",
    borderRadius: "24px",
    background: "linear-gradient(180deg, rgba(8, 22, 40, 0.98), rgba(3, 7, 18, 0.98))",
    border: "1px solid rgba(56, 189, 248, 0.32)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.65), 0 0 40px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
    color: "#f8fafc",
  },

  guideGlow: {
    position: "absolute",
    top: "-100px",
    right: "-80px",
    width: "220px",
    height: "220px",
    borderRadius: "999px",
    background: "rgba(34, 211, 238, 0.16)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },

  guideHeader: {
    position: "relative",
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "18px",
  },

  guideKicker: {
    color: "#67e8f9",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },

  guideTitle: {
    fontSize: "28px",
    fontWeight: "900",
    letterSpacing: "0.6px",
    textShadow: "0 2px 0 #000",
  },

  guideClose: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15, 23, 42, 0.85)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: "26px",
  },

  guideGrid: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },

  guideCard: {
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    gap: "12px",
    padding: "14px",
    borderRadius: "16px",
    background: "rgba(15, 23, 42, 0.62)",
    border: "1px solid rgba(148,163,184,0.14)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },

  guideIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #facc15, #b8860b)",
    color: "#111827",
    fontWeight: "900",
    boxShadow: "0 0 16px rgba(250,204,21,0.22)",
  },

  guideFooter: {
    position: "relative",
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "18px",
  },

  guidePrimary: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(34,197,94,0.40)",
    background: "linear-gradient(180deg, #22c55e, #15803d)",
    color: "#ffffff",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(34,197,94,0.26), inset 0 1px 0 rgba(255,255,255,0.20)",
  },

  weekCalendarButton: {
    height: "44px",
    minWidth: "86px",
    padding: "5px 12px",
    borderRadius: "14px",
    border: "1px solid rgba(248,113,113,0.45)",
    background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)",
    color: "#ffffff",
    fontWeight: "950",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  weekCalendarLabel: {fontSize: "10px", lineHeight: 1, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.8px"},

  weekCalendarNumber: {fontSize: "20px", lineHeight: 1.1},

  dateMiniBox: {
    height: "44px",
    padding: "6px 12px",
    borderRadius: "14px",
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(15,23,42,0.72)",
    color: "#e2e8f0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "900",
    whiteSpace: "nowrap",
    textTransform: "capitalize",
  },

  calendarOverlay: {position: "fixed", inset: 0, zIndex: 10030, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2, 6, 23, 0.70)", backdropFilter: "blur(10px)"},

  calendarPanel: {width: "760px", maxWidth: "94vw", padding: "22px", borderRadius: "24px", background: "linear-gradient(180deg, rgba(8,22,40,0.98), rgba(3,7,18,0.98))", border: "1px solid rgba(56,189,248,0.32)", boxShadow: "0 25px 80px rgba(0,0,0,0.65), 0 0 40px rgba(56,189,248,0.14), inset 0 1px 0 rgba(255,255,255,0.08)", color: "#f8fafc"},

  calendarHeader: {display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px"},

  calendarKicker: {color: "#67e8f9", fontSize: "12px", fontWeight: "950", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "5px"},

  calendarClose: {width: "34px", height: "34px", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.22)", background: "rgba(15,23,42,0.85)", color: "#e2e8f0", cursor: "pointer", fontSize: "22px"},

  calendarActions: {display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "14px"},

  calendarNavButton: {padding: "10px 12px", borderRadius: "12px", border: "1px solid rgba(56,189,248,0.30)", background: "linear-gradient(180deg, #0ea5e9, #075985)", color: "#fff", fontWeight: "900", cursor: "pointer"},

  calendarWeekBadge: {padding: "10px 14px", borderRadius: "14px", background: "linear-gradient(180deg, rgba(239,68,68,0.95), rgba(153,27,27,0.95))", border: "1px solid rgba(248,113,113,0.45)", color: "#fff", fontWeight: "900", boxShadow: "0 0 16px rgba(239,68,68,0.25)"},

  calendarDaysHeader: {display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "6px", color: "#93c5fd", fontWeight: "950", fontSize: "12px", textAlign: "center", textTransform: "uppercase"},

  calendarGrid: {display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px"},

  calendarDay: {height: "64px", borderRadius: "14px", border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(15,23,42,0.88), rgba(8,22,40,0.88))", color: "#f8fafc", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", fontWeight: "900", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"},

  calendarToday: {border: "1px solid rgba(250,204,21,0.78)", background: "linear-gradient(180deg, rgba(250,204,21,0.95), rgba(184,134,11,0.95))", color: "#111827", boxShadow: "0 0 20px rgba(250,204,21,0.28)"},

  calendarEmptyDay: {opacity: 0.25, cursor: "default", background: "rgba(15,23,42,0.25)"},

  calendarDayNumber: {fontSize: "18px"},

  calendarWeekSmall: {fontSize: "11px", opacity: 0.78},

  calendarFooter: {marginTop: "14px", padding: "11px", borderRadius: "14px", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.16)", color: "#cbd5e1", fontSize: "13px", fontWeight: "800", textAlign: "center"},

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(2, 6, 23, 0.72)",
    backdropFilter: "blur(10px)",
  },

  resetModal: {
    position: "relative",
    width: "460px",
    padding: "22px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, rgba(8, 22, 40, 0.98), rgba(3, 7, 18, 0.98))",
    border: "1px solid rgba(56, 189, 248, 0.30)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.65), 0 0 35px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
    color: "#f8fafc",
  },

  modalGlow: {
    position: "absolute",
    top: "-90px",
    right: "-70px",
    width: "190px",
    height: "190px",
    borderRadius: "999px",
    background: "rgba(34, 211, 238, 0.14)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },

  modalHeader: {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "14px",
  },

  modalKicker: {
    color: "#67e8f9",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginBottom: "5px",
  },

  modalTitle: {
    fontSize: "24px",
    fontWeight: "900",
    letterSpacing: "0.5px",
    textShadow: "0 2px 0 #000",
  },

  modalClose: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15, 23, 42, 0.85)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: "26px",
  },

  modalWarning: {
    position: "relative",
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(239, 68, 68, 0.10)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    color: "#fecaca",
    fontSize: "13px",
    fontWeight: "800",
    lineHeight: 1.45,
    marginBottom: "16px",
  },

  modalLabel: {
    position: "relative",
    display: "block",
    fontSize: "13px",
    fontWeight: "900",
    color: "#e2e8f0",
    marginBottom: "7px",
  },

  modalInput: {
    position: "relative",
    width: "100%",
    height: "44px",
    borderRadius: "11px",
    border: "1px solid rgba(250, 204, 21, 0.28)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(8,22,40,0.96))",
    color: "#f8fafc",
    padding: "0 12px",
    fontSize: "16px",
    fontWeight: "900",
    outline: "none",
    boxShadow: "inset 0 0 12px rgba(250,204,21,0.10)",
    marginBottom: "16px",
  },

  modalActions: {
    position: "relative",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },

  cancelResetButton: {
    padding: "10px 14px",
    borderRadius: "11px",
    border: "1px solid rgba(148,163,184,0.25)",
    background: "linear-gradient(180deg, #334155, #0f172a)",
    color: "#e2e8f0",
    fontWeight: "900",
    cursor: "pointer",
  },

  confirmResetButton: {
    padding: "10px 15px",
    borderRadius: "11px",
    border: "1px solid rgba(248,113,113,0.45)",
    background: "linear-gradient(180deg, #ef4444, #991b1b)",
    color: "#ffffff",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.16)",
  },

  tmToast: {
    position: "fixed",
    top: "18px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    background: "rgba(15, 23, 42, 0.96)",
    color: "#86efac",
    border: "1px solid rgba(34, 197, 94, 0.35)",
    borderRadius: "999px",
    padding: "9px 16px",
    fontWeight: "900",
    fontSize: "13px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    pointerEvents: "none",
  },

  leftHeaderDock: {
    display: "none",
  },

  rightHeaderDock: {
    position: "absolute",
    top: "84px",
    right: "18px",
    zIndex: 300,
  },

  timeMachineBar: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  topActionDock: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.80), rgba(15,23,42,0.58))",
    border: "1px solid rgba(56,189,248,0.22)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  },

  actionGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "0",
    borderRadius: "0",
    background: "transparent",
    border: "none",
    boxShadow: "none",
  },


  userBadge: {
    maxWidth: "190px",
    height: "34px",
    padding: "0 11px",
    display: "flex",
    alignItems: "center",
    background: "linear-gradient(180deg, rgba(2,6,23,0.88), rgba(15,23,42,0.74))",
    color: "#e2e8f0",
    border: "1px solid rgba(34,197,94,0.30)",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "11px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  saveButtonManual: {
    padding: "10px 15px",
    background: "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
    color: "white",
    border: "1px solid rgba(34, 197, 94, 0.48)",
    borderRadius: "12px",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(34,197,94,0.30), inset 0 1px 0 rgba(255,255,255,0.30)",
  },

  historyButton: {
    padding: "10px 15px",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#f0f9ff",
    border: "1px solid rgba(103, 232, 249, 0.46)",
    borderRadius: "12px",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(56,189,248,0.24), inset 0 1px 0 rgba(255,255,255,0.16)",
  },

  resetButton: {
    padding: "10px 15px",
    background: "linear-gradient(180deg, #f97316 0%, #991b1b 100%)",
    color: "#ffffff",
    border: "1px solid rgba(251, 146, 60, 0.50)",
    borderRadius: "12px",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(249,115,22,0.24), inset 0 1px 0 rgba(255,255,255,0.18)",
  },

  timeMachinePanel: {
    position: "absolute",
    top: "50px",
    right: 0,
    width: "460px",
    maxHeight: "620px",
    overflow: "auto",
    padding: "14px",
    background: "linear-gradient(180deg, rgba(8, 22, 40, 0.98), rgba(3, 7, 18, 0.98))",
    border: "1px solid rgba(56,189,248,0.30)",
    borderRadius: "18px",
    boxShadow: "0 22px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
  },

  tmHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "12px",
  },

  tmTitle: {
    color: "#67e8f9",
    fontWeight: "900",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    fontSize: "15px",
  },

  tmSubTitle: {
    color: "#94a3b8",
    fontSize: "12px",
    marginTop: "4px",
  },

  tmClose: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15, 23, 42, 0.8)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: "24px",
  },

  historyEmpty: {
    color: "#cbd5e1",
    fontSize: "13px",
    padding: "16px",
    background: "rgba(15, 23, 42, 0.55)",
    borderRadius: "12px",
    border: "1px solid rgba(148,163,184,0.14)",
  },

  tmCurrentCard: {
    padding: "14px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(250,204,21,0.12))",
    border: "1px solid rgba(56,189,248,0.22)",
    marginBottom: "14px",
  },

  tmBadge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.16)",
    color: "#86efac",
    fontWeight: "900",
    fontSize: "11px",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },

  tmDate: {
    color: "#f8fafc",
    fontSize: "20px",
    fontWeight: "900",
  },

  tmAction: {
    color: "#facc15",
    fontWeight: "900",
    marginTop: "4px",
  },

  tmCount: {
    color: "#cbd5e1",
    fontSize: "12px",
    marginTop: "4px",
  },

  tmSliderWrap: {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(15, 23, 42, 0.58)",
    border: "1px solid rgba(148,163,184,0.14)",
    marginBottom: "12px",
  },

  tmLabels: {
    display: "flex",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: "8px",
  },

  tmSlider: {
    width: "100%",
    accentColor: "#facc15",
  },

  tmDots: {
    display: "flex",
    gap: "5px",
    flexWrap: "wrap",
    marginTop: "10px",
  },

  tmDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    border: "none",
    background: "rgba(148,163,184,0.38)",
    cursor: "pointer",
    padding: 0,
  },

  tmDotActive: {
    background: "#facc15",
    boxShadow: "0 0 12px rgba(250,204,21,0.55)",
    transform: "scale(1.25)",
  },

  tmPreview: {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(2, 6, 23, 0.58)",
    border: "1px solid rgba(148,163,184,0.14)",
    marginBottom: "12px",
  },

  tmPreviewTitle: {
    color: "#67e8f9",
    fontWeight: "900",
    fontSize: "12px",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    marginBottom: "8px",
  },

  tmPreviewRow: {
    display: "grid",
    gridTemplateColumns: "130px 1fr",
    gap: "8px",
    padding: "6px 0",
    borderBottom: "1px solid rgba(148,163,184,0.10)",
    color: "#cbd5e1",
    fontSize: "12px",
  },

  tmMore: {
    color: "#facc15",
    fontWeight: "900",
    marginTop: "8px",
    fontSize: "12px",
  },

  restoreBigButton: {
    width: "100%",
    padding: "12px",
    background: "linear-gradient(180deg, #22c55e, #15803d)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(34,197,94,0.25)",
  },

  kpiContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "14px",
  },

  card: {
    background: "#0c1c3b",
    padding: "18px",
    borderRadius: "14px",
    textAlign: "center",
    boxShadow: "0 0 22px rgba(0,255,200,0.18)",
    border: "1px solid rgba(0,255,200,0.35)",
  },

  depense: {
    color: "#ff4d4d",
    fontSize: "26px",
    fontWeight: "bold",
  },

  revenu: {
    color: "#00ff9f",
    fontSize: "26px",
    fontWeight: "bold",
  },

  solde: {
    fontSize: "28px",
    fontWeight: "bold",
  },

  accountHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "8px",
  },

  accountSwitcher: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.78), rgba(15,23,42,0.54))",
    border: "1px solid rgba(56,189,248,0.20)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
  },

  accountLabel: {
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "950",
    letterSpacing: "1px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },

  accountSelect: {
    height: "34px",
    minWidth: "220px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.28)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 10px",
    fontWeight: "800",
  },

  accountInput: {
    height: "34px",
    width: "150px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(255,255,255,0.96)",
    color: "#0f172a",
    padding: "0 10px",
    fontWeight: "800",
  },

  accountRenameButton: {
    height: "34px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.38)",
    background: "linear-gradient(180deg, #0ea5e9, #075985)",
    color: "#ffffff",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 12px rgba(56,189,248,0.22), inset 0 1px 0 rgba(255,255,255,0.18)",
    whiteSpace: "nowrap",
  },

  accountAddButton: {
    height: "34px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid rgba(34,197,94,0.40)",
    background: "linear-gradient(180deg, #22c55e, #15803d)",
    color: "#ffffff",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 14px rgba(34,197,94,0.22)",
  },

  excelTabsBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: "72px",
    zIndex: 1000,
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 10px 0 10px",
    background: "linear-gradient(180deg, rgba(226,238,248,0.96) 0%, rgba(190,207,220,0.98) 100%)",
    borderTop: "1px solid rgba(15,23,42,0.25)",
    boxShadow: "0 -14px 24px rgba(2,6,23,0.35)",
  },

  excelTab: {
    padding: "8px 16px",
    borderRadius: "12px 12px 0 0",
    border: "1px solid rgba(15,23,42,0.16)",
    background: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
    color: "#0f172a",
    fontWeight: "950",
    cursor: "grab",
    whiteSpace: "nowrap",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.70)",
  },

  excelTabActive: {
    background: "linear-gradient(180deg, #ffffff, #dbeafe)",
    color: "#047857",
    borderBottom: "3px solid #22c55e",
    boxShadow: "0 -3px 14px rgba(34,197,94,0.20)",
    transform: "translateY(-2px)",
  },

  accountDeleteButton: {
    height: "34px",
    width: "38px",
    borderRadius: "10px",
    border: "1px solid rgba(239,68,68,0.50)",
    background: "linear-gradient(180deg, #ef4444, #7f1d1d)",
    color: "#ffffff",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 12px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.18)",
  },

  excelTabRenameInput: {
    width: "160px",
    height: "24px",
    borderRadius: "7px",
    border: "1px solid rgba(56,189,248,0.35)",
    padding: "0 7px",
    fontWeight: "900",
    color: "#0f172a",
    outline: "none",
  },

  pageSwitchAnimation: {
    animation: "pageFadeSlide 0.28s ease both",
  },

  accountHeaderClean: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "10px",
    paddingRight: "0",
  },

  panelSubtitle: {
    marginTop: "4px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "800",
  },

  commandCenter: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 0.9fr) minmax(520px, 1.4fr) minmax(520px, 1.3fr)",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.88), rgba(15,23,42,0.66))",
    border: "1px solid rgba(56,189,248,0.22)",
    backdropFilter: "blur(12px)",
  },

  commandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    padding: "8px",
    borderRadius: "16px",
    background: "rgba(2,6,23,0.36)",
    border: "1px solid rgba(148,163,184,0.10)",
  },

  commandLabel: {
    color: "#67e8f9",
    fontSize: "10px",
    fontWeight: "950",
    letterSpacing: "1px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },

  cleanButton: {
    height: "34px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.34)",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#f0f9ff",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 0 10px rgba(56,189,248,0.16), inset 0 1px 0 rgba(255,255,255,0.14)",
    whiteSpace: "nowrap",
  },

  cleanWarningButton: {
    height: "34px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid rgba(251,146,60,0.34)",
    background: "linear-gradient(180deg, #f97316 0%, #9a3412 100%)",
    color: "#fff7ed",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  cleanLogoutButton: {
    height: "34px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid rgba(248,113,113,0.34)",
    background: "linear-gradient(180deg, #991b1b 0%, #450a0a 100%)",
    color: "#fee2e2",
    fontWeight: "900",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  cleanDangerIconButton: {
    height: "34px",
    width: "36px",
    borderRadius: "10px",
    border: "1px solid rgba(248,113,113,0.34)",
    background: "linear-gradient(180deg, #ef4444 0%, #7f1d1d 100%)",
    color: "#ffffff",
    fontWeight: "900",
    cursor: "pointer",
  },

  accountSelectClean: {
    height: "34px",
    minWidth: "190px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.22)",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 9px",
    fontWeight: "850",
    fontSize: "12px",
  },

  accountInputClean: {
    height: "34px",
    width: "140px",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(255,255,255,0.96)",
    color: "#0f172a",
    padding: "0 9px",
    fontWeight: "800",
    fontSize: "12px",
  },

  weekCalendarButtonClean: {
    height: "34px",
    padding: "0 11px",
    minWidth: "52px",
    borderRadius: "10px",
    border: "1px solid rgba(248,113,113,0.38)",
    background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)",
    color: "#ffffff",
    fontWeight: "950",
    fontSize: "12px",
    cursor: "pointer",
  },

  dateMiniBoxClean: {
    height: "34px",
    padding: "0 11px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.16)",
    background: "rgba(15,23,42,0.72)",
    color: "#cbd5e1",
    display: "flex",
    alignItems: "center",
    fontSize: "12px",
    fontWeight: "900",
    whiteSpace: "nowrap",
    textTransform: "capitalize",
  },

  headerToolsDock: {
    display: "none",
  },

  headerToolsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "7px",
    flexWrap: "wrap",
  },

  commandCenterSimple: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "12px",
    padding: "12px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.78), rgba(15,23,42,0.50))",
    border: "1px solid rgba(56,189,248,0.18)",
    maxWidth: "620px",
  },

  commandGroupSimple: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  panel: {
    padding: "13px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.82), rgba(15,23,42,0.58))",
    border: "1px solid rgba(56,189,248,0.20)",
    boxShadow: "0 14px 38px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)",
    overflow: "visible",
    height: "100%",
  },

  panelTitle: {
    fontWeight: "bold",
    color: "#c7d2fe",
    marginBottom: "8px",
  },

  activeBloc: {
    color: "#00ff9f",
  },

  blocForm: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    marginBottom: "8px",
  },

  blocTabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  blocTabWrap: {
    display: "flex",
    alignItems: "center",
  },

  blocTab: {
    background: "#10264a",
    color: "#fff",
    border: "1px solid #2f80c0",
    padding: "8px 10px",
    borderRadius: "8px 0 0 8px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  blocTabActive: {
    background: "#00bcd4",
    color: "#00111d",
  },

  countBadge: {
    marginLeft: "8px",
    background: "#000",
    color: "#fff",
    borderRadius: "10px",
    padding: "2px 6px",
    fontSize: "11px",
  },

  deleteBlocButton: {
    background: "#ff4d4d",
    color: "#fff",
    border: "none",
    padding: "8px 10px",
    borderRadius: "0 8px 8px 0",
    cursor: "pointer",
    fontWeight: "bold",
  },

  noBloc: {
    color: "#ffd43b",
  },

  form: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.2fr 1.2fr 1.2fr 1.2fr auto",
    gap: "10px",
  },

  formPro: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  selectDepense: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "360px",
    minWidth: "360px",
    fontSize: "14px",
  },

  inputDescriptionAutre: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "260px",
    minWidth: "260px",
    fontSize: "14px",
  },

  inputNote: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "260px",
    minWidth: "260px",
    fontSize: "14px",
  },

  inputMontant: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "200px",
    minWidth: "200px",
    fontSize: "14px",
  },

  modeSelectTable: {
    height: "26px",
    borderRadius: "7px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#0f172a",
    fontWeight: "650",
    fontSize: "11px",
    outline: "none",
    cursor: "pointer",
  },

  inputMode: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "170px",
    minWidth: "170px",
    fontSize: "14px",
  },

  inputEcheance: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "170px",
    minWidth: "170px",
    fontSize: "14px",
  },

  assistantTeslaButton: {
    height: "38px",
    padding: "0 18px",
    borderRadius: "12px",
    border: "1px solid rgba(103, 232, 249, 0.46)",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#f0f9ff",
    fontSize: "13px",
    fontWeight: "950",
    letterSpacing: "0.2px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    boxShadow: "0 0 18px rgba(56,189,248,0.24), inset 0 1px 0 rgba(255,255,255,0.16)",
  },


  blocLeftTools: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  floatingHeaderDock: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "8px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(8,22,40,0.84), rgba(15,23,42,0.62))",
    border: "1px solid rgba(56,189,248,0.22)",
    backdropFilter: "blur(12px)",
    animation: "floatingHeaderPulse 3.2s ease-in-out infinite",
    marginLeft: "auto",
  },

  selectOnlyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    width: "100%",
  },

  blocSelect: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "420px",
    maxWidth: "420px",
    fontSize: "14px",
  },

  input: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "100%",
    minWidth: "120px",
    fontSize: "14px",
  },

  inputLarge: {
    padding: "11px",
    borderRadius: "6px",
    border: "none",
    width: "100%",
    minWidth: "260px",
    fontSize: "14px",
  },

  smartAssistantButton: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    height: "38px",
    padding: "0 18px",
    borderRadius: "999px",
    border: "1px solid rgba(56, 189, 248, 0.50)",
    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%)",
    color: "#f0f9ff",
    fontSize: "13px",
    fontWeight: "950",
    letterSpacing: "0.4px",
    cursor: "pointer",
    boxShadow: "0 0 22px rgba(56,189,248,0.36), inset 0 1px 0 rgba(255,255,255,0.30)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
    overflow: "hidden",
  },

  smartAssistantIcon: {
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: "13px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24)",
  },

  button: {
    height: "38px",
    padding: "0 18px",
    background: "linear-gradient(180deg, #facc15 0%, #ca8a04 100%)",
    color: "#111827",
    border: "1px solid rgba(250,204,21,0.52)",
    borderRadius: "12px",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 14px rgba(250,204,21,0.20), inset 0 1px 0 rgba(255,255,255,0.22)",
  },

  secondaryButton: {
    padding: "11px 18px",
    background: "linear-gradient(180deg, #facc15 0%, #b8860b 100%)",
    border: "1px solid rgba(250, 204, 21, 0.42)",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#111827",
    fontWeight: "900",
    boxShadow: "0 0 18px rgba(250,204,21,0.22), inset 0 1px 0 rgba(255,255,255,0.35)",
  },

  error: {
    color: "#ffd43b",
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: "8px",
    fontSize: "16px",
  },

  note: {
    textAlign: "center",
    color: "#c7d2fe",
    marginBottom: "8px",
  },

  tableWrapper: {
    width: "100%",
    height: "calc(100vh - 365px)",
    minHeight: "320px",
    overflow: "auto",
    background: "#ffffff",
    borderTop: "1px solid rgba(147,197,253,0.40)",
    borderBottom: "1px solid rgba(147,197,253,0.40)",
    paddingBottom: "145px",
    scrollPaddingBottom: "145px",
  },

  table: {
    borderCollapse: "separate",
    borderSpacing: 0,
    tableLayout: "fixed",
    minWidth: "3200px",
    color: "#111827",
    fontSize: "12px",
  },

  th: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "linear-gradient(180deg, #1d4ed8 0%, #2563eb 100%)",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "12px",
    padding: "6px",
    borderRight: "1px solid rgba(15,23,42,0.22)",
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  thSmall: {
    background: "#ffffff",
    color: "#000",
    borderRight: "1px solid #000",
    borderBottom: "1px solid #000",
    height: "22px",
    zIndex: 19,
  },

  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 90,
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    boxShadow: "2px 0 0 rgba(15,23,42,0.30)",
  },

  stickySubHeader: {
    position: "sticky",
    top: 29,
    zIndex: 58,
    background: "#ffffff",
    boxShadow: "2px 0 0 #000",
  },

  stickyCell: {
    position: "sticky",
    background: "#ffffff",
    color: "#111827",
    zIndex: 70,
    boxShadow: "2px 0 0 rgba(15,23,42,0.20)",
  },

  calendarTitle: {fontSize: "28px", fontWeight: "950", textTransform: "capitalize", textShadow: "0 2px 0 #000"},

  weekHeader: {
    position: "sticky",
    top: 29,
    background: "#ffffff",
    borderRight: "1px solid #000",
    borderBottom: "1px solid #000",
    width: "30px",
    minWidth: "30px",
    height: "22px",
    fontSize: "10px",
    textAlign: "center",
    zIndex: 18,
  },

  blocRow: {
    background: "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
    color: "#0f172a",
    fontWeight: "800",
    fontSize: "13px",
    textAlign: "center",
    letterSpacing: "0.2px",
    borderTop: "1px solid #93c5fd",
    borderBottom: "1px solid #93c5fd",
  },

  td: {
    borderRight: "1px solid rgba(15, 23, 42, 0.16)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.16)",
    padding: "4px 6px",
    height: "28px",
    textAlign: "center",
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: "550",
    background: "#ffffff",
  },

  tdLeft: {
    textAlign: "left",
    color: "#0f172a",
    fontWeight: "650",
    background: "#ffffff",
  },

  yellowCell: {
    background: "#ffe699",
  },

  yellowInputCell: {
    background: "#ffffff",
    border: "1px solid rgba(147,197,253,0.80)",
    color: "#0f172a",
    fontWeight: "650",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  accumuleCell: {
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: "650",
    borderLeft: "1px solid rgba(148,163,184,0.55)",
  },

  redText: {
    color: "#0f172a",
    fontWeight: "650",
  },

  greenText: {
    color: "#0f172a",
    fontWeight: "650",
  },

  blueText: {
    color: "#0f172a",
    fontWeight: "650",
  },

  weekTopCell: {
    borderRight: "1px solid rgba(15, 23, 42, 0.20)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.20)",
    width: "30px",
    minWidth: "30px",
    height: "20px",
    lineHeight: "20px",
    textAlign: "center",
    fontSize: "10px",
    fontWeight: "900",
    padding: 0,
    userSelect: "none",
    background: "#ffffff",
    color: "#111827",
  },

  weekCell: {
    borderRight: "1px solid rgba(15, 23, 42, 0.20)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.20)",
    width: "30px",
    minWidth: "30px",
    height: "24px",
    lineHeight: "24px",
    textAlign: "center",
    fontSize: "11px",
    fontWeight: "900",
    padding: 0,
    cursor: "pointer",
    userSelect: "none",
    background: "#ffffff",
    color: "#111827",
  },

  deleteButton: {
    background: "linear-gradient(180deg, #ff3b3b 0%, #b91c1c 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: "10px",
    width: "34px",
    height: "28px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "900",
    lineHeight: "24px",
    boxShadow: "0 0 18px rgba(239,68,68,0.42), inset 0 1px 0 rgba(255,255,255,0.32)",
    opacity: 0,
    transform: "scale(0.92)",
    transition: "opacity 0.18s ease, transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease",
  },

  totalLeft: {
    background: "#020617",
    color: "#ffffff",
    fontWeight: "800",
    textAlign: "left",
  },

  totalCell: {
    background: "#020617",
    color: "#ffffff",
    fontWeight: "800",
    textAlign: "center",
  },

  totalCalendar: {
    background: "#000",
    borderBottom: "1px solid #000",
    height: "24px",
  },

  empty: {
    padding: "34px",
    textAlign: "center",
    color: "#dbeafe",
    background: "linear-gradient(135deg, #0f172a, #111827)",
    borderTop: "1px solid rgba(148,163,184,0.18)",
    fontWeight: "bold",
    letterSpacing: "0.2px",
  },

  ultraNav: {
    position: "relative",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px",
    marginTop: "10px",
    marginBottom: "6px",
    background: "linear-gradient(180deg, rgba(8, 22, 40, 0.96), rgba(3, 7, 18, 0.98))",
    border: "1px solid rgba(56,189,248,0.24)",
    borderRadius: "14px",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)",
  },

  navButton: {
    padding: "9px 12px",
    minWidth: "88px",
    borderRadius: "10px",
    border: "1px solid rgba(56,189,248,0.32)",
    background: "linear-gradient(180deg, #172554, #0f172a)",
    color: "#e0f2fe",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 14px rgba(56,189,248,0.12)",
  },

  navCenter: {
    flex: 1,
    minWidth: "260px",
  },

  navInfo: {
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.7px",
    textTransform: "uppercase",
    marginBottom: "5px",
    textAlign: "center",
  },

  bottomScroll: {
    overflowX: "auto",
    overflowY: "hidden",
    height: "16px",
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: "999px",
  },



  emptyLine: {
    background: "#ffffff",
    borderBottom: "1px solid #000",
  },

  passwordChangeButton: {
    height: "28px",
    padding: "0 10px",
    borderRadius: "12px",
    border: "1px solid rgba(56,189,248,0.34)",
    background: "linear-gradient(180deg, rgba(14,165,233,0.35), rgba(2,6,23,0.58))",
    color: "#e0f2fe",
    fontSize: "11px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 0 14px rgba(14,165,233,0.16), inset 0 1px 0 rgba(255,255,255,0.12)",
    whiteSpace: "nowrap",
  },

  passwordModalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(2,6,23,0.72)",
    backdropFilter: "blur(10px)",
  },

  passwordModalCard: {
    width: "420px",
    maxWidth: "92vw",
    padding: "26px",
    borderRadius: "22px",
    background: "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(7,19,38,0.98))",
    border: "1px solid rgba(56,189,248,0.35)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.55), 0 0 35px rgba(14,165,233,0.22)",
    color: "#ffffff",
  },

  passwordModalTitle: {
    fontSize: "24px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    marginBottom: "6px",
    color: "#ffffff",
    textShadow: "0 2px 0 rgba(0,0,0,0.55)",
  },

  passwordModalSubtitle: {
    fontSize: "12px",
    color: "#93c5fd",
    marginBottom: "18px",
    wordBreak: "break-word",
  },

  passwordModalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "16px",
  },

  passwordSuccess: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.35)",
    color: "#86efac",
    fontWeight: "800",
    fontSize: "13px",
  },

  incomeButton: {
    height: "42px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(34,197,94,0.48)",
    background: "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
    color: "#ffffff",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(34,197,94,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
    whiteSpace: "nowrap",
  },

  revenuModalCard: {
    width: "460px",
    maxWidth: "92vw",
    padding: "26px",
    borderRadius: "22px",
    background: "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(6,36,24,0.98))",
    border: "1px solid rgba(34,197,94,0.38)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.55), 0 0 38px rgba(34,197,94,0.22)",
    color: "#ffffff",
  },

  incomeSubmitButton: {
    minWidth: "150px",
    height: "42px",
    padding: "0 16px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(34,197,94,0.30), inset 0 1px 0 rgba(255,255,255,0.25)",
  },

  incomePageShell: {
    width: "min(1280px, calc(100vw - 70px))",
    margin: "10px auto 0",
    background: "#ffffff",
    color: "#000000",
    border: "2px solid #000000",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
  },

  incomePageTitle: {
    textAlign: "center",
    fontSize: "34px",
    fontWeight: "950",
    letterSpacing: "0.6px",
    padding: "8px 0 12px",
    borderBottom: "2px solid #000000",
    background: "#ffffff",
  },

  incomeSectionTitle: {
    textAlign: "center",
    fontSize: "29px",
    fontWeight: "950",
    letterSpacing: "0.5px",
    padding: "6px 0",
    background: "#c6e0b4",
    borderBottom: "2px solid #000000",
  },

  incomeToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "10px 12px",
    background: "#f8fafc",
    borderBottom: "2px solid #000000",
  },

  incomeTableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  incomeTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "Arial, sans-serif",
    tableLayout: "fixed",
  },

  incomeTh: {
    background: "#000000",
    color: "#ffffff",
    border: "1px solid #000000",
    fontSize: "24px",
    fontWeight: "950",
    padding: "6px",
    textAlign: "center",
  },

  incomeThDescription: {
    width: "48%",
    textAlign: "left",
  },

  incomeTdDescription: {
    border: "1px solid #000000",
    padding: "7px",
    fontSize: "22px",
    fontWeight: "650",
    textAlign: "left",
    background: "#ffffff",
  },

  incomeTdMoney: {
    border: "1px solid #000000",
    padding: "7px",
    fontSize: "22px",
    fontWeight: "750",
    textAlign: "right",
    background: "#ffffff",
    whiteSpace: "nowrap",
  },

  incomeTd: {
    border: "1px solid #000000",
    padding: "7px",
    fontSize: "18px",
    textAlign: "center",
    background: "#ffffff",
  },

  incomeTdAction: {
    border: "1px solid #000000",
    padding: "5px",
    textAlign: "center",
    background: "#ffffff",
  },

  incomeTotalLabel: {
    border: "1px solid #000000",
    padding: "7px",
    fontSize: "22px",
    fontWeight: "950",
    color: "#ffffff",
    background: "#548235",
    textAlign: "left",
  },

  incomeTotalMoney: {
    border: "1px solid #000000",
    padding: "7px",
    fontSize: "22px",
    fontWeight: "950",
    color: "#ffffff",
    background: "#548235",
    textAlign: "right",
    whiteSpace: "nowrap",
  },

  incomeEmpty: {
    border: "1px solid #000000",
    padding: "24px",
    fontSize: "18px",
    textAlign: "center",
    background: "#ffffff",
  },

  incomeBankShell: {
    width: "calc(100vw - 20px)",
    margin: "0 auto",
    color: "#ffffff",
  },

  incomeBankTitle: {
    margin: "8px auto 10px",
    width: "fit-content",
    padding: "10px 32px",
    borderRadius: "22px",
    background: "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(8,47,73,0.72))",
    border: "1px solid rgba(125,211,252,0.38)",
    color: "#ffffff",
    fontSize: "30px",
    fontWeight: "950",
    letterSpacing: "2px",
    textTransform: "uppercase",
    boxShadow: "0 0 30px rgba(14,165,233,0.18)",
    textShadow: "0 2px 0 rgba(0,0,0,0.65)",
  },

  incomeBankToolbar: {
    minHeight: "54px",
    margin: "0 24px 8px",
    padding: "8px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96))",
    border: "1px solid rgba(56,189,248,0.35)",
    boxShadow: "0 0 22px rgba(14,165,233,0.16), inset 0 1px 0 rgba(255,255,255,0.08)",
    overflowX: "auto",
  },

  stepPill: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #38bdf8, #0369a1)",
    color: "#ffffff",
    fontWeight: "950",
    boxShadow: "0 0 16px rgba(56,189,248,0.45)",
    flex: "0 0 auto",
  },

  toolbarLabel: {
    fontSize: "12px",
    fontWeight: "950",
    textTransform: "uppercase",
    color: "#67e8f9",
    letterSpacing: "1px",
    flex: "0 0 auto",
  },

  incomeSelect: {
    height: "36px",
    minWidth: "330px",
    borderRadius: "12px",
    border: "1px solid rgba(147,197,253,0.55)",
    background: "#ffffff",
    color: "#020617",
    fontWeight: "850",
    padding: "0 12px",
    outline: "none",
  },

  incomeTextInput: {
    height: "36px",
    minWidth: "210px",
    borderRadius: "12px",
    border: "1px solid rgba(147,197,253,0.45)",
    background: "#ffffff",
    color: "#020617",
    fontWeight: "800",
    padding: "0 12px",
    outline: "none",
  },

  incomeAmountInput: {
    height: "36px",
    width: "130px",
    borderRadius: "12px",
    border: "1px solid rgba(147,197,253,0.45)",
    background: "#ffffff",
    color: "#020617",
    fontWeight: "850",
    padding: "0 12px",
    outline: "none",
  },

  incomeModeSelect: {
    height: "36px",
    width: "135px",
    borderRadius: "12px",
    border: "1px solid rgba(147,197,253,0.45)",
    background: "#ffffff",
    color: "#020617",
    fontWeight: "850",
    padding: "0 12px",
    outline: "none",
  },

  incomeDateInput: {
    height: "36px",
    width: "150px",
    borderRadius: "12px",
    border: "1px solid rgba(147,197,253,0.45)",
    background: "#ffffff",
    color: "#020617",
    fontWeight: "850",
    padding: "0 12px",
    outline: "none",
  },

  incomeAddButtonBank: {
    height: "38px",
    minWidth: "120px",
    padding: "0 16px",
    borderRadius: "13px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "linear-gradient(180deg, #facc15 0%, #ca8a04 100%)",
    color: "#020617",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(250,204,21,0.34), inset 0 1px 0 rgba(255,255,255,0.4)",
    flex: "0 0 auto",
  },

};
