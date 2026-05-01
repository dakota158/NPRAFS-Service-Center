import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./futureShopLayout.css";

const DEFAULT_SETTINGS = {
  enabled: false,
  appName: "Auto Shop Command Center",
  density: "compact",
  noPageScroll: false,
  fixedHeader: true,
  fixedSidebar: false,
  groupedNavigation: true,
  roundedNavigationPanels: true,
  splitPaneDefault: true,
  stickyActionBars: true,
  glassPanels: true,
  tableStickyHeaders: true,
  accentColor: "#38bdf8",
  secondaryAccentColor: "#8b5cf6",
  defaultWorkspace: "Modern Command Center",
  reduceMotion: false,
  showKpiStrip: true,
  showCommandSearch: true,
  showFastActions: true,
  notes: ""
};

function FutureLayoutSettingsManager({ user, canEditEverything }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "future_layout_settings_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data?.setting_value || "{}") });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const saveSettings = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save future layout settings.");
      return;
    }

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "future_layout_settings_json",
        setting_value: JSON.stringify(settings, null, 2),
        description: "Future no-scroll workspace layout settings",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Future Layout Settings Saved",
      table_name: "app_settings",
      record_id: "future_layout_settings_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Future layout enabled: ${settings.enabled}`
    });

    setMessage("Future layout settings saved.");
  };

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <h2>Future Layout Settings</h2>
      <p>
        This controls the next-generation workspace. Phase 27B keeps scrolling enabled by default, while still improving the futuristic look. It is designed to make the app feel like modern shop command software:
        fixed navigation, compact panels, sticky actions, split workspaces, and dense tables.
      </p>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div className="future-kpi-grid">
        <Kpi label="Future Layout" value={settings.enabled ? "On" : "Off"} />
        <Kpi label="Density" value={settings.density} />
        <Kpi label="No Page Scroll" value={settings.noPageScroll ? "On" : "Off"} />
        <Kpi label="Split Panes" value={settings.splitPaneDefault ? "On" : "Off"} />
      </div>

      <div style={panelStyle}>
        <h3>Core Experience</h3>

        <div className="future-form-grid">
          <Checkbox label="Enable future layout" checked={settings.enabled} onChange={(value) => update("enabled", value)} />
          <Checkbox label="No page scrolling" checked={settings.noPageScroll} onChange={(value) => update("noPageScroll", value)} />
          <Checkbox label="Fixed header" checked={settings.fixedHeader} onChange={(value) => update("fixedHeader", value)} />
          <Checkbox label="Fixed sidebar" checked={settings.fixedSidebar} onChange={(value) => update("fixedSidebar", value)} />
          <Checkbox label="Split pane default" checked={settings.splitPaneDefault} onChange={(value) => update("splitPaneDefault", value)} />
          <Checkbox label="Sticky action bars" checked={settings.stickyActionBars} onChange={(value) => update("stickyActionBars", value)} />
          <Checkbox label="Glass panels" checked={settings.glassPanels} onChange={(value) => update("glassPanels", value)} />
          <Checkbox label="Sticky table headers" checked={settings.tableStickyHeaders} onChange={(value) => update("tableStickyHeaders", value)} />
          <Checkbox label="Show KPI strip" checked={settings.showKpiStrip} onChange={(value) => update("showKpiStrip", value)} />
          <Checkbox label="Show command search" checked={settings.showCommandSearch} onChange={(value) => update("showCommandSearch", value)} />
          <Checkbox label="Show fast actions" checked={settings.showFastActions} onChange={(value) => update("showFastActions", value)} />
          <Checkbox label="Reduce motion" checked={settings.reduceMotion} onChange={(value) => update("reduceMotion", value)} />
        </div>
      </div>

      <div style={panelStyle}>
        <h3>Branding + Layout</h3>

        <div className="future-form-grid">
          <label>
            App Name
            <input value={settings.appName} onChange={(event) => update("appName", event.target.value)} />
          </label>

          <label>
            Density
            <select value={settings.density} onChange={(event) => update("density", event.target.value)}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
              <option value="ultra-compact">Ultra Compact</option>
            </select>
          </label>

          <label>
            Accent Color
            <input type="color" value={settings.accentColor} onChange={(event) => update("accentColor", event.target.value)} />
          </label>

          <label>
            Secondary Accent
            <input type="color" value={settings.secondaryAccentColor} onChange={(event) => update("secondaryAccentColor", event.target.value)} />
          </label>

          <label>
            Default Workspace
            <input value={settings.defaultWorkspace} onChange={(event) => update("defaultWorkspace", event.target.value)} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={settings.notes} onChange={(event) => update("notes", event.target.value)} style={{ minHeight: 90 }} />
        </label>
      </div>

      <div style={previewStyle}>
        <h3>Future Layout Preview</h3>
        <div className="future-split" style={{ minHeight: 320 }}>
          <div className="future-pane">
            <h4>Left Context Pane</h4>
            <p>Customer, vehicle, job status, timeline, and quick actions stay visible here.</p>
            <button type="button">Quick Action</button>
          </div>
          <div className="future-pane">
            <h4>Main Work Pane</h4>
            <p>Estimate, RO, invoice, parts, payments, or reports stay inside this panel without page scrolling.</p>
            <table>
              <thead>
                <tr><th>Item</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                <tr><td>Estimate</td><td>Approved</td><td><button type="button">Open</button></td></tr>
                <tr><td>Repair Order</td><td>In Progress</td><td><button type="button">Dispatch</button></td></tr>
                <tr><td>Payment</td><td>Due</td><td><button type="button">Collect</button></td></tr>
              </tbody>
            </table>
            <div className="future-action-strip">
              <button type="button">Save</button>
              <button type="button">Print</button>
              <button type="button">Send</button>
            </div>
          </div>
        </div>
      </div>

      <div className="future-action-strip">
        <button type="button" onClick={saveSettings} disabled={!canEditEverything}>Save Future Layout Settings</button>
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

export default FutureLayoutSettingsManager;
// --- ADDED END ---
