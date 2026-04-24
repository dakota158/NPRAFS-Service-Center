import { Component, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import Dashboard from "./Dashboard";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, info) {
    console.error("APP CRASH:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h2>App Crashed</h2>
          <p style={{ color: "red" }}>{String(this.state.error)}</p>

          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
          >
            Reset App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const clearLogin = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.error("Logout error:", err);
    }

    localStorage.clear();
    sessionStorage.clear();

    setSession(null);
    setProfile(null);
    setLoading(false);
    setErrorMessage("");

    window.location.reload();
  };

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile error:", error);
      setErrorMessage(error.message);
      return null;
    }

    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setErrorMessage(
          "Supabase did not respond. Check supabaseClient.js URL/key and internet connection."
        );
      }
    }, 5000);

    const start = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setErrorMessage(error.message);
          setSession(null);
          setProfile(null);
          return;
        }

        if (data?.session) {
          setSession(data.session);

          const userProfile = await loadProfile(data.session.user.id);
          setProfile(userProfile);
        } else {
          setSession(null);
          setProfile(null);
        }
      } catch (err) {
        console.error("Startup error:", err);
        setErrorMessage(String(err.message || err));
        setSession(null);
        setProfile(null);
      } finally {
        clearTimeout(timeout);

        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading...</h2>
        <p>Connecting to Supabase...</p>
        <button onClick={clearLogin}>Force Reset Login</button>
      </div>
    );
  }

  if (errorMessage && !session) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Supabase Connection Problem</h2>
        <p style={{ color: "red" }}>{errorMessage}</p>

        <button onClick={clearLogin}>Reset Login</button>

        <hr />

        <p>Check this file:</p>
        <pre>frontend/src/supabaseClient.js</pre>

        <p>Your URL must look like:</p>
        <pre>https://your-project-ref.supabase.co</pre>

        <p>Use the publishable/anon key, not the secret key.</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <Dashboard
      user={{
        id: session.user.id,
        email: session.user.email,
        username: profile?.name || session.user.email,
        role: profile?.role || "Tech",
        name: profile?.name || "",
        phone: profile?.phone || "",
        position: profile?.position || ""
      }}
      onLogout={clearLogin}
    />
  );
}

function SafeApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default SafeApp;