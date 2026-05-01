import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function ProfitReportsManager({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [history, setHistory] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [message, setMessage] = useState("");
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, historyResult, expenseResult] = await Promise.all([
      supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
      supabase.from("history").select("*").order("used_date", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "shop_expenses_json").maybeSingle()
    ]);

    if (invoiceResult.error || historyResult.error) {
      setMessage(invoiceResult.error?.message || historyResult.error?.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setHistory(historyResult.data || []);

    try {
      const parsed = JSON.parse(expenseResult.data?.setting_value || "[]");
      setExpenses(Array.isArray(parsed) ? parsed : []);
    } catch {
      setExpenses([]);
    }
  };

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) =>
        monthFilter ? String(invoice.invoice_date || "").startsWith(monthFilter) : true
      ),
    [invoices, monthFilter]
  );

  const filteredHistory = useMemo(
    () =>
      history.filter((item) =>
        monthFilter ? String(item.used_date || "").startsWith(monthFilter) : true
      ),
    [history, monthFilter]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        monthFilter ? String(expense.expense_date || "").startsWith(monthFilter) : true
      ),
    [expenses, monthFilter]
  );

  const report = useMemo(() => {
    const revenue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.grand_total || 0),
      0
    );

    const laborRevenue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.labor_subtotal || 0),
      0
    );

    const partsRevenue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.parts_subtotal || 0),
      0
    );

    const taxCollected = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.tax_total || 0),
      0
    );

    const shopFees = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.shop_fee || 0),
      0
    );

    const knownPartCost = filteredHistory.reduce(
      (sum, item) => sum + Number(item.cost || 0) * Number(item.quantity || 0),
      0
    );

    const knownPartCharged = filteredHistory.reduce(
      (sum, item) => sum + Number(item.net || 0) * Number(item.quantity || 0),
      0
    );

    const expensesTotal = filteredExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );

    const grossProfit = revenue - knownPartCost - taxCollected;
    const netProfitEstimate = grossProfit - expensesTotal;

    return {
      revenue,
      laborRevenue,
      partsRevenue,
      taxCollected,
      shopFees,
      knownPartCost,
      knownPartCharged,
      knownPartProfit: knownPartCharged - knownPartCost,
      expensesTotal,
      grossProfit,
      netProfitEstimate,
      invoiceCount: filteredInvoices.length
    };
  }, [filteredInvoices, filteredHistory, filteredExpenses]);

  const exportCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ["Invoice Count", report.invoiceCount],
      ["Revenue", report.revenue],
      ["Labor Revenue", report.laborRevenue],
      ["Parts Revenue", report.partsRevenue],
      ["Shop Fees", report.shopFees],
      ["Tax Collected", report.taxCollected],
      ["Known Part Cost", report.knownPartCost],
      ["Known Part Charged", report.knownPartCharged],
      ["Known Part Profit", report.knownPartProfit],
      ["Expenses", report.expensesTotal],
      ["Gross Profit Estimate", report.grossProfit],
      ["Net Profit Estimate", report.netProfitEstimate]
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `profit-report-${monthFilter || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const max = Math.max(report.revenue, report.laborRevenue, report.partsRevenue, report.expensesTotal, 1);

  return (
    <div>
      <h2>Profit Reports</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Month
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={() => setMonthFilter("")}>
          Show All
        </button>{" "}
        <button type="button" onClick={loadAll}>
          Refresh
        </button>{" "}
        <button type="button" onClick={exportCsv}>
          Export Report CSV
        </button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Revenue" value={`$${report.revenue.toFixed(2)}`} />
        <StatCard title="Invoices" value={report.invoiceCount} />
        <StatCard title="Labor Revenue" value={`$${report.laborRevenue.toFixed(2)}`} />
        <StatCard title="Parts Revenue" value={`$${report.partsRevenue.toFixed(2)}`} />
        <StatCard title="Known Part Cost" value={`$${report.knownPartCost.toFixed(2)}`} />
        <StatCard title="Known Part Profit" value={`$${report.knownPartProfit.toFixed(2)}`} />
        <StatCard title="Expenses" value={`$${report.expensesTotal.toFixed(2)}`} />
        <StatCard title="Net Profit Estimate" value={`$${report.netProfitEstimate.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Breakdown</h3>
        <Bar label="Revenue" value={report.revenue} max={max} />
        <Bar label="Labor" value={report.laborRevenue} max={max} />
        <Bar label="Parts" value={report.partsRevenue} max={max} />
        <Bar label="Expenses" value={report.expensesTotal} max={max} />
      </div>

      <p>
        Note: profit is an estimate because some invoices may not have exact part
        cost history attached. The report uses `history.cost/net` when available
        plus tracked expenses.
      </p>
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

function Bar({ label, value, max }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{label}</strong>
        <span>${value.toFixed(2)}</span>
      </div>
      <div style={barTrack}>
        <div style={{ ...barFill, width: `${Math.max((value / max) * 100, 4)}%` }} />
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", maxWidth: 240, padding: 8, boxSizing: "border-box", margin: "4px 8px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const barTrack = { background: "#e5e7eb", borderRadius: 10, height: 18, overflow: "hidden" };
const barFill = { height: 18, borderRadius: 10, background: "#2563eb" };

export default ProfitReportsManager;
