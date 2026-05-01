import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PROMISE_STATUSES = ["On Track", "At Risk", "Late", "Completed", "Customer Notified"];

function PromiseTimeManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [promiseRecords, setPromiseRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    promise_date: "",
    promise_time: "",
    status: "On Track",
    customer_notified: false,
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "promise_times_json").maybeSingle()
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setPromiseRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPromiseRecords([]);
    }
  };

  const savePromiseRecords = async (nextRecords) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "promise_times_json",
        setting_value: JSON.stringify(nextRecords, null, 2),
        description: "Customer promise time records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setPromiseRecords(nextRecords);
    return true;
  };

  const addPromise = async () => {
    setMessage("");

    if (!form.invoice_id || !form.promise_date) {
      setMessage("Job and promise date are required.");
      return;
    }

    const job = jobs.find((item) => item.id === form.invoice_id);
    const existing = promiseRecords.find((item) => item.invoice_id === form.invoice_id);

    const record = {
      id: existing?.id || `promise_${Date.now()}`,
      ...form,
      document_number: job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      customer_name: job?.customer_name || "",
      customer_phone: job?.customer_phone || "",
      customer_email: job?.customer_email || "",
      updated_by: user?.id || null,
      updated_by_email: user?.email || "",
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString()
    };

    const nextRecords = existing
      ? promiseRecords.map((item) => (item.id === existing.id ? record : item))
      : [record, ...promiseRecords];

    const saved = await savePromiseRecords(nextRecords);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Promise Time Saved",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${record.document_number} promised ${record.promise_date} ${record.promise_time}`
    });

    setMessage("Promise time saved.");
    setForm({
      invoice_id: "",
      promise_date: "",
      promise_time: "",
      status: "On Track",
      customer_notified: false,
      notes: ""
    });
  };

  const updatePromise = async (id, updates) => {
    const next = promiseRecords.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await savePromiseRecords(next);
    if (saved) setMessage("Promise updated.");
  };

  const rows = useMemo(() => {
    const now = new Date();

    return promiseRecords
      .map((record) => {
        const promiseDateTime = new Date(`${record.promise_date}T${record.promise_time || "17:00"}`);
        const autoLate =
          !["Completed", "Customer Notified"].includes(record.status) &&
          promiseDateTime.getTime() < now.getTime();

        return {
          ...record,
          computedStatus: autoLate ? "Late" : record.status,
          promiseDateTime
        };
      })
      .sort((a, b) => a.promiseDateTime.getTime() - b.promiseDateTime.getTime());
  }, [promiseRecords]);

  const copyCustomerUpdate = async (record) => {
    const text = `Hello ${record.customer_name || ""},

Update for ${record.document_number || "your vehicle"}:
Current promise time is ${record.promise_date || ""} ${record.promise_time || ""}.
Status: ${record.status || "On Track"}.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Customer update copied.");
    } catch {
      setMessage("Could not copy update.");
    }
  };

  return (
    <div>
      <h2>Customer Promise Times</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Promises" value={promiseRecords.length} />
        <StatCard title="Late" value={rows.filter((row) => row.computedStatus === "Late").length} />
        <StatCard title="At Risk" value={rows.filter((row) => row.status === "At Risk").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add / Update Promise</h3>

        <div style={gridStyle}>
          <label>
            Job
            <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
              <option value="">Select job</option>
              {jobs.slice(0, 300).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Promise Date
            <input type="date" value={form.promise_date} onChange={(e) => setForm((p) => ({ ...p, promise_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Promise Time
            <input type="time" value={form.promise_time} onChange={(e) => setForm((p) => ({ ...p, promise_time: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {PROMISE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label style={{ marginTop: 28 }}>
            <input type="checkbox" checked={form.customer_notified} onChange={(e) => setForm((p) => ({ ...p, customer_notified: e.target.checked }))} /> Customer notified
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addPromise}>Save Promise Time</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Promise</th>
            <th>Notified</th>
            <th>Notes</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((record) => (
            <tr key={record.id}>
              <td>
                <select value={record.status} onChange={(e) => updatePromise(record.id, { status: e.target.value })} style={inputStyle}>
                  {PROMISE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
                <br />
                <small style={{ color: record.computedStatus === "Late" ? "red" : "green" }}>
                  {record.computedStatus}
                </small>
              </td>
              <td>{record.document_number || "-"}</td>
              <td>{record.customer_name || "-"}</td>
              <td>{record.promise_date || "-"} {record.promise_time || ""}</td>
              <td>{record.customer_notified ? "Yes" : "No"}</td>
              <td>{record.notes || "-"}</td>
              <td><button type="button" onClick={() => copyCustomerUpdate(record)}>Copy Update</button></td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No promise times.</td></tr>}
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

export default PromiseTimeManager;
