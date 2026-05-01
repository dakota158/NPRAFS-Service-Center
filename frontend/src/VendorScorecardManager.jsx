import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function VendorScorecardManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [returns, setReturns] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [suppliersResult, ordersResult, quotesResult, returnsResult] = await Promise.all([
      supabase.from("suppliers").select("*").order("name", { ascending: true }),
      supabase.from("orders").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "supplier_quotes_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_returns_json").maybeSingle()
    ]);

    if (suppliersResult.error || ordersResult.error) {
      setMessage(suppliersResult.error?.message || ordersResult.error?.message);
      return;
    }

    setSuppliers(suppliersResult.data || []);
    setOrders(ordersResult.data || []);

    try {
      setQuotes(JSON.parse(quotesResult.data?.setting_value || "[]"));
    } catch {
      setQuotes([]);
    }

    try {
      setReturns(JSON.parse(returnsResult.data?.setting_value || "[]"));
    } catch {
      setReturns([]);
    }
  };

  const rows = useMemo(() => {
    const supplierNames = new Set([
      ...suppliers.map((s) => s.name).filter(Boolean),
      ...quotes.map((q) => q.supplier_name).filter(Boolean)
    ]);

    return Array.from(supplierNames).map((name) => {
      const supplier = suppliers.find((s) => s.name === name);
      const supplierOrders = orders.filter((order) => {
        if (supplier?.id && order.supplier_id === supplier.id) return true;
        return false;
      });
      const supplierQuotes = quotes.filter((quote) => quote.supplier_name === name);
      const selectedQuotes = supplierQuotes.filter((quote) => quote.selected);
      const supplierReturns = returns.filter((item) => item.notes?.includes(name) || item.supplier_name === name);

      const received = supplierOrders.filter((order) => order.received).length;
      const ordered = supplierOrders.length;
      const fillRate = ordered ? Math.round((received / ordered) * 100) : 0;
      const quoteWinRate = supplierQuotes.length ? Math.round((selectedQuotes.length / supplierQuotes.length) * 100) : 0;

      const spend = supplierOrders.reduce(
        (sum, order) => sum + Number(order.cost || 0) * Number(order.quantity || 0),
        0
      );

      return {
        name,
        contact: supplier?.contact || supplier?.phone || supplier?.email || "",
        ordered,
        received,
        fillRate,
        quoteCount: supplierQuotes.length,
        quoteWinRate,
        returns: supplierReturns.length,
        spend
      };
    }).sort((a, b) => b.spend - a.spend);
  }, [suppliers, orders, quotes, returns]);

  const exportCsv = () => {
    const csvRows = [
      ["Vendor", "Contact", "Orders", "Received", "Fill Rate", "Quotes", "Quote Win Rate", "Returns", "Spend"],
      ...rows.map((row) => [
        row.name,
        row.contact,
        row.ordered,
        row.received,
        `${row.fillRate}%`,
        row.quoteCount,
        `${row.quoteWinRate}%`,
        row.returns,
        row.spend.toFixed(2)
      ])
    ];

    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `vendor-scorecards-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Vendor Scorecards</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Vendors" value={rows.length} />
        <StatCard title="Orders" value={rows.reduce((sum, row) => sum + row.ordered, 0)} />
        <StatCard title="Spend" value={`$${rows.reduce((sum, row) => sum + row.spend, 0).toFixed(2)}`} />
      </div>

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>Refresh</button>{" "}
      <button type="button" onClick={exportCsv} style={{ marginBottom: 12 }}>Export CSV</button>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Contact</th>
            <th>Orders</th>
            <th>Received</th>
            <th>Fill Rate</th>
            <th>Quotes</th>
            <th>Quote Win Rate</th>
            <th>Returns</th>
            <th>Spend</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td><strong>{row.name}</strong></td>
              <td>{row.contact || "-"}</td>
              <td>{row.ordered}</td>
              <td>{row.received}</td>
              <td>{row.fillRate}%</td>
              <td>{row.quoteCount}</td>
              <td>{row.quoteWinRate}%</td>
              <td>{row.returns}</td>
              <td>${row.spend.toFixed(2)}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No vendor data.</td></tr>}
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

export default VendorScorecardManager;
