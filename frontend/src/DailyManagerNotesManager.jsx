import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

function DailyManagerNotesManager({ user, canEditEverything }) {
  const [notes, setNotes] = useState([]);
  const [message, setMessage] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    note_date: new Date().toISOString().slice(0, 10),
    priority: "Normal",
    title: "",
    body: "",
    action_required: "",
    assigned_to: "",
    completed: false
  });

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "daily_manager_notes_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setNotes(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNotes([]);
    }
  };

  const saveNotes = async (nextNotes) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "daily_manager_notes_json",
        setting_value: JSON.stringify(nextNotes, null, 2),
        description: "Daily manager notes and action items",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setNotes(nextNotes);
    return true;
  };

  const addNote = async () => {
    setMessage("");

    if (!form.title || !form.body) {
      setMessage("Title and note are required.");
      return;
    }

    const note = {
      id: `manager_note_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveNotes([note, ...notes]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Daily Manager Note Created",
      table_name: "app_settings",
      record_id: note.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: note.title
    });

    setMessage("Manager note saved.");
    setForm({
      note_date: new Date().toISOString().slice(0, 10),
      priority: "Normal",
      title: "",
      body: "",
      action_required: "",
      assigned_to: "",
      completed: false
    });
  };

  const updateNote = async (id, updates) => {
    const next = notes.map((note) =>
      note.id === id ? { ...note, ...updates, updated_at: new Date().toISOString() } : note
    );

    const saved = await saveNotes(next);
    if (saved) setMessage("Note updated.");
  };

  const visibleNotes = useMemo(
    () => notes.filter((note) => !filterDate || note.note_date === filterDate),
    [notes, filterDate]
  );

  const openActions = notes.filter((note) => note.action_required && !note.completed);

  return (
    <div>
      <h2>Daily Manager Notes</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Notes" value={notes.length} />
        <StatCard title="Open Actions" value={openActions.length} />
        <StatCard title="Urgent" value={notes.filter((note) => note.priority === "Urgent" && !note.completed).length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Manager Note</h3>

        <div style={gridStyle}>
          <label>
            Date
            <input type="date" value={form.note_date} onChange={(e) => setForm((p) => ({ ...p, note_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} style={inputStyle}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>

          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Assigned To
            <input value={form.assigned_to} onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Note
          <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Action Required
          <textarea value={form.action_required} onChange={(e) => setForm((p) => ({ ...p, action_required: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addNote}>Save Note</button>
      </div>

      <div style={panelStyle}>
        <label>
          Filter Date
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={() => setFilterDate("")}>Show All</button>
      </div>

      <div style={noteGrid}>
        {visibleNotes.map((note) => (
          <div key={note.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{note.title}</h3>
            <p><strong>{note.priority}</strong> | {note.note_date} | {note.created_by_email}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{note.body}</p>
            {note.action_required && (
              <div style={actionBox}>
                <strong>Action:</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{note.action_required}</p>
                <p>Assigned: {note.assigned_to || "-"}</p>
                <label>
                  <input type="checkbox" checked={note.completed} onChange={(e) => updateNote(note.id, { completed: e.target.checked })} /> Completed
                </label>
              </div>
            )}
          </div>
        ))}

        {visibleNotes.length === 0 && <p>No manager notes found.</p>}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 80 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const noteGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const actionBox = { background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: 10 };

export default DailyManagerNotesManager;
