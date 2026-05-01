import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { getIntegrationApiBase, setIntegrationApiBase, integrationRequest } from "./integrationApi";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 29B: Stripe settings page.
// Important: secret keys stay in backend .env. This page stores safe UI settings only.

const DEFAULT_SETTINGS = {
  enabled: true,
  backendUrl: "http://localhost:4000",
  mockMode: true,
  terminalLocationId: "",
  webhookConfigured: false,
  autoMarkPaidFromTerminal: true,
  allowPartialPayments: true,
  allowRefunds: true,
  requireManagerForRefunds: true,
  showPaymentWarnings: true,
  receiptFooter: "Thank you for your business.",
  notes: ""
};

function StripeSettingsManager({ user, canEditEverything }) {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, backendUrl: getIntegrationApiBase() });
  const [message, setMessage] = useState("");
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "stripe_terminal_settings_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "{}");
      setSettings({ ...DEFAULT_SETTINGS, backendUrl: getIntegrationApiBase(), ...parsed });
    } catch {
      setSettings({ ...DEFAULT_SETTINGS, backendUrl: getIntegrationApiBase() });
    }
  };

  const saveSettings = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save Stripe settings.");
      return;
    }

    setIntegrationApiBase(settings.backendUrl);

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "stripe_terminal_settings_json",
        setting_value: JSON.stringify(settings, null, 2),
        description: "Safe frontend Stripe Terminal settings. Secret keys remain in backend .env.",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Stripe Settings Saved",
      table_name: "app_settings",
      record_id: "stripe_terminal_settings_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Stripe enabled: ${settings.enabled}, mock mode: ${settings.mockMode}`
    });

    setMessage("Stripe settings saved.");
  };

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const testBackend = async () => {
    setLoading(true);
    setMessage("");

    try {
      setIntegrationApiBase(settings.backendUrl);
      const payload = await integrationRequest("/api/integrations/status");
      setBackendStatus(payload);
      setMessage("Backend connected.");
    } catch (error) {
      setBackendStatus(null);
      setMessage(`Backend failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Stripe Settings</h2>

      <p>
        Configure how your frontend talks to your backend for Stripe Terminal.
        Stripe secret keys must stay in your backend <code>.env</code> file, not here.
      </p>

      {message && <p style={{ color: message.includes("saved") || message.includes("connected") ? "green" : "red" }}>{message}</p>}

      <div className="future-kpi-grid">
        <Kpi label="Stripe" value={settings.enabled ? "Enabled" : "Disabled"} />
        <Kpi label="Mode" value={settings.mockMode ? "Mock/Test" : "Live"} />
        <Kpi label="Refunds" value={settings.allowRefunds ? "Allowed" : "Off"} />
        <Kpi label="Backend" value={backendStatus?.ok ? "Connected" : "Not Tested"} />
      </div>

      <div style={panelStyle}>
        <h3>Connection</h3>

        <div className="future-form-grid">
          <Checkbox label="Enable Stripe Terminal" checked={settings.enabled} onChange={(value) => update("enabled", value)} />
          <Checkbox label="Mock/Test Mode" checked={settings.mockMode} onChange={(value) => update("mockMode", value)} />
          <Checkbox label="Webhook Configured" checked={settings.webhookConfigured} onChange={(value) => update("webhookConfigured", value)} />

          <label>
            Backend URL
            <input value={settings.backendUrl} onChange={(event) => update("backendUrl", event.target.value)} />
          </label>

          <label>
            Terminal Location ID
            <input
              value={settings.terminalLocationId}
              onChange={(event) => update("terminalLocationId", event.target.value)}
              placeholder="tml_..."
            />
          </label>
        </div>

        <button type="button" onClick={testBackend} disabled={loading}>Test Backend</button>

        {backendStatus && (
          <pre style={preStyle}>{JSON.stringify(backendStatus, null, 2)}</pre>
        )}
      </div>

      <div style={panelStyle}>
        <h3>Payment Behavior</h3>

        <div className="future-form-grid">
          <Checkbox label="Auto-mark paid from Terminal screen" checked={settings.autoMarkPaidFromTerminal} onChange={(value) => update("autoMarkPaidFromTerminal", value)} />
          <Checkbox label="Allow partial payments" checked={settings.allowPartialPayments} onChange={(value) => update("allowPartialPayments", value)} />
          <Checkbox label="Allow refunds" checked={settings.allowRefunds} onChange={(value) => update("allowRefunds", value)} />
          <Checkbox label="Require manager for refunds" checked={settings.requireManagerForRefunds} onChange={(value) => update("requireManagerForRefunds", value)} />
          <Checkbox label="Show payment warnings" checked={settings.showPaymentWarnings} onChange={(value) => update("showPaymentWarnings", value)} />
        </div>

        <label>
          Receipt Footer
          <textarea value={settings.receiptFooter} onChange={(event) => update("receiptFooter", event.target.value)} style={{ minHeight: 70 }} />
        </label>

        <label>
          Notes
          <textarea value={settings.notes} onChange={(event) => update("notes", event.target.value)} style={{ minHeight: 70 }} />
        </label>
      </div>

      <div style={panelStyle}>
        <h3>Backend .env Checklist</h3>
        <p>These values must be in <strong>backend/.env</strong>:</p>

        <pre style={preStyle}>{`STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_TERMINAL_LOCATION_ID=tml_location_id
STRIPE_TERMINAL_MOCK=${settings.mockMode ? "true" : "false"}
STRIPE_WEBHOOK_SECRET=whsec_optional_webhook_secret`}</pre>
      </div>

      <div className="future-action-strip">
        <button type="button" onClick={saveSettings} disabled={!canEditEverything}>Save Stripe Settings</button>
        <button type="button" onClick={loadSettings}>Reload</button>
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
      <div className="future-kpi-value" style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}

const panelStyle = { border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, marginTop: 16, background: "white" };
const checkboxStyle = { display: "flex", gap: 8, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" };
const preStyle = { background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 12, overflow: "auto", marginTop: 12 };

export default StripeSettingsManager;
// --- ADDED END ---
