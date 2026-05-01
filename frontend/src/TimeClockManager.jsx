import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TimeClockManager({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [entries, setEntries] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedTech, setSelectedTech] = useState(user?.name || user?.email || "");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [profilesResult, jobsResult, settingsResult] = await Promise.all([
      supabase.from("profiles").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "time_clock_entries_json")
        .maybeSingle()
    ]);

    if (profilesResult.error || jobsResult.error) {
      setMessage(profilesResult.error?.message || jobsResult.error?.message);
      return;
    }

    setProfiles(profilesResult.data || []);
    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setEntries(Array.isArray(parsed) ? parsed : []);
    } catch {
      setEntries([]);
    }
  };

  const saveEntries = async (nextEntries) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "time_clock_entries_json",
        setting_value: JSON.stringify(nextEntries, null, 2),
        description: "Technician time tracking entries",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setEntries(nextEntries);
    return true;
  };

  const openEntry = entries.find(
    (entry) => entry.technician_name === selectedTech && !entry.clock_out
  );

  const clockIn = async () => {
    setMessage("");

    if (!selectedTech) {
      setMessage("Select a technician.");
      return;
    }

    if (openEntry) {
      setMessage("This technician is already clocked in.");
      return;
    }

    const job = jobs.find((item) => item.id === selectedJobId);

    const entry = {
      id: `time_${Date.now()}`,
      technician_name: selectedTech,
      invoice_id: selectedJobId,
      document_number:
        job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      customer_name: job?.customer_name || "",
      clock_in: new Date().toISOString(),
      clock_out: "",
      note,
      created_by: user?.id || null
    };

    const saved = await saveEntries([entry, ...entries]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Technician Clock In",
      table_name: "app_settings",
      record_id: entry.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${selectedTech} clocked in`
    });

    setNote("");
    setMessage("Clocked in.");
  };

  const clockOut = async () => {
    setMessage("");

    if (!openEntry) {
      setMessage("This technician is not clocked in.");
      return;
    }

    const nextEntries = entries.map((entry) =>
      entry.id === openEntry.id
        ? { ...entry, clock_out: new Date().toISOString(), note: note || entry.note }
        : entry
    );

    const saved = await saveEntries(nextEntries);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Technician Clock Out",
      table_name: "app_settings",
      record_id: openEntry.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${selectedTech} clocked out`
    });

    setNote("");
    setMessage("Clocked out.");
  };

  const getHours = (entry) => {
    if (!entry.clock_in) return 0;

    const start = new Date(entry.clock_in).getTime();
    const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();

    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

    return Math.max(0, (end - start) / 1000 / 60 / 60);
  };

  const techSummary = useMemo(() => {
    const summary = {};

    entries.forEach((entry) => {
      if (!summary[entry.technician_name]) {
        summary[entry.technician_name] = {
          name: entry.technician_name,
          hours: 0,
          open: 0,
          entries: 0
        };
      }

      summary[entry.technician_name].hours += getHours(entry);
      summary[entry.technician_name].entries += 1;
      if (!entry.clock_out) summary[entry.technician_name].open += 1;
    });

    return Object.values(summary);
  }, [entries]);

  return (
    <div>
      <h2>Technician Time Clock</h2>

      {message && (
        <p style={{ color: message.includes("Clocked") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        {techSummary.map((tech) => (
          <div key={tech.name} style={statCard}>
            <div style={{ fontWeight: "bold" }}>{tech.name}</div>
            <div>{tech.hours.toFixed(2)} hrs</div>
            <small>{tech.open ? "Clocked in" : "Not clocked in"}</small>
          </div>
        ))}
      </div>

      <div style={panelStyle}>
        <h3>Clock In / Out</h3>

        <div style={gridStyle}>
          <label>
            Technician
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select technician</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.name || profile.email}>
                  {profile.name || profile.email} ({profile.role})
                </option>
              ))}
            </select>
          </label>

          <label>
            Job / RO
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              style={inputStyle}
            >
              <option value="">No linked job</option>
              {jobs.slice(0, 200).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} -{" "}
                  {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={clockIn}>
          Clock In
        </button>{" "}
        <button type="button" onClick={clockOut}>
          Clock Out
        </button>{" "}
        <button type="button" onClick={loadAll}>
          Refresh
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Technician</th>
            <th>Job</th>
            <th>Customer</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Hours</th>
            <th>Note</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.technician_name}</td>
              <td>{entry.document_number || "-"}</td>
              <td>{entry.customer_name || "-"}</td>
              <td>{entry.clock_in ? new Date(entry.clock_in).toLocaleString() : "-"}</td>
              <td>{entry.clock_out ? new Date(entry.clock_out).toLocaleString() : "Open"}</td>
              <td>{getHours(entry).toFixed(2)}</td>
              <td>{entry.note || "-"}</td>
            </tr>
          ))}

          {entries.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No time entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default TimeClockManager;
