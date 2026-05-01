import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PaymentReconciliationManager({ user }) {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [paymentsResult, invoicesResult] = await Promise.all([
      supabase.from("invoice_payments").select("*, invoices(invoice_number, repair_order_number, customer_name, grand_total)").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false })
    ]);

    if (paymentsResult.error || invoicesResult.error) {
      setMessage(paymentsResult.error?.message || invoicesResult.error?.message);
      return;
    }

    setPayments(paymentsResult.data || []);
    setInvoices(invoicesResult.data || []);
  };

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) =>
        dateFilter ? String(payment.payment_date || payment.created_at || "").startsWith(dateFilter) : true
      ),
    [payments, dateFilter]
  );

  const totalsByMethod = useMemo(() => {
    const totals = {};
    filteredPayments.forEach((payment) => {
      const method = payment.payment_method || "Unknown";
      totals[method] = (totals[method] || 0) + Number(payment.amount || 0);
    });
    return totals;
  }, [filteredPayments]);

  const suspiciousInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const total = Number(invoice.grand_total || 0);
        const paid = Number(invoice.amount_paid || 0);
        const status = invoice.payment_status || "";
        if (status === "Paid" && paid < total) return true;
        if (paid > total && total > 0) return true;
        return false;
      }),
    [invoices]
  );

  const exportCsv = () => {
    const rows = [
      ["Date", "Invoice", "Customer", "Method", "Amount", "Note"],
      ...filteredPayments.map((payment) => [
        payment.payment_date || payment.created_at || "",
        payment.invoices?.invoice_number || payment.invoices?.repair_order_number || "",
        payment.invoices?.customer_name || "",
        payment.payment_method || "",
        payment.amount || 0,
        payment.note || ""
      ])
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `payment-reconciliation-${dateFilter || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Payment Reconciliation</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Payments" value={filteredPayments.length} />
        <StatCard title="Total" value={`$${filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2)}`} />
        <StatCard title="Methods" value={Object.keys(totalsByMethod).length} />
        <StatCard title="Review Items" value={suspiciousInvoices.length} />
      </div>

      <div style={panelStyle}>
        <label>
          Date
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={() => setDateFilter("")}>Show All</button>{" "}
        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={exportCsv}>Export CSV</button>

        <h4>Totals by Method</h4>
        {Object.entries(totalsByMethod).map(([method, total]) => (
          <p key={method}><strong>{method}:</strong> ${total.toFixed(2)}</p>
        ))}
      </div>

      {suspiciousInvoices.length > 0 && (
        <div style={warningPanelStyle}>
          <h3>Payment Status Review</h3>
          {suspiciousInvoices.map((invoice) => (
            <p key={invoice.id}>
              <strong>{invoice.invoice_number || invoice.repair_order_number}</strong> - {invoice.customer_name}:
              total ${Number(invoice.grand_total || 0).toFixed(2)}, paid ${Number(invoice.amount_paid || 0).toFixed(2)}, status {invoice.payment_status || "-"}
            </p>
          ))}
        </div>
      )}

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Note</th>
          </tr>
        </thead>

        <tbody>
          {filteredPayments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.payment_date || "-"}</td>
              <td>{payment.invoices?.invoice_number || payment.invoices?.repair_order_number || "-"}</td>
              <td>{payment.invoices?.customer_name || "-"}</td>
              <td>{payment.payment_method || "-"}</td>
              <td>${Number(payment.amount || 0).toFixed(2)}</td>
              <td>{payment.note || "-"}</td>
            </tr>
          ))}

          {filteredPayments.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center" }}>No payments found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 220, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const warningPanelStyle = { border: "1px solid #f59e0b", background: "#fffbeb", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PaymentReconciliationManager;
