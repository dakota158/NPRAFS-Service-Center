import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Open", "Quoted", "Follow-Up", "Approved", "Declined", "Completed"];
const PRIORITIES = ["Low", "Normal", "High", "Safety"];

function DeferredWorkManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [deferredItems, setDeferredItems] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    customer_name: "",
    vehicle: "",
    description: "",
    estimated_amount: "",
    priority: "Normal",
    status: "Open",
    follow_up_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, deferredResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "deferred_work_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(deferredResult.data?.setting_value || "[]");
      setDeferredItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDeferredItems([]);
    }
  };

  const saveDeferredItems = async (nextItems) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "deferred_work_json",
        setting_value: JSON.stringify(nextItems, null, 2),
        description: "Deferred work recommendation records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setDeferredItems(nextItems);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) {
          next.customer_name = doc.customer_name || "";
          next.vehicle = [doc.vehicle_year, doc.vehicle_make, doc.vehicle_model].filter(Boolean).join(" ");
        }
      }

      return next;
    });
  };

  const addDeferred = async () => {
    setMessage("");

    if (!form.customer_name || !form.description) {
      setMessage("Customer and description are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const item = {
      id: `deferred_${Date.now()}`,
      ...form,
      estimated_amount: Number(form.estimated_amount || 0),
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveDeferredItems([item, ...deferredItems]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Deferred Work Created",
      table_name: "app_settings",
      record_id: item.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${item.customer_name} - ${item.description}`
    });

    setMessage("Deferred work saved.");
    setForm({
      invoice_id: "",
      customer_name: "",
      vehicle: "",
      description: "",
      estimated_amount: "",
      priority: "Normal",
      status: "Open",
      follow_up_date: "",
      notes: ""
    });
  };

  const updateDeferred = async (id, updates) => {
    const next = deferredItems.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveDeferredItems(next);
    if (saved) setMessage("Deferred work updated.");
  };

  const copyFollowUp = async (item) => {
    const text = `Hello ${item.customer_name || ""},

We are following up on a deferred service recommendation for your ${item.vehicle || "vehicle"}:

${item.description}

Estimated amount: $${Number(item.estimated_amount || 0).toFixed(2)}

Please contact us if you would like to schedule this work.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Follow-up copied.");
    } catch {
      setMessage("Could not copy follow-up.");
    }
  };

  const openValue = useMemo(
    () =>
      deferredItems
        .filter((item) => !["Declined", "Completed"].includes(item.status))
        .reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0),
    [deferredItems]
  );

  return (
    <div>
      <h2>Deferred Work Tracking</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open Items" value={deferredItems.filter((item) => !["Declined", "Completed"].includes(item.status)).length} />
        <StatCard title="Open Value" value={`$${openValue.toFixed(2)}`} />
        <StatCard title="Safety Items" value={deferredItems.filter((item) => item.priority === "Safety" && item.status !== "Completed").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Deferred Work</h3>

        <div style={gridStyle}>
          <label>
            Related Document
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">Manual entry</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Customer
            <input value={form.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Vehicle
            <input value={form.vehicle} onChange={(e) => updateForm("vehicle", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Estimated Amount
            <input type="number" value={form.estimated_amount} onChange={(e) => updateForm("estimated_amount", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)} style={inputStyle}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
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
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addDeferred}>Save Deferred Work</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Priority</th>
            <th>Customer / Vehicle</th>
            <th>Description</th>
            <th>Estimate</th>
            <th>Follow-Up</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {deferredItems.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateDeferred(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td style={{ color: item.priority === "Safety" ? "red" : "inherit" }}>{item.priority}</td>
              <td>{item.customer_name}<br /><small>{item.vehicle || ""}</small></td>
              <td style={{ whiteSpace: "pre-wrap" }}>{item.description}</td>
              <td>${Number(item.estimated_amount || 0).toFixed(2)}</td>
              <td>{item.follow_up_date || "-"}</td>
              <td><button type="button" onClick={() => copyFollowUp(item)}>Copy Follow-Up</button></td>
            </tr>
          ))}

          {deferredItems.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No deferred work.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default DeferredWorkManager;
