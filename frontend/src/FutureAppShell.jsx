import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 27: FutureAppShell
// This is a reusable no-page-scroll layout shell for later wrapping Dashboard safely.
// It does not replace existing logic by itself.

function FutureAppShell({
  user,
  activeTab,
  setActiveTab,
  selectOperationsTab,
  children,
  title = "Auto Shop Command Center"
}) {
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState({
    openJobs: 0,
    unpaid: 0,
    waitingParts: 0,
    approvals: 0
  });
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "future_layout_settings_json")
        .maybeSingle();

      setSettings(JSON.parse(data?.setting_value || "{}"));
    } catch {
      setSettings({});
    }
  };

  const loadStats = async () => {
    try {
      const [invoiceResult, approvalResult] = await Promise.all([
        supabase.from("invoices").select("*"),
        supabase.from("app_settings").select("*").eq("setting_key", "customer_approvals_json").maybeSingle()
      ]);

      const invoices = invoiceResult.data || [];
      let approvals = [];

      try {
        approvals = JSON.parse(approvalResult.data?.setting_value || "[]");
      } catch {
        approvals = [];
      }

      setStats({
        openJobs: invoices.filter((item) => !["Completed", "Delivered", "Cancelled", "Voided"].includes(item.status)).length,
        unpaid: invoices.filter((item) => Number(item.grand_total || 0) > Number(item.amount_paid || 0)).length,
        waitingParts: invoices.filter((item) => item.status === "Waiting Parts").length,
        approvals: approvals.filter((item) => item.status === "Pending").length
      });
    } catch {
      setStats({
        openJobs: 0,
        unpaid: 0,
        waitingParts: 0,
        approvals: 0
      });
    }
  };

  const commands = useMemo(() => {
    const base = [
      ["Invoice Manager", "Estimate / RO / Invoice"],
      ["Job Dispatch", "Dispatch"],
      ["Stripe Terminal", "Payments"],
      ["RO Signatures", "Signatures"],
      ["Parts Shortage Board", "Parts"],
      ["Customer Approvals", "Approvals"],
      ["KPI Snapshot", "KPI"],
      ["Workflow Customization", "Customize"]
    ];

    const term = search.trim().toLowerCase();
    return base.filter(([, label]) => !term || label.toLowerCase().includes(term));
  }, [search]);

  const goTo = (tab) => {
    if (typeof selectOperationsTab === "function") {
      selectOperationsTab(tab);
    } else if (typeof setActiveTab === "function") {
      setActiveTab(tab);
    }
  };

  return (
    <div className="future-app-shell">
      <header className="future-topbar">
        <div className="future-brand">
          <div className="future-brand-mark" />
          <div>
            <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
              Future Shop OS
            </div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{settings.appName || title}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Command search..."
            style={{
              width: 280,
              background: "rgba(255,255,255,0.08)",
              color: "white",
              borderColor: "rgba(148,163,184,0.35)"
            }}
          />
          <button type="button" onClick={loadStats}>Refresh</button>
        </div>
      </header>

      <div className="future-shell-body">
        <aside className="future-sidebar">
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", marginBottom: 10 }}>
            Fast Actions
          </div>

          {commands.map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "nav-button active" : "nav-button"}
              onClick={() => goTo(tab)}
              style={{ width: "100%", textAlign: "left" }}
            >
              {label}
            </button>
          ))}

          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", margin: "18px 0 10px" }}>
            Signed In
          </div>
          <div style={{ color: "#e2e8f0", fontSize: 13, wordBreak: "break-word" }}>
            {user?.email || "User"}
          </div>
        </aside>

        <main className="future-workspace">
          <div className="future-kpi-grid">
            <Kpi label="Open Jobs" value={stats.openJobs} />
            <Kpi label="Unpaid" value={stats.unpaid} />
            <Kpi label="Waiting Parts" value={stats.waitingParts} />
            <Kpi label="Pending Approvals" value={stats.approvals} />
          </div>

          <div className="future-content-panel">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="future-kpi">
      <div className="future-kpi-label">{label}</div>
      <div className="future-kpi-value">{value}</div>
    </div>
  );
}

export default FutureAppShell;
// --- ADDED END ---
