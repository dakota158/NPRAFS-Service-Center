import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TRAINING_STATUSES = ["Assigned", "In Progress", "Completed", "Expired"];

function TrainingRecordsManager({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    employee_name: "",
    training_name: "",
    category: "Safety",
    assigned_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    completed_date: "",
    status: "Assigned",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [profilesResult, settingsResult] = await Promise.all([
      supabase.from("profiles").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "training_records_json").maybeSingle()
    ]);

    if (profilesResult.error) {
      setMessage(profilesResult.error.message);
      return;
    }

    setProfiles(profilesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecords([]);
    }
  };

  const saveRecords = async (nextRecords) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "training_records_json",
        setting_value: JSON.stringify(nextRecords, null, 2),
        description: "Employee training records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setRecords(nextRecords);
    return true;
  };

  const addRecord = async () => {
    setMessage("");

    if (!form.employee_name || !form.training_name) {
      setMessage("Employee and training name are required.");
      return;
    }

    const record = {
      id: `training_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveRecords([record, ...records]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Training Record Created",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${record.employee_name}: ${record.training_name}`
    });

    setMessage("Training record saved.");
    setForm({
      employee_name: "",
      training_name: "",
      category: "Safety",
      assigned_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      completed_date: "",
      status: "Assigned",
      notes: ""
    });
  };

  const updateRecord = async (id, updates) => {
    const next = records.map((record) =>
      record.id === id ? { ...record, ...updates, updated_at: new Date().toISOString() } : record
    );

    const saved = await saveRecords(next);
    if (saved) setMessage("Training record updated.");
  };

  const overdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return records.filter((record) => record.status !== "Completed" && record.due_date && record.due_date < today);
  }, [records]);

  return (
    <div>
      <h2>Training Records</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Records" value={records.length} />
        <StatCard title="Completed" value={records.filter((record) => record.status === "Completed").length} />
        <StatCard title="Overdue" value={overdue.length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Training Record</h3>

        <div style={gridStyle}>
          <label>
            Employee
            <select value={form.employee_name} onChange={(e) => setForm((p) => ({ ...p, employee_name: e.target.value }))} style={inputStyle}>
              <option value="">Select employee</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.name || profile.email}>
                  {profile.name || profile.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            Training Name
            <input value={form.training_name} onChange={(e) => setForm((p) => ({ ...p, training_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle}>
              <option>Safety</option>
              <option>Technical</option>
              <option>Compliance</option>
              <option>Software</option>
              <option>Customer Service</option>
            </select>
          </label>

          <label>
            Assigned Date
            <input type="date" value={form.assigned_date} onChange={(e) => setForm((p) => ({ ...p, assigned_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Due Date
            <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Completed Date
            <input type="date" value={form.completed_date} onChange={(e) => setForm((p) => ({ ...p, completed_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {TRAINING_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addRecord}>Save Training Record</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Employee</th>
            <th>Training</th>
            <th>Category</th>
            <th>Due</th>
            <th>Completed</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <select value={record.status} onChange={(e) => updateRecord(record.id, { status: e.target.value })} style={inputStyle}>
                  {TRAINING_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{record.employee_name}</td>
              <td>{record.training_name}</td>
              <td>{record.category}</td>
              <td>{record.due_date || "-"}</td>
              <td>{record.completed_date || "-"}</td>
              <td>{record.notes || "-"}</td>
            </tr>
          ))}

          {records.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No training records.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default TrainingRecordsManager;
