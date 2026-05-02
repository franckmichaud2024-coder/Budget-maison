import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 🔒 Sécurité : logout seulement au premier chargement
  useEffect(() => {
    const clearSessionOnLoad = async () => {
      const hasVisited = sessionStorage.getItem("visited");

      if (!hasVisited) {
        await supabase.auth.signOut();
        sessionStorage.setItem("visited", "true");
      }
    };

    clearSessionOnLoad();
  }, []);

  // 🔄 Gestion session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    sessionStorage.removeItem("visited"); // reset sécurité
  };

  // 🔴 Déconnexion à la fermeture de page (ultra sécurité)
  useEffect(() => {
    const handleClose = () => {
      supabase.auth.signOut();
    };

    window.addEventListener("beforeunload", handleClose);

    return () => {
      window.removeEventListener("beforeunload", handleClose);
    };
  }, []);

  if (!session) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#020b1a",
        color: "white"
      }}>
        <div style={{
          background: "#0b1e3a",
          padding: 30,
          borderRadius: 12,
          width: 320
        }}>
          <h2>Connexion sécurisée</h2>

          <input
            placeholder="Courriel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <button onClick={login} style={{ width: "100%" }}>
            Se connecter
          </button>

          {error && (
            <p style={{ color: "red", marginTop: 10 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, color: "white", background: "#020b1a", minHeight: "100vh" }}>
      <h1>🔥 Dashboard Budget Maison</h1>
      <p>Connecté : {session.user.email}</p>

      <button onClick={logout} style={{ marginTop: 20 }}>
        Se déconnecter
      </button>

      <div style={{ marginTop: 40 }}>
        <h2>📊 Dashboard actif</h2>
        <p>Ton système est maintenant sécurisé et fonctionnel.</p>
      </div>
    </div>
  );
}
