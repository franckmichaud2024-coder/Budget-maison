import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 🔴 FORCE LOGOUT À CHAQUE RELOAD
  useEffect(() => {
    supabase.auth.signOut();
  }, []);

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
  };

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
          width: 300
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
    <div style={{ padding: 20 }}>
      <h1>Dashboard Budget Maison</h1>
      <button onClick={logout}>Se déconnecter</button>
    </div>
  );
}
