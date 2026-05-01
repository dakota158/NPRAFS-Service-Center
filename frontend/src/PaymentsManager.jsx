import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PAYMENT_METHODS = ["Cash", "Check", "Credit Card", "Debit Card", "ACH", "Other"];

function PaymentsManager({ user, canEditEverything }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    amount: "",
    payment_method: "Cash",
    payment_date: new Date().toISOString().slice(0, 10),
    note: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setMessage("");

    const [invoiceResult, paymentResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoice_payments")
        .select("*, invoices(invoice_number, repair_order_number, customer_name, grand_total)")
        .order("created_at", { ascending: false })
    ]);

    if (invoiceResult.error || paymentResult.error) {
      setMessage(invoiceResult.error?.message || paymentResult.error?.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setPayments(paymentResult.data || []);
  };

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === paymentForm.invoice_id),
    [invoices, paymentForm.invoice_id]
  );

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (invoice.document_status && invoice.document_status !== "Invoice") return false;

      if (!term) return true;

      return [
        invoice.invoice_number,
        invoice.repair_order_number,
        invoice.customer_name,
        invoice.customer_phone,
        invoice.customer_email,
        invoice.payment_status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [invoices, search]);

  const getInvoicePayments = (invoiceId) =>
    payments.filter((payment) => payment.invoice_id === invoiceId);

  const getPaidAmount = (invoice) =>
    getInvoicePayments(invoice.id).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

  const getBalanceDue = (invoice) =>
    Math.max(0, Number(invoice.grand_total || 0) - getPaidAmount(invoice));

  const updatePaymentForm = (field, value) => {
    setPaymentForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const selectInvoiceForPayment = (invoice) => {
    const balanceDue = getBalanceDue(invoice);

    setPaymentForm((prev) => ({
      ...prev,
      invoice_id: invoice.id,
      amount: balanceDue > 0 ? String(balanceDue.toFixed(2)) : ""
    }));
  };

  const addPayment = async () => {
    setMessage("");

    if (!paymentForm.invoice_id) {
      setMessage("Select an invoice first.");
      return;
    }

    const amount = Number(paymentForm.amount || 0);

    if (!amount || amount <= 0) {
      setMessage("Payment amount must be greater than zero.");
      return;
    }

    const invoice = invoices.find((item) => item.id === paymentForm.invoice_id);

    if (!invoice) {
      setMessage("Selected invoice could not be found.");
      return;
    }

    const { error: paymentError } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      amount,
      payment_method: paymentForm.payment_method,
      payment_date: paymentForm.payment_date || new Date().toISOString().slice(0, 10),
      note: paymentForm.note,
      created_by: user?.id || null
    });

    if (paymentError) {
      setMessage(paymentError.message);
      return;
    }

    const previousPaid = getPaidAmount(invoice);
    const nextPaid = previousPaid + amount;
    const nextBalance = Math.max(0, Number(invoice.grand_total || 0) - nextPaid);
    const nextStatus =
      nextBalance <= 0 ? "Paid" : nextPaid > 0 ? "Partial" : "Unpaid";

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        amount_paid: nextPaid,
        balance_due: nextBalance,
        payment_status: nextStatus,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        updated_at: new Date().toISOString()
      })
      .eq("id", invoice.id);

    if (invoiceError) {
      setMessage(invoiceError.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Payment Added",
      table_name: "invoice_payments",
      record_id: invoice.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Added $${amount.toFixed(2)} payment to ${invoice.invoice_number || invoice.repair_order_number}`
    });

    setMessage("Payment saved.");
    setPaymentForm({
      invoice_id: "",
      amount: "",
      payment_method: "Cash",
      payment_date: new Date().toISOString().slice(0, 10),
      note: ""
    });
    loadAll();
  };

  const totalOutstanding = filteredInvoices.reduce(
    (sum, invoice) => sum + getBalanceDue(invoice),
    0
  );

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return (
    <div>
      <h2>Payments</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Invoices" value={filteredInvoices.length} />
        <StatCard title="Payments Recorded" value={payments.length} />
        <StatCard title="Total Paid" value={`$${totalPaid.toFixed(2)}`} />
        <StatCard title="Outstanding" value={`$${totalOutstanding.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Payment</h3>

        <div style={gridStyle}>
          <label>
            Invoice
            <select
              value={paymentForm.invoice_id}
              onChange={(e) => updatePaymentForm("invoice_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select invoice</option>
              {filteredInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number || invoice.repair_order_number} -{" "}
                  {invoice.customer_name || "Customer"} - Balance $
                  {getBalanceDue(invoice).toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              value={paymentForm.amount}
              onChange={(e) => updatePaymentForm("amount", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Method
            <select
              value={paymentForm.payment_method}
              onChange={(e) => updatePaymentForm("payment_method", e.target.value)}
              style={inputStyle}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              value={paymentForm.payment_date}
              onChange={(e) => updatePaymentForm("payment_date", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        {selectedInvoice && (
          <p>
            Selected balance due: <strong>${getBalanceDue(selectedInvoice).toFixed(2)}</strong>
          </p>
        )}

        <label>
          Note
          <textarea
            value={paymentForm.note}
            onChange={(e) => updatePaymentForm("note", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={addPayment}>
          Save Payment
        </button>
      </div>

      <h3>Invoices / Balances</h3>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search invoices, customers, payment status..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredInvoices.map((invoice) => {
            const paid = getPaidAmount(invoice);
            const balance = getBalanceDue(invoice);

            return (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number || invoice.repair_order_number || "-"}</td>
                <td>{invoice.customer_name || "-"}</td>
                <td>${Number(invoice.grand_total || 0).toFixed(2)}</td>
                <td>${paid.toFixed(2)}</td>
                <td>${balance.toFixed(2)}</td>
                <td>{balance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid"}</td>
                <td>
                  <button type="button" onClick={() => selectInvoiceForPayment(invoice)}>
                    Add Payment
                  </button>
                </td>
              </tr>
            );
          })}

          {filteredInvoices.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No invoices found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Recent Payments</h3>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Note</th>
          </tr>
        </thead>

        <tbody>
          {payments.slice(0, 50).map((payment) => (
            <tr key={payment.id}>
              <td>{payment.payment_date || "-"}</td>
              <td>
                {payment.invoices?.invoice_number ||
                  payment.invoices?.repair_order_number ||
                  "-"}
              </td>
              <td>{payment.invoices?.customer_name || "-"}</td>
              <td>${Number(payment.amount || 0).toFixed(2)}</td>
              <td>{payment.payment_method || "-"}</td>
              <td>{payment.note || "-"}</td>
            </tr>
          ))}

          {payments.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No payments recorded.
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
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 80,
  marginBottom: 12
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: 18
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 18
};

const statCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14
};

export default PaymentsManager;
