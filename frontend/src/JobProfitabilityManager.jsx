import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function JobProfitabilityManager() {
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [daysBack, setDaysBack] = useState("90");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, historyResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("history").select("*").order("used_date", { ascending: false })
    ]);

    if (jobsResult.error || historyResult.error) {
      setMessage(jobsResult.error?.message || historyResult.error?.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setHistory(historyResult.data || []);
  };

  const rows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysBack || 90));

    return jobs
      .filter((job) => {
        const created = job.created_at ? new Date(job.created_at) : null;
        return !created || created >= cutoff;
      })
      .map((job) => {
        const docNumber = job.invoice_number || job.repair_order_number || job.estimate_number || "";
        const usedParts = history.filter((item) => item.repair_order_number === docNumber);
        const partsCost = usedParts.reduce(
          (sum, item) => sum + Number(item.cost || 0) * Number(item.quantity || 0),
          0
        );
        const laborRevenue = Number(job.labor_subtotal || 0);
        const partsRevenue = Number(job.parts_subtotal || 0);
        const totalRevenue = Number(job.grand_total || 0);
        const estimatedGross = totalRevenue - partsCost;
        const margin = totalRevenue > 0 ? (estimatedGross / totalRevenue) * 100 : 0;

        let rating = "Healthy";
        if (margin < 20) rating = "Low Margin";
        if (margin < 0) rating = "Loss";

        return {
          ...job,
          docNumber,
          partsCost,
          laborRevenue,
          partsRevenue,
          totalRevenue,
          estimatedGross,
          margin,
          rating
        };
      })
      .sort((a, b) => a.margin - b.margin);
  }, [jobs, history, daysBack]);

  const totals = useMemo(
    () => ({
      revenue: rows.reduce((sum, row) => sum + row.totalRevenue, 0),
      gross: rows.reduce((sum, row) => sum + row.estimatedGross, 0),
      partsCost: rows.reduce((sum, row) => sum + row.partsCost, 0)
    }),
    [rows]
  );

  const exportCsv = () => {
    const csvRows = [
      ["Document", "Customer", "Revenue", "Parts Cost", "Estimated Gross", "Margin", "Rating"],
      ...rows.map((row) => [
        row.docNumber,
        row.customer_name || "",
        row.totalRevenue.toFixed(2),
        row.partsCost.toFixed(2),
        row.estimatedGross.toFixed(2),
        `${row.margin.toFixed(1)}%`,
        row.rating
      ])
    ];

    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `job-profitability-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Job Profitability</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Days Back
          <input type="number" value={daysBack} onChange={(e) => setDaysBack(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={exportCsv}>Export CSV</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Jobs" value={rows.length} />
        <StatCard title="Revenue" value={`$${totals.revenue.toFixed(2)}`} />
        <StatCard title="Parts Cost" value={`$${totals.partsCost.toFixed(2)}`} />
        <StatCard title="Gross Estimate" value={`$${totals.gross.toFixed(2)}`} />
        <StatCard title="Low Margin" value={rows.filter((row) => row.rating !== "Healthy").length} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Rating</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Revenue</th>
            <th>Parts Cost</th>
            <th>Gross Estimate</th>
            <th>Margin</th>
          </tr>
        </thead>

        <tbody>
          {rows.slice(0, 200).map((row) => (
            <tr key={row.id}>
              <td style={{ color: row.rating === "Healthy" ? "green" : "red" }}>{row.rating}</td>
              <td>{row.docNumber || "-"}</td>
              <td>{row.customer_name || "-"}</td>
              <td>${row.totalRevenue.toFixed(2)}</td>
              <td>${row.partsCost.toFixed(2)}</td>
              <td>${row.estimatedGross.toFixed(2)}</td>
              <td>{row.margin.toFixed(1)}%</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No job data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 180, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default JobProfitabilityManager;
