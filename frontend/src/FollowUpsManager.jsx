import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const FOLLOW_UP_TYPES = [
  "Estimate Follow Up",
  "Repair Completed",
  "Payment Reminder",
  "Parts Arrived",
  "Service Reminder",
  "General"
];

function FollowUpsManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [message, setMessage] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    invoice_id: "",
    type: "General",
    due_date: new Date().toISOString().slice(0, 10),
    assigned_to: user?.name || user?.email || "",
    note: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, docsResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "follow_ups_json")
        .maybeSingle()
    ]);

    if (customersResult.error || docsResult.error) {
      setMessage(customersResult.error?.message || docsResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setFollowUps(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFollowUps([]);
    }
  };

  const saveFollowUps = async (nextFollowUps) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "follow_ups_json",
        setting_value: JSON.stringify(nextFollowUps, null, 2),
        description: "Customer follow up tasks",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setFollowUps(nextFollowUps);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) {
          next.customer_id = doc.customer_id || "";
          next.note =
            next.note ||
            `Follow up about ${doc.document_status || "document"} ${
              doc.invoice_number || doc.repair_order_number || doc.estimate_number || ""
            }`;
        }
      }

      return next;
    });
  };

  const createFollowUp = async () => {
    setMessage("");

    if (!form.due_date || !form.note) {
      setMessage("Due date and note are required.");
      return;
    }

    const customer = customers.find((item) => item.id === form.customer_id);
    const doc = documents.find((item) => item.id === form.invoice_id);

    const nextFollowUp = {
      id: `follow_${Date.now()}`,
      customer_id: form.customer_id,
      customer_name: customer?.name || doc?.customer_name || "",
      customer_phone: customer?.phone || doc?.customer_phone || "",
      customer_email: customer?.email || doc?.customer_email || "",
      invoice_id: form.invoice_id,
      document_number:
        doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      type: form.type,
      due_date: form.due_date,
      assigned_to: form.assigned_to,
      note: form.note,
      completed: false,
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveFollowUps([nextFollowUp, ...followUps]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Follow Up Created",
      table_name: "app_settings",
      record_id: nextFollowUp.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created ${form.type} follow up for ${nextFollowUp.customer_name || "customer"}`
    });

    setMessage("Follow up created.");
    setForm({
      customer_id: "",
      invoice_id: "",
      type: "General",
      due_date: new Date().toISOString().slice(0, 10),
      assigned_to: user?.name || user?.email || "",
      note: ""
    });
  };

  const markComplete = async (followUp) => {
    const nextFollowUps = followUps.map((item) =>
      item.id === followUp.id
        ? {
            ...item,
            completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user?.id || null
          }
        : item
    );

    const saved = await saveFollowUps(nextFollowUps);

    if (saved) setMessage("Follow up completed.");
  };

  const visibleFollowUps = useMemo(
    () =>
      followUps
        .filter((item) => (showCompleted ? true : !item.completed))
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))),
    [followUps, showCompleted]
  );

  const overdueCount = followUps.filter(
    (item) =>
      !item.completed &&
      item.due_date &&
      item.due_date < new Date().toISOString().slice(0, 10)
  ).length;

  return (
    <div>
      <h2>Customer Follow Ups</h2>

      {message && (
        <p style={{ color: message.includes("created") || message.includes("completed") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Open Follow Ups" value={followUps.filter((item) => !item.completed).length} />
        <StatCard title="Overdue" value={overdueCount} />
        <StatCard title="Completed" value={followUps.filter((item) => item.completed).length} />
      </div>

      <div style={panelStyle}>
        <h3>Create Follow Up</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select
              value={form.customer_id}
              onChange={(e) => updateForm("customer_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Related Document
            <select
              value={form.invoice_id}
              onChange={(e) => updateForm("invoice_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">No document</option>
              {documents.slice(0, 200).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_status || "Invoice"} -{" "}
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} -{" "}
                  {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select
              value={form.type}
              onChange={(e) => updateForm("type", e.target.value)}
              style={inputStyle}
            >
              {FOLLOW_UP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Due Date
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => updateForm("due_date", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Assigned To
            <input
              value={form.assigned_to}
              onChange={(e) => updateForm("assigned_to", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Note
          <textarea
            value={form.note}
            onChange={(e) => updateForm("note", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={createFollowUp}>
          Create Follow Up
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
        />{" "}
        Show completed follow ups
      </label>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Due</th>
            <th>Type</th>
            <th>Customer</th>
            <th>Contact</th>
            <th>Document</th>
            <th>Assigned</th>
            <th>Note</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {visibleFollowUps.map((followUp) => (
            <tr key={followUp.id}>
              <td style={{ color: followUp.due_date < new Date().toISOString().slice(0, 10) && !followUp.completed ? "red" : "inherit" }}>
                {followUp.due_date}
              </td>
              <td>{followUp.type}</td>
              <td>{followUp.customer_name || "-"}</td>
              <td>
                {followUp.customer_phone || "-"}
                <br />
                <small>{followUp.customer_email || ""}</small>
              </td>
              <td>{followUp.document_number || "-"}</td>
              <td>{followUp.assigned_to || "-"}</td>
              <td>{followUp.note || "-"}</td>
              <td>
                {followUp.completed ? (
                  "Completed"
                ) : (
                  <button type="button" onClick={() => markComplete(followUp)}>
                    Mark Complete
                  </button>
                )}
              </td>
            </tr>
          ))}

          {visibleFollowUps.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                No follow ups found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default FollowUpsManager;
