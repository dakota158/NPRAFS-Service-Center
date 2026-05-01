import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const INCIDENT_STATUSES = ["Open", "Investigating", "Corrective Action", "Closed"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

function SafetyIncidentManager({ user }) {
  const [incidents, setIncidents] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    incident_date: new Date().toISOString().slice(0, 10),
    severity: "Low",
    status: "Open",
    employee_involved: "",
    location: "",
    description: "",
    corrective_action: "",
    follow_up_date: "",
    notes: ""
  });

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "safety_incidents_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setIncidents(Array.isArray(parsed) ? parsed : []);
    } catch {
      setIncidents([]);
    }
  };

  const saveIncidents = async (nextIncidents) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "safety_incidents_json",
        setting_value: JSON.stringify(nextIncidents, null, 2),
        description: "Safety incident and corrective action records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setIncidents(nextIncidents);
    return true;
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const createIncident = async () => {
    setMessage("");

    if (!form.description) {
      setMessage("Description is required.");
      return;
    }

    const incident = {
      id: `incident_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveIncidents([incident, ...incidents]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Safety Incident Created",
      table_name: "app_settings",
      record_id: incident.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Safety incident ${incident.severity}: ${incident.description}`
    });

    setMessage("Safety incident saved.");
    setForm({
      incident_date: new Date().toISOString().slice(0, 10),
      severity: "Low",
      status: "Open",
      employee_involved: "",
      location: "",
      description: "",
      corrective_action: "",
      follow_up_date: "",
      notes: ""
    });
  };

  const updateIncident = async (id, updates) => {
    const next = incidents.map((incident) =>
      incident.id === id ? { ...incident, ...updates, updated_at: new Date().toISOString() } : incident
    );

    const saved = await saveIncidents(next);
    if (saved) setMessage("Incident updated.");
  };

  const openCount = useMemo(
    () => incidents.filter((incident) => incident.status !== "Closed").length,
    [incidents]
  );

  return (
    <div>
      <h2>Safety / Incident Logs</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Open" value={openCount} />
        <StatCard title="Critical" value={incidents.filter((item) => item.severity === "Critical").length} />
        <StatCard title="Total" value={incidents.length} />
      </div>

      <div style={panelStyle}>
        <h3>Record Incident</h3>

        <div style={gridStyle}>
          <label>
            Date
            <input type="date" value={form.incident_date} onChange={(e) => updateForm("incident_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Severity
            <select value={form.severity} onChange={(e) => updateForm("severity", e.target.value)} style={inputStyle}>
              {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {INCIDENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Employee / Person Involved
            <input value={form.employee_involved} onChange={(e) => updateForm("employee_involved", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Location
            <input value={form.location} onChange={(e) => updateForm("location", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Follow-Up Date
            <input type="date" value={form.follow_up_date} onChange={(e) => updateForm("follow_up_date", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Description
          <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Corrective Action
          <textarea value={form.corrective_action} onChange={(e) => updateForm("corrective_action", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={createIncident}>Save Incident</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Severity</th>
            <th>Date</th>
            <th>Location</th>
            <th>Person</th>
            <th>Description</th>
            <th>Corrective Action</th>
            <th>Follow Up</th>
          </tr>
        </thead>

        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td>
                <select value={incident.status} onChange={(e) => updateIncident(incident.id, { status: e.target.value })} style={inputStyle}>
                  {INCIDENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{incident.severity}</td>
              <td>{incident.incident_date || "-"}</td>
              <td>{incident.location || "-"}</td>
              <td>{incident.employee_involved || "-"}</td>
              <td>{incident.description}</td>
              <td>{incident.corrective_action || "-"}</td>
              <td>{incident.follow_up_date || "-"}</td>
            </tr>
          ))}

          {incidents.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No incidents recorded.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default SafetyIncidentManager;
