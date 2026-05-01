import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 🔴 Force logout on every reload
  useEffect(() => {
    supabase.auth.signOut();
    setSession(null);
  }, []);

  // Listen to auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) setError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (!session) {
    return (
      <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",background:"#020b1a",color:"white"}}>
        <div style={{padding:30,borderRadius:15,background:"#0b1e3a"}}>
          <h2>Connexion sécurisée</h2>

          <input
            placeholder="Courriel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{display:"block",marginBottom:10,width:"100%"}}
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{display:"block",marginBottom:10,width:"100%"}}
          />

          <button onClick={handleLogin} style={{width:"100%"}}>
            Se connecter
          </button>

          {error && <p style={{color:"red"}}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:20}}>
      <h1>Dashboard Budget Maison</h1>
      <button onClick={handleLogout}>Se déconnecter</button>
    </div>
  );
}
