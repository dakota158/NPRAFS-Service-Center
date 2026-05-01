import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TechnicianHandoffManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    from_technician: "",
    to_technician: "",
    reason: "",
    current_status: "",
    next_steps: "",
    safety_notes: "",
    parts_notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, profilesResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "technician_handoffs_json").maybeSingle()
    ]);

    if (jobsResult.error || profilesResult.error) {
      setMessage(jobsResult.error?.message || profilesResult.error?.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setProfiles(profilesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setHandoffs(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHandoffs([]);
    }
  };

  const saveHandoffs = async (nextHandoffs) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "technician_handoffs_json",
        setting_value: JSON.stringify(nextHandoffs, null, 2),
        description: "Technician handoff records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setHandoffs(nextHandoffs);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const job = jobs.find((item) => item.id === value);
        if (job) {
          next.from_technician = job.technician_name || next.from_technician;
          next.current_status = job.status || "";
        }
      }

      return next;
    });
  };

  const addHandoff = async () => {
    setMessage("");

    if (!form.invoice_id || !form.to_technician || !form.next_steps) {
      setMessage("Job, receiving technician, and next steps are required.");
      return;
    }

    const job = jobs.find((item) => item.id === form.invoice_id);

    const handoff = {
      id: `handoff_${Date.now()}`,
      ...form,
      document_number: job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      customer_name: job?.customer_name || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveHandoffs([handoff, ...handoffs]);

    if (!saved) return;

    await supabase.from("invoices").update({
      technician_name: form.to_technician,
      internal_notes: [
        job?.internal_notes || "",
        `TECH HANDOFF from ${form.from_technician || "-"} to ${form.to_technician}`,
        `Reason: ${form.reason || "-"}`,
        `Next steps: ${form.next_steps}`
      ].filter(Boolean).join("\n"),
      updated_at: new Date().toISOString()
    }).eq("id", form.invoice_id);

    await supabase.from("audit_logs").insert({
      action: "Technician Handoff Created",
      table_name: "app_settings",
      record_id: handoff.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${handoff.document_number}: ${handoff.from_technician} to ${handoff.to_technician}`
    });

    setMessage("Handoff saved.");
    setForm({
      invoice_id: "",
      from_technician: "",
      to_technician: "",
      reason: "",
      current_status: "",
      next_steps: "",
      safety_notes: "",
      parts_notes: ""
    });
    loadAll();
  };

  const copyHandoff = async (handoff) => {
    const text = `Technician Handoff
Job: ${handoff.document_number}
Customer: ${handoff.customer_name}
From: ${handoff.from_technician || "-"}
To: ${handoff.to_technician}
Status: ${handoff.current_status || "-"}
Reason: ${handoff.reason || "-"}
Next steps: ${handoff.next_steps}
Safety notes: ${handoff.safety_notes || "-"}
Parts notes: ${handoff.parts_notes || "-"}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Handoff copied.");
    } catch {
      setMessage("Could not copy handoff.");
    }
  };

  const techOptions = profiles.map((profile) => profile.name || profile.email).filter(Boolean);

  return (
    <div>
      <h2>Technician Handoff Notes</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Create Handoff</h3>

        <div style={gridStyle}>
          <label>
            Job
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">Select job</option>
              {jobs.slice(0, 300).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            From Technician
            <select value={form.from_technician} onChange={(e) => updateForm("from_technician", e.target.value)} style={inputStyle}>
              <option value="">Select technician</option>
              {techOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>

          <label>
            To Technician
            <select value={form.to_technician} onChange={(e) => updateForm("to_technician", e.target.value)} style={inputStyle}>
              <option value="">Select technician</option>
              {techOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>

          <label>
            Current Status
            <input value={form.current_status} onChange={(e) => updateForm("current_status", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Reason
          <textarea value={form.reason} onChange={(e) => updateForm("reason", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Next Steps
          <textarea value={form.next_steps} onChange={(e) => updateForm("next_steps", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Safety Notes
          <textarea value={form.safety_notes} onChange={(e) => updateForm("safety_notes", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Parts Notes
          <textarea value={form.parts_notes} onChange={(e) => updateForm("parts_notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addHandoff}>Save Handoff</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Job</th>
            <th>Customer</th>
            <th>From</th>
            <th>To</th>
            <th>Next Steps</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {handoffs.map((handoff) => (
            <tr key={handoff.id}>
              <td>{handoff.created_at ? new Date(handoff.created_at).toLocaleString() : "-"}</td>
              <td>{handoff.document_number || "-"}</td>
              <td>{handoff.customer_name || "-"}</td>
              <td>{handoff.from_technician || "-"}</td>
              <td>{handoff.to_technician}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{handoff.next_steps}</td>
              <td><button type="button" onClick={() => copyHandoff(handoff)}>Copy</button></td>
            </tr>
          ))}

          {handoffs.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No handoffs.</td></tr>}
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

export default TechnicianHandoffManager;
