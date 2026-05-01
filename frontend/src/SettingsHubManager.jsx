import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 29B: visible settings hub so new settings are easy to find.

const SETTINGS_CARDS = [
  {
    title: "Stripe Settings",
    description: "Configure backend URL, mock/live mode reminders, webhook status notes, reader location, and payment behavior.",
    tab: "Stripe Settings",
    badge: "Payments"
  },
  {
    title: "Role Permissions",
    description: "Choose what every role can view, edit, create, delete, print, export, approve, refund, and manage.",
    tab: "Role Permissions",
    badge: "Security"
  },
  {
    title: "Workflow Customization",
    description: "Control which features are visible, role menu access, custom labels, branding, and workflow rules.",
    tab: "Workflow Customization",
    badge: "Workflow"
  },
  {
    title: "Collapsible Sections",
    description: "Choose how pages collapse into sections to reduce scrolling.",
    tab: "Collapsible Sections",
    badge: "Layout"
  },
  {
    title: "Future Layout",
    description: "Control futuristic layout settings, visual density, sticky actions, rounded panels, and split-pane behavior.",
    tab: "Future Layout",
    badge: "UI"
  },
  {
    title: "MOTOR Integration",
    description: "Store future MOTOR repair information integration settings.",
    tab: "Motor Integration",
    badge: "Integration"
  }
];

function SettingsHubManager({ selectOperationsTab }) {
  const [counts, setCounts] = useState({
    appSettings: 0,
    rolePermissions: "Unknown",
    stripeMode: "Unknown"
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const { data, error } = await supabase.from("app_settings").select("*");

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = data || [];
    const roleSetting = rows.find((row) => row.setting_key === "role_permissions_json");
    const stripeSetting = rows.find((row) => row.setting_key === "stripe_terminal_settings_json");

    let roleStatus = "Not saved yet";
    let stripeMode = "Not saved yet";

    try {
      const parsed = JSON.parse(roleSetting?.setting_value || "{}");
      roleStatus = parsed.enabled ? "Enabled" : "Disabled";
    } catch {}

    try {
      const parsed = JSON.parse(stripeSetting?.setting_value || "{}");
      stripeMode = parsed.mockMode ? "Mock/Test" : "Live/Backend";
    } catch {}

    setCounts({
      appSettings: rows.length,
      rolePermissions: roleStatus,
      stripeMode
    });
  };

  const goTo = (tab) => {
    if (typeof selectOperationsTab === "function") {
      selectOperationsTab(tab);
    }
  };

  return (
    <div>
      <h2>Settings Hub</h2>
      <p>
        This is the central place for customization, permissions, payment settings, integrations, and layout controls.
      </p>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div className="future-kpi-grid">
        <Kpi label="Saved Settings" value={counts.appSettings} />
        <Kpi label="Role Permissions" value={counts.rolePermissions} />
        <Kpi label="Stripe Mode" value={counts.stripeMode} />
      </div>

      <div className="settings-hub-grid">
        {SETTINGS_CARDS.map((card) => (
          <button
            key={card.tab}
            type="button"
            className="settings-hub-card"
            onClick={() => goTo(card.tab)}
          >
            <span className="settings-hub-badge">{card.badge}</span>
            <strong>{card.title}</strong>
            <span>{card.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="future-kpi">
      <div className="future-kpi-label">{label}</div>
      <div className="future-kpi-value" style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}

export default SettingsHubManager;
// --- ADDED END ---
