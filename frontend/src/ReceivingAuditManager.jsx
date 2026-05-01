import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function ReceivingAuditManager({ user, canEditEverything }) {
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [parts, setParts] = useState([]);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [ordersResult, historyResult, partsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("history").select("*").order("used_date", { ascending: false }),
      supabase.from("parts").select("*")
    ]);

    if (ordersResult.error || historyResult.error || partsResult.error) {
      setMessage(ordersResult.error?.message || historyResult.error?.message || partsResult.error?.message);
      return;
    }

    setOrders(ordersResult.data || []);
    setHistory(historyResult.data || []);
    setParts(partsResult.data || []);
  };

  const markReceivedAndStock = async (order) => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only authorized users can receive parts.");
      return;
    }

    const receivedDate = new Date().toISOString();

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        received: true,
        received_date: receivedDate,
        tested_good: true,
        tested_by: user?.email || user?.username || "",
      })
      .eq("id", order.id);

    if (orderError) {
      setMessage(orderError.message);
      return;
    }

    const existingPart = parts.find((part) => part.part_number === order.part_number);

    if (existingPart) {
      const { error: updateError } = await supabase
        .from("parts")
        .update({
          quantity: Number(existingPart.quantity || 0) + Number(order.quantity || 0),
          date_received: receivedDate
        })
        .eq("id", existingPart.id);

      if (updateError) {
        setMessage(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("parts").insert({
        part_number: order.part_number || "",
        name: order.part_description_seller || "",
        quantity: Number(order.quantity || 0),
        repair_order_number: order.repair_order_number || "STOCK",
        date_received: receivedDate
      });

      if (insertError) {
        setMessage(insertError.message);
        return;
      }
    }

    await supabase.from("audit_logs").insert({
      action: "Order Received Into Stock",
      table_name: "orders",
      record_id: order.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Received ${order.quantity} of ${order.part_number}`
    });

    setMessage("Order received and stock updated.");
    loadAll();
  };

  const visibleOrders = useMemo(() => {
    if (filter === "open") return orders.filter((order) => !order.received);
    if (filter === "received") return orders.filter((order) => order.received);
    if (filter === "ordered") return orders.filter((order) => order.part_ordered && !order.received);
    return orders;
  }, [orders, filter]);

  const auditRows = useMemo(
    () =>
      visibleOrders.map((order) => {
        const stock = parts.find((part) => part.part_number === order.part_number);
        const used = history
          .filter((item) => item.part_number === order.part_number)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

        return {
          order,
          stockQty: stock?.quantity || 0,
          usedQty: used,
          expectedQty: Number(order.quantity || 0)
        };
      }),
    [visibleOrders, parts, history]
  );

  return (
    <div>
      <h2>Receiving Audit</h2>

      {message && <p style={{ color: message.includes("received") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open Orders" value={orders.filter((o) => !o.received).length} />
        <StatCard title="Ordered Not Received" value={orders.filter((o) => o.part_ordered && !o.received).length} />
        <StatCard title="Received" value={orders.filter((o) => o.received).length} />
        <StatCard title="Audit Rows" value={auditRows.length} />
      </div>

      <div style={panelStyle}>
        <label>
          Filter
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={inputStyle}>
            <option value="open">Open</option>
            <option value="ordered">Ordered Not Received</option>
            <option value="received">Received</option>
            <option value="all">All</option>
          </select>
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>RO</th>
            <th>Ordered Qty</th>
            <th>Stock Qty</th>
            <th>Used Qty</th>
            <th>Status</th>
            <th>Received</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {auditRows.map(({ order, stockQty, usedQty }) => (
            <tr key={order.id}>
              <td>{order.part_number || "-"}</td>
              <td>{order.part_description_seller || "-"}</td>
              <td>{order.repair_order_number || "-"}</td>
              <td>{order.quantity || 0}</td>
              <td>{stockQty}</td>
              <td>{usedQty}</td>
              <td>{order.received ? "Received" : order.part_ordered ? "Ordered" : "Pending Order"}</td>
              <td>{order.received_date ? new Date(order.received_date).toLocaleDateString() : "-"}</td>
              <td>
                {!order.received && (
                  <button type="button" onClick={() => markReceivedAndStock(order)}>
                    Receive + Stock
                  </button>
                )}
              </td>
            </tr>
          ))}
          {auditRows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No orders found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 260, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default ReceivingAuditManager;
