import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function DemandForecastManager() {
  const [history, setHistory] = useState([]);
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [lookbackDays, setLookbackDays] = useState("90");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [historyResult, partsResult, ordersResult] = await Promise.all([
      supabase.from("history").select("*").order("used_date", { ascending: false }),
      supabase.from("parts").select("*"),
      supabase.from("orders").select("*")
    ]);

    if (historyResult.error || partsResult.error || ordersResult.error) {
      setMessage(historyResult.error?.message || partsResult.error?.message || ordersResult.error?.message);
      return;
    }

    setHistory(historyResult.data || []);
    setParts(partsResult.data || []);
    setOrders(ordersResult.data || []);
  };

  const forecastRows = useMemo(() => {
    const days = Math.max(Number(lookbackDays || 90), 1);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const usage = {};

    history.forEach((item) => {
      const usedDate = item.used_date ? new Date(item.used_date) : null;
      if (usedDate && usedDate < cutoff) return;

      const key = item.part_number || item.name || "Unknown Part";

      if (!usage[key]) {
        usage[key] = {
          part_number: item.part_number || "",
          description: item.name || item.description || "",
          used_qty: 0,
          revenue: 0,
          cost: 0
        };
      }

      usage[key].used_qty += Number(item.quantity || 0);
      usage[key].revenue += Number(item.net || 0) * Number(item.quantity || 0);
      usage[key].cost += Number(item.cost || 0) * Number(item.quantity || 0);
    });

    return Object.values(usage)
      .map((row) => {
        const stock = parts
          .filter((part) => part.part_number === row.part_number)
          .reduce((sum, part) => sum + Number(part.quantity || 0), 0);

        const openOrder = orders
          .filter((order) => order.part_number === row.part_number && !order.received)
          .reduce((sum, order) => sum + Number(order.quantity || 0), 0);

        const monthlyDemand = row.used_qty / (days / 30);
        const suggestedStock = Math.ceil(monthlyDemand * 1.5);
        const reorderQty = Math.max(0, suggestedStock - stock - openOrder);

        return {
          ...row,
          stock,
          openOrder,
          monthlyDemand,
          suggestedStock,
          reorderQty,
          profit: row.revenue - row.cost
        };
      })
      .sort((a, b) => b.used_qty - a.used_qty);
  }, [history, parts, orders, lookbackDays]);

  const exportCsv = () => {
    const rows = [
      ["Part #", "Description", "Used Qty", "Monthly Demand", "Stock", "Open Order", "Suggested Stock", "Reorder Qty", "Revenue", "Cost", "Profit"],
      ...forecastRows.map((row) => [
        row.part_number,
        row.description,
        row.used_qty,
        row.monthlyDemand.toFixed(2),
        row.stock,
        row.openOrder,
        row.suggestedStock,
        row.reorderQty,
        row.revenue.toFixed(2),
        row.cost.toFixed(2),
        row.profit.toFixed(2)
      ])
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `parts-demand-forecast-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Parts Demand Forecast</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Forecast Rows" value={forecastRows.length} />
        <StatCard title="Suggested Reorders" value={forecastRows.filter((row) => row.reorderQty > 0).length} />
        <StatCard title="Used Qty" value={forecastRows.reduce((sum, row) => sum + row.used_qty, 0)} />
      </div>

      <div style={panelStyle}>
        <label>
          Lookback Days
          <input type="number" value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={exportCsv}>Export CSV</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Used</th>
            <th>Monthly Demand</th>
            <th>Stock</th>
            <th>Open Order</th>
            <th>Suggested Stock</th>
            <th>Reorder</th>
            <th>Profit</th>
          </tr>
        </thead>

        <tbody>
          {forecastRows.map((row) => (
            <tr key={`${row.part_number}-${row.description}`}>
              <td>{row.part_number || "-"}</td>
              <td>{row.description || "-"}</td>
              <td>{row.used_qty}</td>
              <td>{row.monthlyDemand.toFixed(2)}</td>
              <td>{row.stock}</td>
              <td>{row.openOrder}</td>
              <td>{row.suggestedStock}</td>
              <td><strong>{row.reorderQty}</strong></td>
              <td>${row.profit.toFixed(2)}</td>
            </tr>
          ))}

          {forecastRows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No usage history found.</td></tr>}
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

export default DemandForecastManager;
