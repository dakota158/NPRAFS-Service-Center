import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_CHECKS = [
  { id: "tax", category: "Business", item: "Sales tax settings reviewed", frequency: "Monthly", status: "Open", notes: "" },
  { id: "backup", category: "Data", item: "Data backup exported", frequency: "Weekly", status: "Open", notes: "" },
  { id: "safety", category: "Safety", item: "Safety inspection completed", frequency: "Monthly", status: "Open", notes: "" },
  { id: "training", category: "Staff", item: "Required training reviewed", frequency: "Quarterly", status: "Open", notes: "" }
];

const STATUSES = ["Open", "In Progress", "Completed", "Not Applicable"];

function ComplianceChecklistManager({ user, canEditEverything }) {
  const [checks, setChecks] = useState(DEFAULT_CHECKS);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    category: "",
    item: "",
    frequency: "Monthly",
    status: "Open",
    due_date: "",
    notes: ""
  });

  useEffect(() => {
    loadChecks();
  }, []);

  const loadChecks = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "compliance_checklist_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) setChecks(parsed);
    } catch {
      setChecks(DEFAULT_CHECKS);
    }
  };

  const saveChecks = async (nextChecks) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "compliance_checklist_json",
        setting_value: JSON.stringify(nextChecks, null, 2),
        description: "Shop compliance checklist records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setChecks(nextChecks);
    return true;
  };

  const addCheck = async () => {
    setMessage("");

    if (!form.item) {
      setMessage("Checklist item is required.");
      return;
    }

    const check = {
      id: `compliance_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveChecks([check, ...checks]);

    if (!saved) return;

    setMessage("Compliance item added.");
    setForm({
      category: "",
      item: "",
      frequency: "Monthly",
      status: "Open",
      due_date: "",
      notes: ""
    });
  };

  const updateCheck = async (id, updates) => {
    const next = checks.map((check) =>
      check.id === id
        ? {
            ...check,
            ...updates,
            completed_by: updates.status === "Completed" ? user?.email || "" : check.completed_by,
            completed_at: updates.status === "Completed" ? new Date().toISOString() : check.completed_at,
            updated_at: new Date().toISOString()
          }
        : check
    );

    const saved = await saveChecks(next);

    if (saved) {
      await supabase.from("audit_logs").insert({
        action: "Compliance Checklist Updated",
        table_name: "app_settings",
        record_id: id,
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `Compliance checklist updated`
      });
      setMessage("Checklist updated.");
    }
  };

  const score = useMemo(() => {
    if (!checks.length) return 0;
    return Math.round((checks.filter((check) => check.status === "Completed" || check.status === "Not Applicable").length / checks.length) * 100);
  }, [checks]);

  return (
    <div>
      <h2>Compliance Checklist</h2>

      {message && (
        <p style={{ color: message.includes("added") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Compliance Score: {score}%</h3>
        <div style={barTrack}>
          <div style={{ ...barFill, width: `${score}%` }} />
        </div>
      </div>

      <div style={panelStyle}>
        <h3>Add Checklist Item</h3>

        <div style={gridStyle}>
          <label>
            Category
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Item
            <input value={form.item} onChange={(e) => setForm((p) => ({ ...p, item: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Frequency
            <select value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))} style={inputStyle}>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Yearly</option>
            </select>
          </label>

          <label>
            Due Date
            <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addCheck}>Add Item</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Category</th>
            <th>Item</th>
            <th>Frequency</th>
            <th>Due</th>
            <th>Completed</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>
                <select value={check.status} onChange={(e) => updateCheck(check.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{check.category || "-"}</td>
              <td>{check.item}</td>
              <td>{check.frequency || "-"}</td>
              <td>{check.due_date || "-"}</td>
              <td>{check.completed_at ? new Date(check.completed_at).toLocaleString() : "-"}</td>
              <td>{check.notes || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const barTrack = { background: "#e5e7eb", borderRadius: 10, height: 20, overflow: "hidden" };
const barFill = { background: "#2563eb", height: 20, borderRadius: 10 };

export default ComplianceChecklistManager;
