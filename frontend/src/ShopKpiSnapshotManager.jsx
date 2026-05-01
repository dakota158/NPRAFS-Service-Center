import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function ShopKpiSnapshotManager() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [history, setHistory] = useState([]);
  const [lostSales, setLostSales] = useState([]);
  const [message, setMessage] = useState("");
  const [daysBack, setDaysBack] = useState("30");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, paymentResult, historyResult, lostResult] = await Promise.all([
      supabase.from("invoices").select("*"),
      supabase.from("invoice_payments").select("*"),
      supabase.from("history").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "lost_sales_json").maybeSingle()
    ]);

    if (invoiceResult.error || paymentResult.error || historyResult.error) {
      setMessage(invoiceResult.error?.message || paymentResult.error?.message || historyResult.error?.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setPayments(paymentResult.data || []);
    setHistory(historyResult.data || []);

    try {
      const parsed = JSON.parse(lostResult.data?.setting_value || "[]");
      setLostSales(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLostSales([]);
    }
  };

  const kpis = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysBack || 30));

    const recentInvoices = invoices.filter((invoice) => {
      const date = new Date(invoice.invoice_date || invoice.created_at || "");
      return date >= cutoff;
    });

    const recentPayments = payments.filter((payment) => {
      const date = new Date(payment.payment_date || payment.created_at || "");
      return date >= cutoff;
    });

    const recentLost = lostSales.filter((item) => {
      const date = new Date(item.created_at || "");
      return date >= cutoff;
    });

    const revenue = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
    const collected = recentPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const laborRevenue = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.labor_subtotal || 0), 0);
    const partsRevenue = recentInvoices.reduce((sum, invoice) => sum + Number(invoice.parts_subtotal || 0), 0);
    const outstanding = recentInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)), 0);
    const avgTicket = recentInvoices.length ? revenue / recentInvoices.length : 0;
    const lostValue = recentLost.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const paidInvoices = recentInvoices.filter((invoice) => invoice.payment_status === "Paid").length;
    const paidRate = recentInvoices.length ? (paidInvoices / recentInvoices.length) * 100 : 0;

    return {
      revenue,
      collected,
      laborRevenue,
      partsRevenue,
      outstanding,
      avgTicket,
      lostValue,
      invoiceCount: recentInvoices.length,
      paidRate
    };
  }, [invoices, payments, lostSales, daysBack]);

  return (
    <div>
      <h2>Shop KPI Snapshot</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Days Back
          <input type="number" value={daysBack} onChange={(e) => setDaysBack(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Revenue" value={`$${kpis.revenue.toFixed(2)}`} />
        <StatCard title="Collected" value={`$${kpis.collected.toFixed(2)}`} />
        <StatCard title="Outstanding" value={`$${kpis.outstanding.toFixed(2)}`} />
        <StatCard title="Invoices" value={kpis.invoiceCount} />
        <StatCard title="Average Ticket" value={`$${kpis.avgTicket.toFixed(2)}`} />
        <StatCard title="Labor Revenue" value={`$${kpis.laborRevenue.toFixed(2)}`} />
        <StatCard title="Parts Revenue" value={`$${kpis.partsRevenue.toFixed(2)}`} />
        <StatCard title="Paid Rate" value={`${kpis.paidRate.toFixed(1)}%`} />
        <StatCard title="Lost Sales" value={`$${kpis.lostValue.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Snapshot Notes</h3>
        <ul>
          <li>Collected versus revenue shows cash flow timing.</li>
          <li>Outstanding balance highlights accounts receivable work.</li>
          <li>Lost sales value helps prioritize estimate follow-up.</li>
          <li>Average ticket is useful for measuring sales quality, not just car count.</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 180, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default ShopKpiSnapshotManager;
