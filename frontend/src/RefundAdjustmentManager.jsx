import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TYPES = ["Refund", "Discount", "Write-Off", "Correction", "Goodwill"];
const STATUSES = ["Pending", "Approved", "Denied", "Completed"];

function RefundAdjustmentManager({ user, canEditEverything }) {
  const [documents, setDocuments] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    adjustment_type: "Refund",
    amount: "",
    reason: "",
    status: "Pending",
    approved_by: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "refund_adjustments_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setAdjustments(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAdjustments([]);
    }
  };

  const saveAdjustments = async (nextAdjustments) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "refund_adjustments_json",
        setting_value: JSON.stringify(nextAdjustments, null, 2),
        description: "Refund, discount, write-off, and adjustment records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setAdjustments(nextAdjustments);
    return true;
  };

  const addAdjustment = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add adjustments.");
      return;
    }

    if (!form.invoice_id || !form.amount || !form.reason) {
      setMessage("Document, amount, and reason are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const adjustment = {
      id: `adjustment_${Date.now()}`,
      ...form,
      amount: Number(form.amount || 0),
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      customer_name: doc?.customer_name || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveAdjustments([adjustment, ...adjustments]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Refund Adjustment Created",
      table_name: "app_settings",
      record_id: adjustment.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${adjustment.adjustment_type} ${adjustment.document_number} $${adjustment.amount}`
    });

    setMessage("Adjustment saved.");
    setForm({
      invoice_id: "",
      adjustment_type: "Refund",
      amount: "",
      reason: "",
      status: "Pending",
      approved_by: "",
      notes: ""
    });
  };

  const updateAdjustment = async (id, updates) => {
    const next = adjustments.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveAdjustments(next);
    if (saved) setMessage("Adjustment updated.");
  };

  const totalPending = useMemo(
    () =>
      adjustments
        .filter((item) => item.status === "Pending")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [adjustments]
  );

  const totalCompleted = useMemo(
    () =>
      adjustments
        .filter((item) => item.status === "Completed" || item.status === "Approved")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [adjustments]
  );

  return (
    <div>
      <h2>Refunds / Adjustments</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Records" value={adjustments.length} />
        <StatCard title="Pending" value={`$${totalPending.toFixed(2)}`} />
        <StatCard title="Approved/Completed" value={`$${totalCompleted.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Adjustment</h3>

        <div style={gridStyle}>
          <label>
            Document
            <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
              <option value="">Select document</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"} - ${Number(doc.grand_total || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select value={form.adjustment_type} onChange={(e) => setForm((p) => ({ ...p, adjustment_type: e.target.value }))} style={inputStyle}>
              {TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          <label>
            Amount
            <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Approved By
            <input value={form.approved_by} onChange={(e) => setForm((p) => ({ ...p, approved_by: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Reason
          <textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addAdjustment} disabled={!canEditEverything}>Save Adjustment</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Type</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Approved By</th>
          </tr>
        </thead>

        <tbody>
          {adjustments.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateAdjustment(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.adjustment_type}</td>
              <td>{item.document_number || "-"}</td>
              <td>{item.customer_name || "-"}</td>
              <td>${Number(item.amount || 0).toFixed(2)}</td>
              <td>{item.reason}</td>
              <td>{item.approved_by || "-"}</td>
            </tr>
          ))}

          {adjustments.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No adjustments.</td></tr>}
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default RefundAdjustmentManager;
