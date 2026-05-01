import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Held", "Applied", "Refunded", "Forfeited"];

function CustomerDepositManager({ user, canEditEverything }) {
  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    customer_name: "",
    amount: "",
    payment_method: "Cash",
    deposit_date: new Date().toISOString().slice(0, 10),
    status: "Held",
    applied_amount: "",
    refund_amount: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, paymentsResult, depositsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("invoice_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_deposits_json").maybeSingle()
    ]);

    if (docsResult.error || paymentsResult.error) {
      setMessage(docsResult.error?.message || paymentsResult.error?.message);
      return;
    }

    setDocuments(docsResult.data || []);
    setPayments(paymentsResult.data || []);

    try {
      const parsed = JSON.parse(depositsResult.data?.setting_value || "[]");
      setDeposits(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDeposits([]);
    }
  };

  const saveDeposits = async (nextDeposits) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_deposits_json",
        setting_value: JSON.stringify(nextDeposits, null, 2),
        description: "Customer deposit ledger records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setDeposits(nextDeposits);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) next.customer_name = doc.customer_name || "";
      }
      return next;
    });
  };

  const addDeposit = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add deposits.");
      return;
    }

    if (!form.customer_name || !form.amount) {
      setMessage("Customer and amount are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const deposit = {
      id: `deposit_${Date.now()}`,
      ...form,
      amount: Number(form.amount || 0),
      applied_amount: Number(form.applied_amount || 0),
      refund_amount: Number(form.refund_amount || 0),
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveDeposits([deposit, ...deposits]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Customer Deposit Created",
      table_name: "app_settings",
      record_id: deposit.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${deposit.customer_name} deposit $${deposit.amount.toFixed(2)}`
    });

    setMessage("Deposit saved.");
    setForm({
      invoice_id: "",
      customer_name: "",
      amount: "",
      payment_method: "Cash",
      deposit_date: new Date().toISOString().slice(0, 10),
      status: "Held",
      applied_amount: "",
      refund_amount: "",
      notes: ""
    });
  };

  const updateDeposit = async (id, updates) => {
    const next = deposits.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveDeposits(next);
    if (saved) setMessage("Deposit updated.");
  };

  const totals = useMemo(
    () => ({
      held: deposits.filter((item) => item.status === "Held").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      applied: deposits.reduce((sum, item) => sum + Number(item.applied_amount || 0), 0),
      refunded: deposits.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0),
      count: deposits.length
    }),
    [deposits]
  );

  return (
    <div>
      <h2>Customer Deposit Tracking</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Deposits" value={totals.count} />
        <StatCard title="Held" value={`$${totals.held.toFixed(2)}`} />
        <StatCard title="Applied" value={`$${totals.applied.toFixed(2)}`} />
        <StatCard title="Refunded" value={`$${totals.refunded.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Deposit</h3>

        <div style={gridStyle}>
          <label>
            Related Document
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">Manual deposit</option>
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
            Amount
            <input type="number" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Method
            <select value={form.payment_method} onChange={(e) => updateForm("payment_method", e.target.value)} style={inputStyle}>
              <option>Cash</option>
              <option>Card</option>
              <option>Check</option>
              <option>ACH</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Date
            <input type="date" value={form.deposit_date} onChange={(e) => updateForm("deposit_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Applied Amount
            <input type="number" value={form.applied_amount} onChange={(e) => updateForm("applied_amount", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Refund Amount
            <input type="number" value={form.refund_amount} onChange={(e) => updateForm("refund_amount", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addDeposit} disabled={!canEditEverything}>Save Deposit</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Document</th>
            <th>Amount</th>
            <th>Applied</th>
            <th>Refunded</th>
            <th>Method</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {deposits.map((deposit) => (
            <tr key={deposit.id}>
              <td>
                <select value={deposit.status} onChange={(e) => updateDeposit(deposit.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{deposit.deposit_date || "-"}</td>
              <td>{deposit.customer_name}</td>
              <td>{deposit.document_number || "-"}</td>
              <td>${Number(deposit.amount || 0).toFixed(2)}</td>
              <td>${Number(deposit.applied_amount || 0).toFixed(2)}</td>
              <td>${Number(deposit.refund_amount || 0).toFixed(2)}</td>
              <td>{deposit.payment_method}</td>
              <td>{deposit.notes || "-"}</td>
            </tr>
          ))}

          {deposits.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No deposits.</td></tr>}
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

export default CustomerDepositManager;
