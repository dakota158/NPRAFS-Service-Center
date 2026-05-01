import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { centsToMoney, integrationRequest, moneyToCents, getIntegrationApiBase, setIntegrationApiBase } from "./integrationApi";

const PAYMENT_STATUSES = ["Ready", "PaymentIntent Created", "Sent To Reader", "Succeeded", "Failed", "Cancelled"];
const PAYMENT_METHODS = ["Stripe Terminal", "Manual Card", "Cash", "Check", "Other"];

function StripeTerminalManager({ user, canEditEverything }) {
  const [apiBase, setApiBase] = useState(getIntegrationApiBase());
  const [invoices, setInvoices] = useState([]);
  const [readers, setReaders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedReaderId, setSelectedReaderId] = useState("");
  const [amountOverride, setAmountOverride] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Stripe Terminal");
  const [message, setMessage] = useState("");
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInvoices();
    loadTransactions();
    checkBackend();
  }, []);

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);

  const amountDue = useMemo(() => {
    if (!selectedInvoice) return 0;
    return Math.max(
      0,
      Number(selectedInvoice.grand_total || 0) - Number(selectedInvoice.amount_paid || 0)
    );
  }, [selectedInvoice]);

  const amountToCharge = Number(amountOverride || amountDue || 0);

  const loadInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInvoices(data || []);
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

  const saveTransactions = async (nextTransactions) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "stripe_terminal_transactions_json",
        setting_value: JSON.stringify(nextTransactions, null, 2),
        description: "Stripe Terminal payment transaction records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setTransactions(nextTransactions);
    return true;
  };

  const checkBackend = async () => {
    setMessage("");

    try {
      const payload = await integrationRequest("/api/integrations/status");
      setBackendStatus(payload);
      setMessage("Integration backend connected.");
    } catch (error) {
      setBackendStatus(null);
      setMessage(`Backend not connected yet: ${error.message}`);
    }
  };

  const loadReaders = async () => {
    setLoading(true);
    setMessage("");

    try {
      const payload = await integrationRequest("/api/stripe-terminal/readers");
      setReaders(payload.readers || []);
      setMessage(payload.mock ? "Loaded mock readers. Add Stripe keys to use live readers." : "Loaded Stripe Terminal readers.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    setMessage("");

    if (!selectedInvoice) {
      setMessage("Select an invoice first.");
      return;
    }

    if (amountToCharge <= 0) {
      setMessage("Amount must be greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const payload = await integrationRequest("/api/stripe-terminal/create-payment-intent", {
        method: "POST",
        body: {
          amount: moneyToCents(amountToCharge),
          currency: "usd",
          invoiceId: selectedInvoice.id,
          documentNumber: selectedInvoice.invoice_number || selectedInvoice.repair_order_number || selectedInvoice.estimate_number || "",
          customerName: selectedInvoice.customer_name || "",
          metadata: {
            source: "autoshop",
            invoice_id: selectedInvoice.id,
            user_email: user?.email || ""
          }
        }
      });

      const transaction = {
        id: `stripe_tx_${Date.now()}`,
        invoice_id: selectedInvoice.id,
        document_number: selectedInvoice.invoice_number || selectedInvoice.repair_order_number || selectedInvoice.estimate_number || "",
        customer_name: selectedInvoice.customer_name || "",
        payment_intent_id: payload.paymentIntent?.id || payload.id || "",
        client_secret: payload.paymentIntent?.client_secret || payload.client_secret || "",
        amount: amountToCharge,
        currency: "usd",
        status: "PaymentIntent Created",
        payment_method: paymentMethod,
        reader_id: "",
        mock: Boolean(payload.mock),
        created_by: user?.id || null,
        created_by_email: user?.email || "",
        created_at: new Date().toISOString()
      };

      await saveTransactions([transaction, ...transactions]);

      await supabase.from("audit_logs").insert({
        action: "Stripe PaymentIntent Created",
        table_name: "app_settings",
        record_id: transaction.id,
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `${transaction.document_number} $${transaction.amount.toFixed(2)}`
      });

      setMessage(payload.mock ? "Mock PaymentIntent created." : "PaymentIntent created.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendToReader = async (transaction) => {
    setMessage("");

    if (!selectedReaderId) {
      setMessage("Select a reader first.");
      return;
    }

    setLoading(true);

    try {
      const payload = await integrationRequest("/api/stripe-terminal/process-reader-payment", {
        method: "POST",
        body: {
          readerId: selectedReaderId,
          paymentIntentId: transaction.payment_intent_id
        }
      });

      const nextTransactions = transactions.map((item) =>
        item.id === transaction.id
          ? {
              ...item,
              reader_id: selectedReaderId,
              status: payload.status || "Sent To Reader",
              reader_action: payload.reader?.action || payload.action || null,
              updated_at: new Date().toISOString()
            }
          : item
      );

      await saveTransactions(nextTransactions);

      setMessage(payload.mock ? "Mock payment sent to reader." : "Payment sent to reader.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const markPaid = async (transaction) => {
    setMessage("");

    const invoice = invoices.find((item) => item.id === transaction.invoice_id);

    if (!invoice) {
      setMessage("Could not find invoice for transaction.");
      return;
    }

    const newPaidAmount = Number(invoice.amount_paid || 0) + Number(transaction.amount || 0);
    const isPaid = newPaidAmount >= Number(invoice.grand_total || 0);

    const { error: paymentError } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      amount: Number(transaction.amount || 0),
      payment_method: transaction.payment_method || "Stripe Terminal",
      payment_date: new Date().toISOString().slice(0, 10),
      note: `Stripe Terminal ${transaction.payment_intent_id || transaction.id}`,
      created_by: user?.id || null
    });

    if (paymentError) {
      setMessage(paymentError.message);
      return;
    }

    const { error: invoiceError } = await supabase.from("invoices").update({
      amount_paid: newPaidAmount,
      payment_status: isPaid ? "Paid" : "Partial",
      updated_at: new Date().toISOString()
    }).eq("id", invoice.id);

    if (invoiceError) {
      setMessage(invoiceError.message);
      return;
    }

    const nextTransactions = transactions.map((item) =>
      item.id === transaction.id
        ? { ...item, status: "Succeeded", updated_at: new Date().toISOString() }
        : item
    );

    await saveTransactions(nextTransactions);
    await loadInvoices();

    await supabase.from("audit_logs").insert({
      action: "Stripe Terminal Payment Marked Paid",
      table_name: "invoices",
      record_id: invoice.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${transaction.document_number} $${Number(transaction.amount || 0).toFixed(2)}`
    });

    setMessage("Payment recorded on invoice.");
  };

  const saveApiBase = () => {
    setIntegrationApiBase(apiBase);
    setMessage("Integration API base saved.");
  };

  return (
    <div>
      <h2>Stripe Terminal / Card Reader Payments</h2>

      <p>
        This screen is ready for Stripe Terminal. It can create PaymentIntents on your backend,
        send them to a reader, and record successful payments back onto invoices.
      </p>

      {message && <p style={{ color: message.includes("not connected") || message.includes("required") || message.includes("greater") ? "red" : "green" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Integration Backend</h3>
        <label>
          Backend URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={saveApiBase}>Save Backend URL</button>{" "}
        <button type="button" onClick={checkBackend}>Test Backend</button>
        {backendStatus && (
          <pre style={preStyle}>{JSON.stringify(backendStatus, null, 2)}</pre>
        )}
      </div>

      <div style={cardGrid}>
        <StatCard title="Transactions" value={transactions.length} />
        <StatCard title="Created" value={transactions.filter((item) => item.status === "PaymentIntent Created").length} />
        <StatCard title="Succeeded" value={transactions.filter((item) => item.status === "Succeeded").length} />
        <StatCard title="Collected" value={`$${transactions.filter((item) => item.status === "Succeeded").reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Create Card Reader Payment</h3>

        <div style={gridStyle}>
          <label>
            Invoice / RO
            <select value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)} style={inputStyle}>
              <option value="">Select invoice</option>
              {invoices.slice(0, 300).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number || invoice.repair_order_number || invoice.estimate_number} - {invoice.customer_name || "Customer"} - Due ${Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)).toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Amount Override
            <input
              type="number"
              value={amountOverride}
              placeholder={amountDue ? amountDue.toFixed(2) : "0.00"}
              onChange={(e) => setAmountOverride(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Payment Method
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={inputStyle}>
              {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
            </select>
          </label>

          <label>
            Reader
            <select value={selectedReaderId} onChange={(e) => setSelectedReaderId(e.target.value)} style={inputStyle}>
              <option value="">Select reader</option>
              {readers.map((reader) => (
                <option key={reader.id} value={reader.id}>
                  {reader.label || reader.id} - {reader.status || "unknown"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" onClick={loadReaders} disabled={loading}>Load Readers</button>{" "}
        <button type="button" onClick={createPaymentIntent} disabled={loading || !canEditEverything}>Create PaymentIntent</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>PaymentIntent</th>
            <th>Reader</th>
            <th>Mock</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.status}</td>
              <td>{transaction.document_number || "-"}</td>
              <td>{transaction.customer_name || "-"}</td>
              <td>${Number(transaction.amount || 0).toFixed(2)}</td>
              <td><small>{transaction.payment_intent_id || "-"}</small></td>
              <td>{transaction.reader_id || "-"}</td>
              <td>{transaction.mock ? "Yes" : "No"}</td>
              <td>
                {transaction.status !== "Succeeded" && (
                  <>
                    <button type="button" onClick={() => sendToReader(transaction)} disabled={loading}>Send To Reader</button>{" "}
                    <button type="button" onClick={() => markPaid(transaction)} disabled={!canEditEverything}>Mark Paid</button>
                  </>
                )}
              </td>
            </tr>
          ))}

          {transactions.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No Stripe transactions yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const preStyle = { background: "#f8fafc", padding: 10, borderRadius: 8, overflow: "auto" };

export default StripeTerminalManager;
