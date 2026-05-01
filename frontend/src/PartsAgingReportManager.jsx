import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PartsAgingReportManager() {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, ordersResult, historyResult] = await Promise.all([
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("orders").select("*"),
      supabase.from("history").select("*")
    ]);

    if (partsResult.error || ordersResult.error || historyResult.error) {
      setMessage(partsResult.error?.message || ordersResult.error?.message || historyResult.error?.message);
      return;
    }

    setParts(partsResult.data || []);
    setOrders(ordersResult.data || []);
    setHistory(historyResult.data || []);
  };

  const rows = useMemo(() => {
    const now = Date.now();

    return parts.map((part) => {
      const receivedDate =
        part.date_received ||
        orders
          .filter((order) => order.part_number === part.part_number && order.received_date)
          .sort((a, b) => String(b.received_date).localeCompare(String(a.received_date)))[0]?.received_date ||
        part.created_at;

      const lastUsed =
        history
          .filter((item) => item.part_number === part.part_number)
          .sort((a, b) => String(b.used_date).localeCompare(String(a.used_date)))[0]?.used_date || "";

      const ageDays = receivedDate ? Math.max(0, Math.floor((now - new Date(receivedDate).getTime()) / 1000 / 60 / 60 / 24)) : 0;
      const qty = Number(part.quantity || 0);

      let bucket = "0-30";
      if (ageDays > 365) bucket = "365+";
      else if (ageDays > 180) bucket = "181-365";
      else if (ageDays > 90) bucket = "91-180";
      else if (ageDays > 30) bucket = "31-90";

      return {
        ...part,
        receivedDate,
        lastUsed,
        ageDays,
        qty,
        bucket
      };
    }).sort((a, b) => b.ageDays - a.ageDays);
  }, [parts, orders, history]);

  const buckets = useMemo(() => {
    const totals = {};
    rows.forEach((row) => {
      totals[row.bucket] = (totals[row.bucket] || 0) + row.qty;
    });
    return totals;
  }, [rows]);

  const exportCsv = () => {
    const csvRows = [
      ["Part #", "Description", "Qty", "Age Days", "Bucket", "Received", "Last Used"],
      ...rows.map((row) => [
        row.part_number || "",
        row.name || "",
        row.qty,
        row.ageDays,
        row.bucket,
        row.receivedDate || "",
        row.lastUsed || ""
      ])
    ];

    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `parts-aging-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Parts Aging Report</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>Refresh</button>{" "}
      <button type="button" onClick={exportCsv} style={{ marginBottom: 12 }}>Export CSV</button>

      <div style={cardGrid}>
        <StatCard title="Parts" value={rows.length} />
        <StatCard title="0-30 Qty" value={buckets["0-30"] || 0} />
        <StatCard title="31-90 Qty" value={buckets["31-90"] || 0} />
        <StatCard title="91-180 Qty" value={buckets["91-180"] || 0} />
        <StatCard title="181-365 Qty" value={buckets["181-365"] || 0} />
        <StatCard title="365+ Qty" value={buckets["365+"] || 0} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Bucket</th>
            <th>Age Days</th>
            <th>Part #</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Received</th>
            <th>Last Used</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.bucket}</td>
              <td>{row.ageDays}</td>
              <td>{row.part_number || "-"}</td>
              <td>{row.name || "-"}</td>
              <td>{row.qty}</td>
              <td>{row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : "-"}</td>
              <td>{row.lastUsed ? new Date(row.lastUsed).toLocaleDateString() : "-"}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No parts found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PartsAgingReportManager;
