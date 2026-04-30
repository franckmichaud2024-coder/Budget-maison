import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

const semaines = Array.from({ length: 52 }, (_, i) => i + 1);

const COMPTES_BUDGET = [
  "7570 - Procédures",
  "3185 - Enveloppes",
  "3177 - Argent accumulé",
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
  { key: "action", width: 95 },
];

function leftOffset(index) {
  return colonnesFixes.slice(0, index).reduce((acc, col) => acc + col.width, 0);
}

function formatArgent(valeur) {
  return `${Number(valeur || 0).toFixed(2)} $`;
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

  const tableScrollRef = useRef(null);
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

  const [data, setData] = useState([]);
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [tmMessage, setTmMessage] = useState("");
  const [ligneEdition, setLigneEdition] = useState(null);
  const [montantEdition, setMontantEdition] = useState("");
  const [ligneEditionInfo, setLigneEditionInfo] = useState(null);
  const [descriptionEdition, setDescriptionEdition] = useState("");
  const [noteEdition, setNoteEdition] = useState("");
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [nowLive, setNowLive] = useState(new Date());


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

    const nouveauNom = window.prompt(
      "Nouveau nom du compte :",
      compteActif
    );

    if (nouveauNom === null) return;

    const nomFinal = String(nouveauNom).trim();

    if (!nomFinal) {
      setErreur("Le nom du compte ne peut pas être vide.");
      return;
    }

    if (nomFinal === compteActif) return;

    if (comptesBudget.includes(nomFinal)) {
      setErreur("Ce compte existe déjà.");
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
    setCompteEditionValeur(compte);
  }

  async function validerRenameCompte() {
    const nouveauNom = compteEditionValeur.trim();

    if (!compteEdition || !nouveauNom) {
      setCompteEdition(null);
      return;
    }

    if (nouveauNom !== compteEdition && comptesBudget.includes(nouveauNom)) {
      setErreur("Ce compte existe déjà.");
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
    const { data, error } = await supabase
      .from("budget_transactions")
      .select("*")
      .eq("compte", compteActif)
      .order("bloc", { ascending: true })
      .order("date", { ascending: false });

    if (error) {
      setErreur(error.message);
      return [];
    }

    const lignes = (data || []).map((item) => ({
      ...item,
      bloc: normaliserBloc(item.bloc || "SANS BLOC"),
      compte: item.compte || compteActif,
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
    loadBlocs();
    loadData();
    setSnapshots(lireSnapshots());
  }, [compteActif]);

  useEffect(() => {
    const timer = setInterval(() => setNowLive(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const table = tableScrollRef.current;
    const bottom = bottomScrollRef.current;

    if (!table || !bottom) return;

    let verrou = false;

    const updateInfo = () => {
      const max = Math.max(table.scrollWidth - table.clientWidth, 1);
      setScrollInfo({ left: table.scrollLeft, max });
    };

    const syncFromTable = () => {
      if (verrou) return;
      verrou = true;
      bottom.scrollLeft = table.scrollLeft;
      updateInfo();
      verrou = false;
    };

    const syncFromBottom = () => {
      if (verrou) return;
      verrou = true;
      table.scrollLeft = bottom.scrollLeft;
      updateInfo();
      verrou = false;
    };

    table.addEventListener("scroll", syncFromTable);
    bottom.addEventListener("scroll", syncFromBottom);
    window.addEventListener("resize", updateInfo);

    updateInfo();

    return () => {
      table.removeEventListener("scroll", syncFromTable);
      bottom.removeEventListener("scroll", syncFromBottom);
      window.removeEventListener("resize", updateInfo);
    };
  }, [data]);

  function obtenirScrollers() {
    return {
      table: tableScrollRef.current,
      bottom: bottomScrollRef.current,
    };
  }

  function bougerScroll(left) {
    const { table, bottom } = obtenirScrollers();
    if (!table) return;

    const max = Math.max(table.scrollWidth - table.clientWidth, 1);
    const nextLeft = Math.max(0, Math.min(left, max));

    table.scrollLeft = nextLeft;
    if (bottom) bottom.scrollLeft = nextLeft;

    setScrollInfo({ left: nextLeft, max });
  }

  function scrollTableBy(px) {
    const { table } = obtenirScrollers();
    if (!table) return;
    bougerScroll(table.scrollLeft + px);
  }

  function scrollTableTo(position) {
    const { table } = obtenirScrollers();
    if (!table) return;

    const max = Math.max(table.scrollWidth - table.clientWidth, 1);

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

  async function seConnecter(e) {
    e.preventDefault();
    setLoginError("");
    setAuthLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    setAuthLoading(false);

    if (error) {
      setLoginError("Courriel ou mot de passe incorrect.");
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
            overflow: hidden;
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
          filter: brightness(1.12);
          transform: scale(1.06) !important;
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
          <div style={styles.titleSmall}>Budget personnel</div>
          <h1 style={styles.title}>DASHBOARD BUDGET MAISON</h1>
        </div>
      </div>

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

      <div style={styles.leftHeaderDock}>
        <div style={styles.actionGroup}>
          <button
            onClick={sauvegardeManuelle}
            style={styles.saveButtonManual}
            title="Sauvegarder une version du tableau"
          >
            💾 Sauvegarder
          </button>

          <button
            onClick={reinitialiserTout}
            style={styles.resetButton}
            title="Effacer toutes les lignes avec mot de passe"
          >
            🧨 Réinitialiser
          </button>
        </div>
      </div>

      <div style={styles.rightHeaderDock}>
        <div style={styles.topActionDock}>
          <button
            onClick={() => setShowCalendarPanel(true)}
            style={styles.weekCalendarButton}
            title="Ouvrir le calendrier interactif"
            type="button"
          >
            <span style={styles.weekCalendarLabel}>Semaine</span>
            <strong style={styles.weekCalendarNumber}>{semaineActuelle}</strong>
          </button>

          <div style={styles.dateMiniBox}>
            <span>{jourActuelTexte}</span>
            <strong>{nowLive.getDate()} {moisActuelTexte}</strong>
          </div>

          <div style={styles.userBadge}>
            🟢 {session?.user?.email}
          </div>

          <div style={styles.actionGroup}>
            <button
              onClick={ouvrirTimeMachine}
              style={styles.historyButton}
              title="Ouvrir la Time Machine pour restaurer une version"
            >
              ↩️ Time Machine
            </button>

            <button
              onClick={seDeconnecter}
              style={styles.logoutButton}
              title="Se déconnecter"
            >
              Déconnexion
            </button>
          </div>
        </div>

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

        <div className="glass-glow" style={styles.panel}>
          <div style={styles.accountHeader}>
            <div style={styles.panelTitle}>1. Choisir un bloc de dépenses</div>

            <div style={styles.accountSwitcher}>
              <span style={styles.accountLabel}>Page / compte</span>
              <select
                value={compteActif}
                onChange={(e) => changerCompteActif(e.target.value)}
                style={styles.accountSelect}
                title="Changer de page comme un onglet Excel"
              >
                {comptesBudget.map((compte) => (
                  <option key={compte} value={compte}>
                    {compte}
                  </option>
                ))}
              </select>

              <button
                onClick={renommerCompteActif}
                style={styles.accountRenameButton}
                title="Renommer le compte actif"
                type="button"
              >
                ✎ Renommer
              </button>

              <input
                value={nouveauCompte}
                onChange={(e) => setNouveauCompte(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ajouterCompteBudget();
                }}
                placeholder="Nouveau compte"
                style={styles.accountInput}
                title="Écris un nouveau numéro ou nom de compte"
              />

              <button
                onClick={ajouterCompteBudget}
                style={styles.accountAddButton}
                title="Créer une nouvelle page / compte"
                type="button"
              >
                + Page
              </button>

              <button
                onClick={supprimerCompteActif}
                style={styles.accountDeleteButton}
                title="Supprimer le compte actif"
                type="button"
              >
                🗑
              </button>
            </div>
          </div>

          <div style={styles.selectOnlyRow}>
            <select
              value={blocActif}
              onChange={(e) => {
                setBlocActif(e.target.value);
                setDescription("");
                setDescriptionAutre("");
                setNoteEnfant("");
              }}
              style={styles.blocSelect}
            >
              {BLOCS_FIXES.map((bloc) => (
                <option key={bloc} value={bloc}>
                  {bloc}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowGuide(true)}
              style={styles.assistantTeslaButton}
              title="Ouvrir l’assistant intelligent"
              type="button"
            >
              <span style={styles.assistantPulseDot}>✦</span>
              Assistant
            </button>
          </div>
        </div>

        <div className="glass-glow" style={styles.panel}>
          <div style={styles.panelTitle}>
            2. Choisir une catégorie dans le bloc : <span style={styles.activeBloc}>{blocActif || "AUCUN"}</span>
          </div>

          <div style={styles.formPro}>
            <select
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.selectDepense}
            >
              <option value="">Choisir une dépense</option>
              {categoriesTriees.map((nom) => (
                <option key={nom} value={nom}>
                  {nom}
                </option>
              ))}
            </select>

            {description === "Autre" && (
              <input
                placeholder="Nom de la dépense"
                value={descriptionAutre}
                onChange={(e) => setDescriptionAutre(e.target.value)}
                style={styles.inputDescriptionAutre}
              />
            )}

            <input
              placeholder="Précision ex: nom, enfant, marque, véhicule"
              value={noteEnfant}
              onChange={(e) => setNoteEnfant(e.target.value)}
              style={styles.inputNote} title="Optionnel : ajoute une précision comme un nom, enfant, marque ou véhicule."
            />

            <input
              type="number"
              placeholder="Montant (case jaune)"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              style={styles.inputMontant} title="Montant de base. Le calcul semaine / mois / année se fait automatiquement." title="Entre le montant de base. Le calcul semaine / mois / année se fera automatiquement."
            />

            <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.inputMode} title="Choisis comment interpréter le montant : semaine, mois ou année." title="Choisis comment le montant doit être interprété : semaine, mois ou année.">
                            <option value="semaine">Semaine</option>
              <option value="mois">Mois</option>
              <option value="annee">Année</option>
            </select>

            <input
              type="number"
              placeholder="Échéance 1-52"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              style={styles.inputEcheance} title="Semaine d’échéance entre 1 et 52."
            />

            <button onClick={ajouterLigne} style={styles.button} disabled={loading}>
              {loading ? "Ajout..." : "Ajouter ligne"}
            </button>
          </div>
        </div>
        {erreur && <div style={styles.error}>Erreur : {erreur}</div>}
<div key={compteActif} style={styles.pageSwitchAnimation}>
          <div ref={tableScrollRef} className="glass-glow" style={styles.tableWrapper}>
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
              </tr>

            </thead>

            <tbody>
              {Object.keys(groupesFiltres).length === 0 ? (
                <tr>
                  <td colSpan={61} style={styles.empty}>
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
                        <td colSpan={61} style={styles.blocRow}>
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
                          <td colSpan={52} style={styles.emptyLine}></td>
                        </tr>
                      ) : (
                        lignes.map((item) => {
                          const calcul = calculerMontants(item);
                          const isDepense = item.type === "depense";
                          const nbX = semainesPayees(item).length;
                          const acc = montantAccumule(item);
                          const bal = balance(item);
                          const serieSemaines = semainesEnSerie(item.echeance);

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
                                    <button
                                      onClick={() => commencerEditionInfo(item)}
                                      style={styles.descriptionEditButton}
                                      title="Cliquer pour modifier la catégorie / note"
                                    >
                                      {item.description || "-"}
                                    </button>
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
                                        style={styles.yellowEditButton}
                                        title="Cliquer pour modifier le montant"
                                      >
                                        {formatArgent(calcul.semaine)}
                                      </button>
                                    )
                                  ) : (
                                    formatArgent(calcul.semaine)
                                  ),
                                  2,
                                  {
                                    ...(item.mode === "semaine" ? styles.yellowInputCell : styles.redText),
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
                                        style={styles.yellowEditButton}
                                        title="Cliquer pour modifier le montant"
                                      >
                                        {formatArgent(calcul.mois)}
                                      </button>
                                    )
                                  ) : (
                                    formatArgent(calcul.mois)
                                  ),
                                  3,
                                  {
                                    ...(item.mode === "mois" ? styles.yellowInputCell : {}),
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
                                        style={styles.yellowEditButton}
                                        title="Cliquer pour modifier le montant"
                                      >
                                        {formatArgent(calcul.annee)}
                                      </button>
                                    )
                                  ) : (
                                    formatArgent(calcul.annee)
                                  ),
                                  4,
                                  {
                                    ...(item.mode === "annee" ? styles.yellowInputCell : styles.redText),
                                    verticalAlign: "middle",
                                  },
                                  { rowSpan: 2 }
                                )}
                                {celluleFixe(item.echeance || "-", 5, { ...styles.blueText, verticalAlign: "middle" }, { rowSpan: 2 })}
                                {celluleFixe(nbX, 6, { verticalAlign: "middle" }, { rowSpan: 2 })}
                                {celluleFixe(formatArgent(acc), 7, { ...styles.accumuleCell, verticalAlign: "middle" }, { rowSpan: 2 })}
                                {celluleFixe(
                                  <button
                                    className="delete-row-button"
                                    onClick={() => supprimerLigne(item)}
                                    style={styles.deleteButton} title="Supprimer cette ligne"
                                   title="Supprimer la ligne">
                                    🗑️
                                  </button>,
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
                        <td colSpan={52} style={styles.totalCalendar}></td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
            </table>
          </div>
        </div>

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
                title="Clique pour ouvrir. Double-clic pour renommer. Glisse pour déplacer."
              >
                {compteEdition === compte ? (
                  <input
                    value={compteEditionValeur}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setCompteEditionValeur(e.target.value)}
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

        <div style={styles.ultraNav}>
          <button onClick={() => scrollTableTo("start")} style={styles.navButton}>
            ⏮ Début
          </button>

          <button onClick={() => scrollTableBy(-700)} style={styles.navButton}>
            ◀ Gauche
          </button>

          <div style={styles.navCenter}>
            <div style={styles.navInfo}>
              Navigation calendrier · {Math.round((scrollInfo.left / scrollInfo.max) * 100)}%
            </div>

            <div ref={bottomScrollRef} style={styles.bottomScroll}>
              <div style={{ width: "3200px", height: "1px" }} />
            </div>
          </div>

          <button onClick={() => scrollTableBy(700)} style={styles.navButton}>
            Droite ▶
          </button>

          <button onClick={() => scrollTableTo("end")} style={styles.navButton}>
            Fin ⏭
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
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
    background: "#050b18",
    color: "white",
    height: "100vh",
    width: "100vw",
    padding: "18px",
    fontFamily: "Arial, sans-serif",
    overflow: "hidden",
    paddingBottom: "8px",
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

  weekCalendarButton: {height: "44px", minWidth: "82px", padding: "5px 12px", borderRadius: "14px", border: "1px solid rgba(248,113,113,0.45)", background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)", color: "#fff", fontWeight: "950", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(239,68,68,0.28), inset 0 1px 0 rgba(255,255,255,0.18)"},

  weekCalendarLabel: {fontSize: "10px", lineHeight: 1, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.8px"},

  weekCalendarNumber: {fontSize: "20px", lineHeight: 1.1},

  dateMiniBox: {height: "44px", padding: "6px 11px", borderRadius: "14px", border: "1px solid rgba(56,189,248,0.22)", background: "rgba(15,23,42,0.70)", color: "#e2e8f0", display: "flex", flexDirection: "column", justifyContent: "center", fontSize: "11px", fontWeight: "800", whiteSpace: "nowrap", textTransform: "capitalize"},

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
    position: "absolute",
    top: "16px",
    left: "18px",
    zIndex: 210,
  },

  rightHeaderDock: {
    position: "absolute",
    top: "16px",
    right: "18px",
    zIndex: 210,
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
    gap: "8px",
    padding: "6px",
    borderRadius: "16px",
    background: "rgba(2, 6, 23, 0.46)",
    border: "1px solid rgba(148,163,184,0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },


  userBadge: {
    maxWidth: "230px",
    padding: "9px 12px",
    background: "linear-gradient(180deg, rgba(2,6,23,0.88), rgba(15,23,42,0.74))",
    color: "#e2e8f0",
    border: "1px solid rgba(34, 197, 94, 0.38)",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxShadow: "0 0 14px rgba(34,197,94,0.20)",
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
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "7px 10px",
    marginTop: "8px",
    background: "linear-gradient(180deg, rgba(226,232,240,0.92), rgba(203,213,225,0.92))",
    borderTop: "1px solid rgba(15,23,42,0.16)",
    borderBottom: "1px solid rgba(15,23,42,0.16)",
    overflowX: "auto",
  },

  excelTab: {
    padding: "8px 14px",
    borderRadius: "10px 10px 0 0",
    border: "1px solid rgba(15,23,42,0.14)",
    background: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
    color: "#0f172a",
    fontWeight: "900",
    cursor: "grab",
    whiteSpace: "nowrap",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
  },

  excelTabActive: {
    background: "linear-gradient(180deg, #ffffff, #dbeafe)",
    color: "#047857",
    borderBottom: "3px solid #22c55e",
    boxShadow: "0 -2px 12px rgba(34,197,94,0.16)",
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

  panel: {
    background: "linear-gradient(180deg, rgba(8, 22, 40, 0.88), rgba(5, 13, 26, 0.88))",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(56, 189, 248, 0.24)",
    borderRadius: "14px",
    padding: "12px",
    marginBottom: "10px",
    animation: "fadeSlideUp 0.25s ease-out",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.28), 0 0 22px rgba(56,189,248,0.06)",
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
    gap: "10px",
    alignItems: "center",
    flexWrap: "nowrap",
    width: "100%",
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
    width: "92%",
    height: "26px",
    borderRadius: "6px",
    border: "1px solid rgba(37, 99, 235, 0.25)",
    background: "linear-gradient(180deg, #ffffff, #eef6ff)",
    color: "#0f172a",
    fontWeight: "900",
    fontSize: "11px",
    textAlign: "center",
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
    borderRadius: "999px",
    border: "1px solid rgba(103, 232, 249, 0.46)",
    background: "linear-gradient(180deg, #0ea5e9 0%, #075985 100%)",
    color: "#f0f9ff",
    fontSize: "13px",
    fontWeight: "950",
    letterSpacing: "0.4px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 0 18px rgba(56,189,248,0.24), inset 0 1px 0 rgba(255,255,255,0.16)",
    animation: "teslaGlow 2.4s ease-in-out infinite",
  },

  assistantPulseDot: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.18)",
    color: "#ffffff",
    fontSize: "12px",
    animation: "teslaPulse 1.8s infinite",
  },

  selectOnlyRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
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
    padding: "11px 18px",
    background: "linear-gradient(180deg, #facc15 0%, #b8860b 100%)",
    border: "1px solid rgba(250, 204, 21, 0.42)",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#111827",
    fontWeight: "900",
    fontSize: "14px",
    boxShadow: "0 0 18px rgba(250,204,21,0.22), inset 0 1px 0 rgba(255,255,255,0.35)",
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
    height: "calc(100vh - 420px)",
    minHeight: "330px",
    overflow: "auto",
    borderRadius: "14px",
    border: "1px solid rgba(56, 189, 248, 0.26)",
    background: "#f8fafc",
    animation: "fadeSlideUp 0.30s ease-out",
    boxShadow: "0 18px 48px rgba(0,0,0,0.34), 0 0 26px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.10)",
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
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#ffffff",
    borderRight: "1px solid rgba(15, 23, 42, 0.24)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.30)",
    padding: "7px",
    height: "30px",
    textAlign: "center",
    zIndex: 20,
    fontWeight: "900",
    letterSpacing: "0.35px",
    textTransform: "uppercase",
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
    background: "linear-gradient(90deg, #e0f2fe 0%, #bfdbfe 55%, #dbeafe 100%)",
    color: "#0f172a",
    fontWeight: "900",
    fontSize: "15px",
    textAlign: "center",
    borderRight: "1px solid rgba(15, 23, 42, 0.20)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.20)",
    height: "30px",
    zIndex: 12,
    letterSpacing: "0.7px",
    textTransform: "uppercase",
  },

  td: {
    borderRight: "1px solid rgba(15, 23, 42, 0.22)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.22)",
    padding: "4px",
    height: "25px",
    textAlign: "center",
    whiteSpace: "nowrap",
    background: "#ffffff",
    color: "#111827",
  },

  tdLeft: {
    textAlign: "left",
  },

  yellowCell: {
    background: "#ffe699",
  },

  yellowInputCell: {
    background: "linear-gradient(180deg, #fff7d6 0%, #f6c94a 100%)",
    color: "#111827",
    fontWeight: "900",
    boxShadow: "inset 0 0 0 1px rgba(120, 80, 0, 0.18), 0 1px 6px rgba(246, 201, 74, 0.25)",
  },

  accumuleCell: {
    background: "linear-gradient(180deg, #ffffff 0%, #eef6ff 100%)",
    color: "#0f172a",
    fontWeight: "900",
    boxShadow: "inset 0 0 0 1px rgba(37, 99, 235, 0.10)",
  },

  redText: {
    color: "red",
    fontWeight: "bold",
  },

  greenText: {
    color: "green",
    fontWeight: "bold",
  },

  blueText: {
    color: "#0070c0",
    fontWeight: "bold",
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
    background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "9px",
    width: "34px",
    height: "28px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "900",
    lineHeight: "24px",
    boxShadow: "0 0 14px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.25)",
    opacity: 0,
    transform: "scale(0.92)",
    transition: "opacity 0.18s ease, transform 0.18s ease, filter 0.18s ease",
  },

  totalLeft: {
    background: "#000",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "14px",
    textAlign: "left",
  },

  totalCell: {
    background: "#000",
    color: "#fff",
    fontWeight: "bold",
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
};
