import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { integrationRequest, moneyToCents, getIntegrationApiBase, setIntegrationApiBase } from "./integrationApi";

const REFUND_STATUSES = ["Draft", "Requested", "Succeeded", "Failed", "Cancelled"];

function StripeRefundManager({ user, canEditEverything }) {
  const [apiBase, setApiBase] = useState(getIntegrationApiBase());
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    transaction_id: "",
    amount: "",
    reason: "requested_by_customer",
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([loadTransactions(), loadRefunds()]);
  };

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "stripe_terminal_transactions_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setTransactions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTransactions([]);
    }
  };

  const loadRefunds = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "stripe_refunds_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setRefunds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRefunds([]);
    }
  };

  const saveRefunds = async (nextRefunds) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "stripe_refunds_json",
        setting_value: JSON.stringify(nextRefunds, null, 2),
        description: "Stripe refund transaction records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setRefunds(nextRefunds);
    return true;
  };

  const selectedTransaction = transactions.find((item) => item.id === form.transaction_id);

  const requestRefund = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can process refunds.");
      return;
    }

    if (!selectedTransaction) {
      setMessage("Select a successful Stripe transaction first.");
      return;
    }

    const refundAmount = Number(form.amount || selectedTransaction.amount || 0);

    if (refundAmount <= 0) {
      setMessage("Refund amount must be greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const payload = await integrationRequest("/api/stripe-terminal/refund-payment", {
        method: "POST",
        body: {
          paymentIntentId: selectedTransaction.payment_intent_id,
          amount: moneyToCents(refundAmount),
          reason: form.reason
        }
      });

      const refund = {
        id: `stripe_refund_${Date.now()}`,
        transaction_id: selectedTransaction.id,
        payment_intent_id: selectedTransaction.payment_intent_id,
        refund_id: payload.refund?.id || payload.id || "",
        document_number: selectedTransaction.document_number || "",
        customer_name: selectedTransaction.customer_name || "",
        amount: refundAmount,
        reason: form.reason,
        notes: form.notes,
        status: payload.refund?.status === "succeeded" || payload.status === "succeeded" ? "Succeeded" : "Requested",
        mock: Boolean(payload.mock),
        created_by: user?.id || null,
        created_by_email: user?.email || "",
        created_at: new Date().toISOString()
      };

      const saved = await saveRefunds([refund, ...refunds]);

      if (!saved) return;

      await supabase.from("audit_logs").insert({
        action: "Stripe Refund Created",
        table_name: "app_settings",
        record_id: refund.id,
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `${refund.document_number} refund $${refund.amount.toFixed(2)}`
      });

      setMessage(payload.mock ? "Mock refund recorded." : "Stripe refund requested.");
      setForm({
        transaction_id: "",
        amount: "",
        reason: "requested_by_customer",
        notes: ""
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRefund = async (id, updates) => {
    const nextRefunds = refunds.map((refund) =>
      refund.id === id ? { ...refund, ...updates, updated_at: new Date().toISOString() } : refund
    );

    const saved = await saveRefunds(nextRefunds);
    if (saved) setMessage("Refund updated.");
  };

  const saveApiBase = () => {
    setIntegrationApiBase(apiBase);
    setMessage("Integration API base saved.");
  };

  const successfulTransactions = transactions.filter((item) => item.status === "Succeeded");

  const totals = useMemo(
    () => ({
      count: refunds.length,
      total: refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0),
      succeeded: refunds.filter((refund) => refund.status === "Succeeded").length
    }),
    [refunds]
  );

  return (
    <div>
      <h2>Stripe Refunds</h2>

      <p>
        Use this to send a refund request to Stripe for payments collected through Stripe Terminal.
      </p>

      {message && <p style={{ color: message.includes("must") || message.includes("Select") || message.includes("Only") ? "red" : "green" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Integration Backend</h3>
        <label>
          Backend URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={saveApiBase}>Save Backend URL</button>{" "}
        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Refunds" value={totals.count} />
        <StatCard title="Succeeded" value={totals.succeeded} />
        <StatCard title="Refund Total" value={`$${totals.total.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Create Refund</h3>

        <div style={gridStyle}>
          <label>
            Stripe Transaction
            <select value={form.transaction_id} onChange={(e) => setForm((p) => ({ ...p, transaction_id: e.target.value }))} style={inputStyle}>
              <option value="">Select successful transaction</option>
              {successfulTransactions.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {transaction.document_number || transaction.payment_intent_id} - {transaction.customer_name || "Customer"} - ${Number(transaction.amount || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Refund Amount
            <input
              type="number"
              value={form.amount}
              placeholder={selectedTransaction ? Number(selectedTransaction.amount || 0).toFixed(2) : "0.00"}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            Reason
            <select value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} style={inputStyle}>
              <option value="requested_by_customer">Requested by customer</option>
              <option value="duplicate">Duplicate</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={requestRefund} disabled={loading || !canEditEverything}>Request Refund</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Refund ID</th>
            <th>Reason</th>
            <th>Mock</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {refunds.map((refund) => (
            <tr key={refund.id}>
              <td>
                <select value={refund.status} onChange={(e) => updateRefund(refund.id, { status: e.target.value })} style={inputStyle}>
                  {REFUND_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{refund.document_number || "-"}</td>
              <td>{refund.customer_name || "-"}</td>
              <td>${Number(refund.amount || 0).toFixed(2)}</td>
              <td><small>{refund.refund_id || "-"}</small></td>
              <td>{refund.reason}</td>
              <td>{refund.mock ? "Yes" : "No"}</td>
              <td>{refund.notes || "-"}</td>
            </tr>
          ))}

          {refunds.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No refunds yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 70 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default StripeRefundManager;
