import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function InventoryValuationManager() {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, ordersResult, priceBookResult] = await Promise.all([
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("orders").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_price_book_json").maybeSingle()
    ]);

    if (partsResult.error || ordersResult.error) {
      setMessage(partsResult.error?.message || ordersResult.error?.message);
      return;
    }

    setParts(partsResult.data || []);
    setOrders(ordersResult.data || []);

    try {
      const parsed = JSON.parse(priceBookResult.data?.setting_value || "[]");
      setPriceBook(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPriceBook([]);
    }
  };

  const rows = useMemo(
    () =>
      parts.map((part) => {
        const latestOrder = orders
          .filter((order) => order.part_number === part.part_number)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

        const price = priceBook.find((item) => item.part_number === part.part_number);
        const cost = Number(price?.cost || latestOrder?.cost || 0);
        const retail = Number(price?.retail_price || latestOrder?.net || 0);
        const qty = Number(part.quantity || 0);

        return {
          ...part,
          cost,
          retail,
          costValue: qty * cost,
          retailValue: qty * retail,
          potentialProfit: qty * (retail - cost)
        };
      }),
    [parts, orders, priceBook]
  );

  const totals = useMemo(
    () => ({
      qty: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      costValue: rows.reduce((sum, row) => sum + row.costValue, 0),
      retailValue: rows.reduce((sum, row) => sum + row.retailValue, 0),
      profit: rows.reduce((sum, row) => sum + row.potentialProfit, 0)
    }),
    [rows]
  );

  const exportCsv = () => {
    const csvRows = [
      ["Part #", "Description", "Qty", "Cost", "Retail", "Cost Value", "Retail Value", "Potential Profit"],
      ...rows.map((row) => [
        row.part_number || "",
        row.name || "",
        row.quantity || 0,
        row.cost.toFixed(2),
        row.retail.toFixed(2),
        row.costValue.toFixed(2),
        row.retailValue.toFixed(2),
        row.potentialProfit.toFixed(2)
      ])
    ];

    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Inventory Valuation</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Items" value={rows.length} />
        <StatCard title="Units" value={totals.qty} />
        <StatCard title="Cost Value" value={`$${totals.costValue.toFixed(2)}`} />
        <StatCard title="Retail Value" value={`$${totals.retailValue.toFixed(2)}`} />
        <StatCard title="Potential Profit" value={`$${totals.profit.toFixed(2)}`} />
      </div>

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>Refresh</button>{" "}
      <button type="button" onClick={exportCsv} style={{ marginBottom: 12 }}>Export CSV</button>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Cost</th>
            <th>Retail</th>
            <th>Cost Value</th>
            <th>Retail Value</th>
            <th>Potential Profit</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.part_number || "-"}</td>
              <td>{row.name || "-"}</td>
              <td>{row.quantity || 0}</td>
              <td>${row.cost.toFixed(2)}</td>
              <td>${row.retail.toFixed(2)}</td>
              <td>${row.costValue.toFixed(2)}</td>
              <td>${row.retailValue.toFixed(2)}</td>
              <td>${row.potentialProfit.toFixed(2)}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No inventory found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default InventoryValuationManager;
