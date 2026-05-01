import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function AdvisorPerformanceManager() {
  const [invoices, setInvoices] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [lostSales, setLostSales] = useState([]);
  const [message, setMessage] = useState("");
  const [daysBack, setDaysBack] = useState("90");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, approvalResult, lostResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_approvals_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "lost_sales_json").maybeSingle()
    ]);

    if (invoiceResult.error) {
      setMessage(invoiceResult.error.message);
      return;
    }

    setInvoices(invoiceResult.data || []);

    try {
      const parsed = JSON.parse(approvalResult.data?.setting_value || "[]");
      setApprovals(Array.isArray(parsed) ? parsed : []);
    } catch {
      setApprovals([]);
    }

    try {
      const parsed = JSON.parse(lostResult.data?.setting_value || "[]");
      setLostSales(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLostSales([]);
    }
  };

  const rows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysBack || 90));

    const recentInvoices = invoices.filter((invoice) => {
      const date = new Date(invoice.created_at || invoice.invoice_date || "");
      return date >= cutoff;
    });

    const advisorMap = {};

    recentInvoices.forEach((invoice) => {
      const advisor = invoice.service_advisor || invoice.created_by_email || invoice.created_by || "Unassigned";
      if (!advisorMap[advisor]) {
        advisorMap[advisor] = { advisor, invoices: 0, revenue: 0, estimates: 0, invoicesConverted: 0, approved: 0, declined: 0, lost: 0 };
      }

      advisorMap[advisor].invoices += 1;
      advisorMap[advisor].revenue += Number(invoice.grand_total || 0);

      if (invoice.document_status === "Estimate" || invoice.estimate_number) advisorMap[advisor].estimates += 1;
      if (invoice.document_status === "Invoice" || invoice.invoice_number) advisorMap[advisor].invoicesConverted += 1;
    });

    approvals.forEach((approval) => {
      const advisor = approval.created_by_email || "Unassigned";
      if (!advisorMap[advisor]) {
        advisorMap[advisor] = { advisor, invoices: 0, revenue: 0, estimates: 0, invoicesConverted: 0, approved: 0, declined: 0, lost: 0 };
      }
      if (approval.status === "Approved") advisorMap[advisor].approved += 1;
      if (approval.status === "Declined") advisorMap[advisor].declined += 1;
    });

    lostSales.forEach((lost) => {
      const advisor = lost.created_by_email || "Unassigned";
      if (!advisorMap[advisor]) {
        advisorMap[advisor] = { advisor, invoices: 0, revenue: 0, estimates: 0, invoicesConverted: 0, approved: 0, declined: 0, lost: 0 };
      }
      advisorMap[advisor].lost += Number(lost.amount || 0);
    });

    return Object.values(advisorMap)
      .map((row) => ({
        ...row,
        avgTicket: row.invoices ? row.revenue / row.invoices : 0,
        approvalRate: row.approved + row.declined ? (row.approved / (row.approved + row.declined)) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [invoices, approvals, lostSales, daysBack]);

  return (
    <div>
      <h2>Service Advisor Performance</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Days Back
          <input type="number" value={daysBack} onChange={(e) => setDaysBack(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Advisor</th>
            <th>Documents</th>
            <th>Revenue</th>
            <th>Avg Ticket</th>
            <th>Estimates</th>
            <th>Invoices</th>
            <th>Approvals</th>
            <th>Approval Rate</th>
            <th>Lost Sales</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.advisor}>
              <td>{row.advisor}</td>
              <td>{row.invoices}</td>
              <td>${row.revenue.toFixed(2)}</td>
              <td>${row.avgTicket.toFixed(2)}</td>
              <td>{row.estimates}</td>
              <td>{row.invoicesConverted}</td>
              <td>{row.approved} / {row.declined}</td>
              <td>{row.approvalRate.toFixed(1)}%</td>
              <td>${row.lost.toFixed(2)}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No advisor data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", maxWidth: 180, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default AdvisorPerformanceManager;
