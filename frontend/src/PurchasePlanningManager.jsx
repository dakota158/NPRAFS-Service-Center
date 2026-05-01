import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PurchasePlanningManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [targetQty, setTargetQty] = useState("5");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, ordersResult, suppliersResult] = await Promise.all([
      supabase.from("parts").select("*").order("quantity", { ascending: true }),
      supabase.from("orders").select("*").eq("received", false),
      supabase.from("suppliers").select("*").order("name", { ascending: true })
    ]);

    if (partsResult.error || ordersResult.error) {
      setMessage(partsResult.error?.message || ordersResult.error?.message);
      return;
    }

    setParts(partsResult.data || []);
    setOrders(ordersResult.data || []);
    setSuppliers(suppliersResult.data || []);
  };

  const plannedRows = useMemo(() => {
    const min = Number(threshold || 0);
    const target = Number(targetQty || 0);

    return parts
      .filter((part) => Number(part.quantity || 0) <= min)
      .map((part) => {
        const openOrderQty = orders
          .filter((order) => order.part_number === part.part_number)
          .reduce((sum, order) => sum + Number(order.quantity || 0), 0);

        const recommendedQty = Math.max(
          0,
          target - Number(part.quantity || 0) - openOrderQty
        );

        return {
          ...part,
          openOrderQty,
          recommendedQty
        };
      });
  }, [parts, orders, threshold, targetQty]);

  const createRecommendedOrders = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT/authorized managers can create order requests.");
      return;
    }

    const rowsToOrder = plannedRows.filter((row) => row.recommendedQty > 0);

    if (rowsToOrder.length === 0) {
      setMessage("No recommended order quantities found.");
      return;
    }

    const payload = rowsToOrder.map((part) => ({
      part_number: part.part_number || "",
      part_description_seller: part.name || "Stock Part",
      quantity: part.recommendedQty,
      cost: 0,
      net: 0,
      profit: 0,
      date_approved: new Date().toISOString().slice(0, 10),
      repair_order_number: part.repair_order_number || "STOCK",
      part_ordered: false,
      ordered_by: "",
      date_ordered: null,
      received: false,
      tested_good: false,
      tested_by: "",
      received_date: null,
      supplier_id: null,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_by_name: user?.username || user?.name || user?.email || ""
    }));

    const { error } = await supabase.from("orders").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Purchase Plan Orders Created",
      table_name: "orders",
      record_id: "bulk",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created ${payload.length} recommended purchase order requests`
    });

    setMessage(`${payload.length} order request(s) created.`);
    loadAll();
  };

  return (
    <div>
      <h2>Purchase Planning</h2>

      {message && (
        <p style={{ color: message.includes("created") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Planning Rules</h3>

        <div style={gridStyle}>
          <label>
            Low Stock Threshold
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Target Quantity
            <input
              type="number"
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
              style={inputStyle}
            />
          </label>

          <div>
            <strong>{plannedRows.length}</strong> part(s) need review
          </div>

          <div>
            <strong>{suppliers.length}</strong> supplier(s) on file
          </div>
        </div>

        <button type="button" onClick={createRecommendedOrders}>
          Create Recommended Order Requests
        </button>{" "}
        <button type="button" onClick={loadAll}>
          Refresh
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Current Qty</th>
            <th>Open Order Qty</th>
            <th>Recommended Qty</th>
            <th>RO #</th>
          </tr>
        </thead>

        <tbody>
          {plannedRows.map((part) => (
            <tr key={part.id}>
              <td>{part.part_number || "-"}</td>
              <td>{part.name || "-"}</td>
              <td>{part.quantity}</td>
              <td>{part.openOrderQty}</td>
              <td>
                <strong>{part.recommendedQty}</strong>
              </td>
              <td>{part.repair_order_number || "-"}</td>
            </tr>
          ))}

          {plannedRows.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No parts need ordering at this threshold.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default PurchasePlanningManager;
