import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 28: settings for automatic collapsible page sections.

const DEFAULT_SETTINGS = {
  enabled: true,
  defaultCollapsed: true,
  keepFirstSectionOpen: true,
  skipTabsContaining: [
    "Invoice",
    "Inventory",
    "Parts Orders",
    "Parts Stock",
    "Parts History",
    "Inventory Orders",
    "Inventory Stock",
    "Inventory History"
  ],
  headingSelectors: "h2, h3",
  maxSections: 30
};

function CollapsibleSectionsSettingsManager({ user, canEditEverything }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "auto_collapsible_sections_settings_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "{}");
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const saveSettings = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save collapsible section settings.");
      return;
    }

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "auto_collapsible_sections_settings_json",
        setting_value: JSON.stringify(settings, null, 2),
        description: "Automatic collapsible page section settings",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Collapsible Sections Settings Saved",
      table_name: "app_settings",
      record_id: "auto_collapsible_sections_settings_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Enabled: ${settings.enabled}`
    });

    setMessage("Collapsible section settings saved. Change tabs or refresh to see updates.");
  };

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const skipText = settings.skipTabsContaining.join(", ");

  return (
    <div>
      <h2>Collapsible Page Sections</h2>
      <p>
        This reduces scrolling by turning page headings into collapsible sections.
        Inventory and Invoice pages are skipped by default because they are active workflow screens.
      </p>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div className="future-kpi-grid">
        <Kpi label="Enabled" value={settings.enabled ? "Yes" : "No"} />
        <Kpi label="Default" value={settings.defaultCollapsed ? "Collapsed" : "Open"} />
        <Kpi label="First Section" value={settings.keepFirstSectionOpen ? "Open" : "Collapsed"} />
        <Kpi label="Max Sections" value={settings.maxSections} />
      </div>

      <div style={panelStyle}>
        <h3>Behavior</h3>

        <div className="future-form-grid">
          <Checkbox label="Enable automatic collapsible sections" checked={settings.enabled} onChange={(value) => update("enabled", value)} />
          <Checkbox label="Collapse sections by default" checked={settings.defaultCollapsed} onChange={(value) => update("defaultCollapsed", value)} />
          <Checkbox label="Keep first section open" checked={settings.keepFirstSectionOpen} onChange={(value) => update("keepFirstSectionOpen", value)} />

          <label>
            Heading Selectors
            <input value={settings.headingSelectors} onChange={(event) => update("headingSelectors", event.target.value)} />
          </label>

          <label>
            Max Sections Per Page
            <input type="number" value={settings.maxSections} onChange={(event) => update("maxSections", Number(event.target.value || 30))} />
          </label>
        </div>

        <label>
          Skip tabs containing these words
          <textarea
            value={skipText}
            onChange={(event) => update("skipTabsContaining", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
            style={{ minHeight: 90 }}
          />
        </label>
      </div>

      <div style={previewStyle}>
        <h3>Preview</h3>

        <div className="auto-collapse-section" data-open="true">
          <button type="button" className="auto-collapse-header">
            <h3 className="auto-collapse-title">Customer Information</h3>
            <span className="auto-collapse-icon">−</span>
          </button>
          <div className="auto-collapse-body">
            <p>This section would contain customer fields, notes, or records.</p>
          </div>
        </div>

        <div className="auto-collapse-section" data-open="false">
          <button type="button" className="auto-collapse-header">
            <h3 className="auto-collapse-title">Advanced Options</h3>
            <span className="auto-collapse-icon">+</span>
          </button>
        </div>
      </div>

      <div className="future-action-strip">
        <button type="button" onClick={saveSettings} disabled={!canEditEverything}>Save Settings</button>
        <button type="button" onClick={loadSettings}>Reload</button>
        <button type="button" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset Defaults</button>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={checkboxStyle}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
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

const panelStyle = { border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, marginTop: 16, background: "white" };
const previewStyle = { border: "1px solid #dbeafe", borderRadius: 18, padding: 16, marginTop: 16, background: "linear-gradient(180deg, #eff6ff, #ffffff)" };
const checkboxStyle = { display: "flex", gap: 8, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" };

export default CollapsibleSectionsSettingsManager;
// --- ADDED END ---
