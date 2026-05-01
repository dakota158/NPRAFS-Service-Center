import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_BAYS = [
  { id: "bay_1", name: "Bay 1", type: "General", status: "Open", job_id: "", notes: "" },
  { id: "bay_2", name: "Bay 2", type: "General", status: "Open", job_id: "", notes: "" },
  { id: "bay_3", name: "Bay 3", type: "Lift", status: "Open", job_id: "", notes: "" }
];

const BAY_STATUSES = ["Open", "Occupied", "Cleaning", "Down", "Reserved"];

function BayManager({ user, canEditEverything }) {
  const [bays, setBays] = useState(DEFAULT_BAYS);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");
  const [newBay, setNewBay] = useState({ name: "", type: "General", notes: "" });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [settingsResult, jobsResult] = await Promise.all([
      supabase.from("app_settings").select("*").eq("setting_key", "shop_bays_json").maybeSingle(),
      supabase.from("invoices").select("*").order("updated_at", { ascending: false })
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) setBays(parsed);
    } catch {
      setBays(DEFAULT_BAYS);
    }
  };

  const saveBays = async (nextBays) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "shop_bays_json",
        setting_value: JSON.stringify(nextBays, null, 2),
        description: "Shop bay assignment board",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setBays(nextBays);
    return true;
  };

  const addBay = async () => {
    setMessage("");

    if (!newBay.name) {
      setMessage("Bay name is required.");
      return;
    }

    const bay = {
      id: `bay_${Date.now()}`,
      name: newBay.name,
      type: newBay.type,
      status: "Open",
      job_id: "",
      notes: newBay.notes,
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveBays([...bays, bay]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Bay Created",
      table_name: "app_settings",
      record_id: bay.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created bay ${bay.name}`
    });

    setNewBay({ name: "", type: "General", notes: "" });
    setMessage("Bay saved.");
  };

  const updateBay = async (bayId, updates) => {
    const nextBays = bays.map((bay) => {
      if (bay.id !== bayId) return bay;

      const next = { ...bay, ...updates, updated_at: new Date().toISOString() };

      if (updates.job_id !== undefined) {
        next.status = updates.job_id ? "Occupied" : "Open";
      }

      return next;
    });

    const saved = await saveBays(nextBays);

    if (saved) {
      setMessage("Bay updated.");
    }
  };

  const getJob = (jobId) => jobs.find((job) => job.id === jobId);

  const occupiedCount = bays.filter((bay) => bay.status === "Occupied").length;
  const downCount = bays.filter((bay) => bay.status === "Down").length;

  return (
    <div>
      <h2>Bay Management</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Bays" value={bays.length} />
        <StatCard title="Occupied" value={occupiedCount} />
        <StatCard title="Open" value={bays.filter((bay) => bay.status === "Open").length} />
        <StatCard title="Down" value={downCount} />
      </div>

      <div style={panelStyle}>
        <h3>Add Bay</h3>

        <div style={gridStyle}>
          <label>
            Bay Name
            <input value={newBay.name} onChange={(e) => setNewBay((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Type
            <select value={newBay.type} onChange={(e) => setNewBay((p) => ({ ...p, type: e.target.value }))} style={inputStyle}>
              <option>General</option>
              <option>Lift</option>
              <option>Alignment</option>
              <option>Detail</option>
              <option>Diagnostic</option>
            </select>
          </label>

          <label>
            Notes
            <input value={newBay.notes} onChange={(e) => setNewBay((p) => ({ ...p, notes: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <button type="button" onClick={addBay}>Add Bay</button>
      </div>

      <div style={bayGridStyle}>
        {bays.map((bay) => {
          const job = getJob(bay.job_id);

          return (
            <div key={bay.id} style={bayCardStyle}>
              <h3 style={{ marginTop: 0 }}>{bay.name}</h3>
              <p><strong>Type:</strong> {bay.type}</p>

              <label>
                Status
                <select value={bay.status} onChange={(e) => updateBay(bay.id, { status: e.target.value })} style={inputStyle}>
                  {BAY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>

              <label>
                Assigned Job
                <select value={bay.job_id || ""} onChange={(e) => updateBay(bay.id, { job_id: e.target.value })} style={inputStyle}>
                  <option value="">No job assigned</option>
                  {jobs.slice(0, 250).map((jobOption) => (
                    <option key={jobOption.id} value={jobOption.id}>
                      {jobOption.repair_order_number || jobOption.invoice_number || jobOption.estimate_number} - {jobOption.customer_name || "Customer"}
                    </option>
                  ))}
                </select>
              </label>

              {job && (
                <div style={summaryBox}>
                  <strong>{job.customer_name}</strong>
                  <br />
                  {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ")}
                  <br />
                  <small>{job.status || job.document_status}</small>
                </div>
              )}

              <label>
                Notes
                <textarea value={bay.notes || ""} onChange={(e) => updateBay(bay.id, { notes: e.target.value })} style={textareaStyle} />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 70 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const bayGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 };
const bayCardStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14 };
const summaryBox = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 10, marginBottom: 10 };

export default BayManager;
