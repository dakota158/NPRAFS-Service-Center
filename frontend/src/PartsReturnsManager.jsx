import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const RETURN_STATUSES = ["Pending", "Returned", "Credited", "Denied", "Core Sent", "Core Credited"];

function PartsReturnsManager({ user }) {
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    order_id: "",
    part_number: "",
    description: "",
    quantity: "1",
    reason: "",
    return_type: "Return",
    status: "Pending",
    credit_expected: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [ordersResult, settingsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_returns_json").maybeSingle()
    ]);

    if (ordersResult.error) {
      setMessage(ordersResult.error.message);
      return;
    }

    setOrders(ordersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setReturns(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReturns([]);
    }
  };

  const saveReturns = async (nextReturns) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "parts_returns_json",
        setting_value: JSON.stringify(nextReturns, null, 2),
        description: "Parts returns and core tracking",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setReturns(nextReturns);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "order_id") {
        const order = orders.find((item) => item.id === value);
        if (order) {
          next.part_number = order.part_number || "";
          next.description = order.part_description_seller || "";
          next.quantity = String(order.quantity || 1);
          next.credit_expected = String(Number(order.cost || 0) * Number(order.quantity || 1));
        }
      }

      return next;
    });
  };

  const createReturn = async () => {
    setMessage("");

    if (!form.part_number && !form.description) {
      setMessage("Part number or description is required.");
      return;
    }

    const item = {
      id: `return_${Date.now()}`,
      ...form,
      quantity: Number(form.quantity || 1),
      credit_expected: Number(form.credit_expected || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveReturns([item, ...returns]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Parts Return Created",
      table_name: "app_settings",
      record_id: item.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Parts return/core created for ${item.part_number}`
    });

    setMessage("Return/core record saved.");
    setForm({
      order_id: "",
      part_number: "",
      description: "",
      quantity: "1",
      reason: "",
      return_type: "Return",
      status: "Pending",
      credit_expected: "",
      notes: ""
    });
  };

  const updateReturn = async (id, updates) => {
    const next = returns.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveReturns(next);
    if (saved) setMessage("Return updated.");
  };

  const pendingCredit = useMemo(
    () =>
      returns
        .filter((item) => !["Credited", "Denied", "Core Credited"].includes(item.status))
        .reduce((sum, item) => sum + Number(item.credit_expected || 0), 0),
    [returns]
  );

  return (
    <div>
      <h2>Parts Returns / Cores</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Records" value={returns.length} />
        <StatCard title="Pending" value={returns.filter((item) => item.status === "Pending").length} />
        <StatCard title="Pending Credit" value={`$${pendingCredit.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Create Return / Core Record</h3>

        <div style={gridStyle}>
          <label>
            Original Order
            <select value={form.order_id} onChange={(e) => updateForm("order_id", e.target.value)} style={inputStyle}>
              <option value="">No linked order</option>
              {orders.slice(0, 300).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.part_number} - {order.part_description_seller} - RO {order.repair_order_number || "-"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select value={form.return_type} onChange={(e) => updateForm("return_type", e.target.value)} style={inputStyle}>
              <option>Return</option>
              <option>Core</option>
              <option>Warranty</option>
            </select>
          </label>

          <label>
            Part #
            <input value={form.part_number} onChange={(e) => updateForm("part_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Quantity
            <input type="number" value={form.quantity} onChange={(e) => updateForm("quantity", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Credit Expected
            <input type="number" value={form.credit_expected} onChange={(e) => updateForm("credit_expected", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {RETURN_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Description
          <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={inputStyle} />
        </label>

        <label>
          Reason
          <textarea value={form.reason} onChange={(e) => updateForm("reason", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={createReturn}>Save Return/Core</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Type</th>
            <th>Part</th>
            <th>Qty</th>
            <th>Credit</th>
            <th>Reason</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateReturn(item.id, { status: e.target.value })} style={inputStyle}>
                  {RETURN_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.return_type}</td>
              <td><strong>{item.part_number}</strong><br /><small>{item.description}</small></td>
              <td>{item.quantity}</td>
              <td>${Number(item.credit_expected || 0).toFixed(2)}</td>
              <td>{item.reason || "-"}</td>
              <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
            </tr>
          ))}
          {returns.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No returns/cores.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 65, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PartsReturnsManager;
