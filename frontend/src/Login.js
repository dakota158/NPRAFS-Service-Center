import { useState } from "react";
import { supabase } from "./supabaseClient";
// --- ADDED START ---
import packageJson from "../package.json";
// --- ADDED END ---

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [debugMessage, setDebugMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const logoPath = `${process.env.PUBLIC_URL}/favicon.ico`;

  const testConnection = async () => {
    setDebugMessage("Testing Supabase connection...");

    try {
      const { data, error } = await supabase.from("profiles").select("*").limit(1);

      if (error) {
        setDebugMessage(`Supabase connection error: ${error.message}`);
        return;
      }

      setDebugMessage("Supabase connection works.");
      console.log("Connection test data:", data);
    } catch (err) {
      console.error(err);
      setDebugMessage(`Connection failed: ${String(err.message || err)}`);
    }
  };

  const login = async () => {
    setMessage("");
    setDebugMessage("");
    setLoading(true);

    if (!email || !password) {
      setMessage("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      console.log("Trying login with:", email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      console.log("Login response:", data, error);

      if (error) {
        setMessage(error.message || "Login failed.");
        setLoading(false);
        return;
      }

      if (!data.session) {
        setMessage("Login did not return a session.");
        setLoading(false);
        return;
      }

      setMessage("Login successful. Loading dashboard...");
      window.location.reload();
    } catch (err) {
      console.error("Login crash:", err);
      setMessage(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "#f4f6f8",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url('${logoPath}')`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "420px",
          opacity: 0.12,
          zIndex: 0
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 430,
          padding: 28,
          borderRadius: 12,
          background: "rgba(255, 255, 255, 0.92)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          border: "1px solid rgba(0,0,0,0.08)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img
            src={logoPath}
            alt="NPRAFS Logo"
            style={{
              width: 90,
              height: 90,
              objectFit: "contain",
              marginBottom: 10
            }}
          />

          <h2 style={{ margin: 0 }}>NPRAFS Service Center Login</h2>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: 10,
            display: "block",
            width: "100%",
            marginBottom: 10,
            boxSizing: "border-box"
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") login();
          }}
          style={{
            padding: 10,
            display: "block",
            width: "100%",
            marginBottom: 10,
            boxSizing: "border-box"
          }}
        />

        <button
          onClick={login}
          disabled={loading}
          style={{ padding: 10, width: "100%", marginBottom: 10 }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          onClick={testConnection}
          type="button"
          style={{ padding: 10, width: "100%" }}
        >
          Test Supabase Connection
        </button>

        {message && <p style={{ color: "red" }}>{message}</p>}

        {debugMessage && (
          <p style={{ marginTop: 12, background: "#eee", padding: 10 }}>
            {debugMessage}
          </p>
        )}
      </div>

      {/* --- ADDED START --- */}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 8,
          zIndex: 2,
          fontSize: 12,
          color: "#777",
          background: "rgba(255,255,255,0.7)",
          padding: "3px 8px",
          borderRadius: 6
        }}
      >
        v{packageJson.version}
      </div>
      {/* --- ADDED END --- */}
    </div>
  );
}

export default Login;