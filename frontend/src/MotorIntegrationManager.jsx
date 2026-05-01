import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { integrationRequest, getIntegrationApiBase, setIntegrationApiBase } from "./integrationApi";

function MotorIntegrationManager({ user, canEditEverything }) {
  const [apiBase, setApiBase] = useState(getIntegrationApiBase());
  const [settings, setSettings] = useState({
    enabled: false,
    apiBaseUrl: "",
    accountId: "",
    environment: "sandbox",
    defaultLaborGuide: "MOTOR",
    notes: ""
  });
  const [message, setMessage] = useState("");
  const [lookup, setLookup] = useState({
    vin: "",
    year: "",
    make: "",
    model: "",
    engine: "",
    searchText: ""
  });
  const [lookupResult, setLookupResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "motor_integration_settings_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "{}");
      setSettings((prev) => ({ ...prev, ...parsed }));
    } catch {
      setSettings((prev) => ({ ...prev }));
    }
  };

  const saveSettings = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save MOTOR integration settings.");
      return;
    }

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "motor_integration_settings_json",
        setting_value: JSON.stringify(settings, null, 2),
        description: "Future MOTOR repair information integration settings",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "MOTOR Integration Settings Saved",
      table_name: "app_settings",
      record_id: "motor_integration_settings_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${settings.environment} ${settings.apiBaseUrl || "no base url"}`
    });

    setMessage("MOTOR integration settings saved.");
  };

  const saveApiBase = () => {
    setIntegrationApiBase(apiBase);
    setMessage("Integration API base saved.");
  };

  const runMockLookup = async () => {
    setMessage("");

    try {
      const payload = await integrationRequest("/api/motor/repair-info/search", {
        method: "POST",
        body: lookup
      });

      setLookupResult(payload);
      setMessage(payload.mock ? "MOTOR placeholder returned mock repair information." : "MOTOR lookup completed.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div>
      <h2>MOTOR Repair Information Integration</h2>

      <p>
        This is a safe future-integration layer. It stores MOTOR settings now and gives your app
        a consistent backend endpoint to wire to a real MOTOR API/provider contract later.
      </p>

      {message && <p style={{ color: message.includes("Only") || message.includes("failed") ? "red" : "green" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Integration Backend</h3>
        <label>
          Backend URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={saveApiBase}>Save Backend URL</button>
      </div>

      <div style={panelStyle}>
        <h3>MOTOR Settings</h3>

        <div style={gridStyle}>
          <label>
            Enabled
            <select value={settings.enabled ? "true" : "false"} onChange={(e) => setSettings((p) => ({ ...p, enabled: e.target.value === "true" }))} style={inputStyle}>
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </label>

          <label>
            Environment
            <select value={settings.environment} onChange={(e) => setSettings((p) => ({ ...p, environment: e.target.value }))} style={inputStyle}>
              <option>sandbox</option>
              <option>production</option>
            </select>
          </label>

          <label>
            MOTOR API Base URL
            <input value={settings.apiBaseUrl} onChange={(e) => setSettings((p) => ({ ...p, apiBaseUrl: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Account / Customer ID
            <input value={settings.accountId} onChange={(e) => setSettings((p) => ({ ...p, accountId: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Default Labor Guide
            <input value={settings.defaultLaborGuide} onChange={(e) => setSettings((p) => ({ ...p, defaultLaborGuide: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={settings.notes} onChange={(e) => setSettings((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={saveSettings} disabled={!canEditEverything}>Save MOTOR Settings</button>
      </div>

      <div style={panelStyle}>
        <h3>Repair Info Lookup Placeholder</h3>

        <div style={gridStyle}>
          <label>
            VIN
            <input value={lookup.vin} onChange={(e) => setLookup((p) => ({ ...p, vin: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Year
            <input value={lookup.year} onChange={(e) => setLookup((p) => ({ ...p, year: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Make
            <input value={lookup.make} onChange={(e) => setLookup((p) => ({ ...p, make: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Model
            <input value={lookup.model} onChange={(e) => setLookup((p) => ({ ...p, model: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Engine
            <input value={lookup.engine} onChange={(e) => setLookup((p) => ({ ...p, engine: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Search
            <input value={lookup.searchText} onChange={(e) => setLookup((p) => ({ ...p, searchText: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <button type="button" onClick={runMockLookup}>Run Lookup</button>

        {lookupResult && (
          <pre style={preStyle}>{JSON.stringify(lookupResult, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 80 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const preStyle = { background: "#f8fafc", padding: 10, borderRadius: 8, overflow: "auto", marginTop: 12 };

export default MotorIntegrationManager;
