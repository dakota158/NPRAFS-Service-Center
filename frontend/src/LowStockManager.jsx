import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function LowStockManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");
  const [threshold, setThreshold] = useState("1");
  const [defaultOrderQty, setDefaultOrderQty] = useState("1");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, suppliersResult] = await Promise.all([
      supabase.from("parts").select("*").order("quantity", { ascending: true }),
      supabase.from("suppliers").select("*").order("name", { ascending: true })
    ]);

    if (partsResult.error) {
      setMessage(partsResult.error.message);
      return;
    }

    setParts(partsResult.data || []);
    setSuppliers(suppliersResult.data || []);
  };

  const lowStockParts = useMemo(() => {
    const min = Number(threshold || 0);

    return parts.filter((part) => Number(part.quantity || 0) <= min);
  }, [parts, threshold]);

  const createOrderForPart = async (part) => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin, IT, and allowed managers can create purchase orders.");
      return;
    }

    const quantity = Number(defaultOrderQty || 1);

    const { data, error } = await supabase
      .from("orders")
      .insert({
        part_number: part.part_number || "",
        part_description_seller: part.name || "Stock Part",
        quantity,
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
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Low Stock Order Created",
      table_name: "orders",
      record_id: data.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created low stock order for ${part.part_number || part.name}`
    });

    setMessage("Purchase/order request created.");
    loadAll();
  };

  return (
    <div>
      <h2>Low Stock</h2>

      {message && (
        <p style={{ color: message.includes("created") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Low Stock Rules</h3>

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
            Default Reorder Quantity
            <input
              type="number"
              value={defaultOrderQty}
              onChange={(e) => setDefaultOrderQty(e.target.value)}
              style={inputStyle}
            />
          </label>

          <div>
            <strong>{lowStockParts.length}</strong> low stock item(s)
          </div>
        </div>

        <button type="button" onClick={loadAll}>
          Refresh
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Qty</th>
            <th>RO #</th>
            <th>Date Received</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {lowStockParts.map((part) => (
            <tr key={part.id}>
              <td>{part.part_number || "-"}</td>
              <td>{part.name || "-"}</td>
              <td>
                <strong style={{ color: Number(part.quantity || 0) <= 0 ? "red" : "#b45309" }}>
                  {part.quantity}
                </strong>
              </td>
              <td>{part.repair_order_number || "-"}</td>
              <td>
                {part.date_received
                  ? new Date(part.date_received).toLocaleDateString()
                  : "-"}
              </td>
              <td>
                <button type="button" onClick={() => createOrderForPart(part)}>
                  Create Order Request
                </button>
              </td>
            </tr>
          ))}

          {lowStockParts.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No low stock parts at this threshold.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {suppliers.length > 0 && (
        <p style={{ marginTop: 12 }}>
          Supplier records available: <strong>{suppliers.length}</strong>
        </p>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
  alignItems: "end"
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default LowStockManager;
