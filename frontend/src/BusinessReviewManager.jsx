import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function BusinessReviewManager() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [lostSales, setLostSales] = useState([]);
  const [satisfaction, setSatisfaction] = useState([]);
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, paymentResult, expensesResult, lostResult, satResult] = await Promise.all([
      supabase.from("invoices").select("*"),
      supabase.from("invoice_payments").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "shop_expenses_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "lost_sales_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_satisfaction_json").maybeSingle()
    ]);

    if (invoiceResult.error || paymentResult.error) {
      setMessage(invoiceResult.error?.message || paymentResult.error?.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setPayments(paymentResult.data || []);

    try { setExpenses(JSON.parse(expensesResult.data?.setting_value || "[]")); } catch { setExpenses([]); }
    try { setLostSales(JSON.parse(lostResult.data?.setting_value || "[]")); } catch { setLostSales([]); }
    try { setSatisfaction(JSON.parse(satResult.data?.setting_value || "[]")); } catch { setSatisfaction([]); }
  };

  const report = useMemo(() => {
    const monthInvoices = invoices.filter((invoice) =>
      String(invoice.invoice_date || invoice.created_at || "").startsWith(month)
    );
    const monthPayments = payments.filter((payment) =>
      String(payment.payment_date || payment.created_at || "").startsWith(month)
    );
    const monthExpenses = expenses.filter((expense) =>
      String(expense.expense_date || expense.created_at || "").startsWith(month)
    );
    const monthLost = lostSales.filter((item) =>
      String(item.created_at || "").startsWith(month)
    );
    const monthSat = satisfaction.filter((item) =>
      String(item.created_at || "").startsWith(month)
    );

    const revenue = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
    const labor = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.labor_subtotal || 0), 0);
    const parts = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.parts_subtotal || 0), 0);
    const collected = monthPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const expenseTotal = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const lostValue = monthLost.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const avgTicket = monthInvoices.length ? revenue / monthInvoices.length : 0;
    const avgRating = monthSat.length ? monthSat.reduce((sum, item) => sum + Number(item.rating || 0), 0) / monthSat.length : 0;

    return {
      invoiceCount: monthInvoices.length,
      revenue,
      labor,
      parts,
      collected,
      expenseTotal,
      netEstimate: revenue - expenseTotal,
      lostValue,
      avgTicket,
      satisfactionCount: monthSat.length,
      avgRating,
      unpaid: monthInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)), 0)
    };
  }, [invoices, payments, expenses, lostSales, satisfaction, month]);

  const exportCsv = () => {
    const rows = [
      ["Monthly Business Review", month],
      ["Invoices", report.invoiceCount],
      ["Revenue", report.revenue.toFixed(2)],
      ["Labor Revenue", report.labor.toFixed(2)],
      ["Parts Revenue", report.parts.toFixed(2)],
      ["Collected", report.collected.toFixed(2)],
      ["Expenses", report.expenseTotal.toFixed(2)],
      ["Net Estimate", report.netEstimate.toFixed(2)],
      ["Unpaid", report.unpaid.toFixed(2)],
      ["Lost Sales", report.lostValue.toFixed(2)],
      ["Average Ticket", report.avgTicket.toFixed(2)],
      ["Satisfaction Responses", report.satisfactionCount],
      ["Average Rating", report.avgRating.toFixed(2)]
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `business-review-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Monthly Business Review</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={exportCsv}>Export Review CSV</button>{" "}
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Invoices" value={report.invoiceCount} />
        <StatCard title="Revenue" value={`$${report.revenue.toFixed(2)}`} />
        <StatCard title="Collected" value={`$${report.collected.toFixed(2)}`} />
        <StatCard title="Expenses" value={`$${report.expenseTotal.toFixed(2)}`} />
        <StatCard title="Net Estimate" value={`$${report.netEstimate.toFixed(2)}`} />
        <StatCard title="Unpaid" value={`$${report.unpaid.toFixed(2)}`} />
        <StatCard title="Lost Sales" value={`$${report.lostValue.toFixed(2)}`} />
        <StatCard title="Avg Ticket" value={`$${report.avgTicket.toFixed(2)}`} />
        <StatCard title="Avg Rating" value={report.avgRating.toFixed(1)} />
      </div>

      <div style={panelStyle}>
        <h3>Owner Notes</h3>
        <ul>
          <li>Review lost sales reasons and estimate follow-up process.</li>
          <li>Compare collected payments against invoice revenue.</li>
          <li>Review unpaid balances and customer credit exposure.</li>
          <li>Review expenses and subscriptions for avoidable cost.</li>
          <li>Use retention and satisfaction screens to plan customer outreach.</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 220, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default BusinessReviewManager;
