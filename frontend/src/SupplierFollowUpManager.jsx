import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const FOLLOW_STATUSES = ["Need Follow-Up", "Called", "ETA Confirmed", "Backordered", "Cancelled", "Received"];

function SupplierFollowUpManager({ user }) {
  const [orders, setOrders] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    order_id: "",
    status: "Need Follow-Up",
    follow_up_date: new Date().toISOString().slice(0, 10),
    contact_name: "",
    eta: "",
    note: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [ordersResult, settingsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "supplier_followups_json").maybeSingle()
    ]);

    if (ordersResult.error) {
      setMessage(ordersResult.error.message);
      return;
    }

    setOrders(ordersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setFollowUps(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFollowUps([]);
    }
  };

  const saveFollowUps = async (nextFollowUps) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "supplier_followups_json",
        setting_value: JSON.stringify(nextFollowUps, null, 2),
        description: "Supplier order follow-up records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setFollowUps(nextFollowUps);
    return true;
  };

  const addFollowUp = async () => {
    setMessage("");

    if (!form.order_id || !form.note) {
      setMessage("Order and note are required.");
      return;
    }

    const order = orders.find((item) => item.id === form.order_id);

    const followUp = {
      id: `supplier_follow_${Date.now()}`,
      ...form,
      part_number: order?.part_number || "",
      description: order?.part_description_seller || "",
      repair_order_number: order?.repair_order_number || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveFollowUps([followUp, ...followUps]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Supplier Follow-Up Created",
      table_name: "app_settings",
      record_id: followUp.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${followUp.part_number} - ${followUp.status}`
    });

    setMessage("Supplier follow-up saved.");
    setForm({
      order_id: "",
      status: "Need Follow-Up",
      follow_up_date: new Date().toISOString().slice(0, 10),
      contact_name: "",
      eta: "",
      note: ""
    });
  };

  const updateFollowUp = async (id, updates) => {
    const next = followUps.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveFollowUps(next);
    if (saved) setMessage("Follow-up updated.");
  };

  const openOrders = orders.filter((order) => !order.received);
  const dueFollowUps = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return followUps.filter((item) => item.follow_up_date && item.follow_up_date <= today && item.status !== "Received");
  }, [followUps]);

  return (
    <div>
      <h2>Supplier Order Follow-Ups</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open Orders" value={openOrders.length} />
        <StatCard title="Follow-Ups" value={followUps.length} />
        <StatCard title="Due" value={dueFollowUps.length} />
        <StatCard title="Backordered" value={followUps.filter((item) => item.status === "Backordered").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Supplier Follow-Up</h3>

        <div style={gridStyle}>
          <label>
            Order
            <select value={form.order_id} onChange={(e) => setForm((p) => ({ ...p, order_id: e.target.value }))} style={inputStyle}>
              <option value="">Select order</option>
              {openOrders.slice(0, 300).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.part_number} - {order.part_description_seller} - RO {order.repair_order_number || "-"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {FOLLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Follow-Up Date
            <input type="date" value={form.follow_up_date} onChange={(e) => setForm((p) => ({ ...p, follow_up_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Contact Name
            <input value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            ETA
            <input value={form.eta} onChange={(e) => setForm((p) => ({ ...p, eta: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Note
          <textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addFollowUp}>Save Follow-Up</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Part</th>
            <th>RO</th>
            <th>Follow Up</th>
            <th>ETA</th>
            <th>Contact</th>
            <th>Note</th>
          </tr>
        </thead>

        <tbody>
          {followUps.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateFollowUp(item.id, { status: e.target.value })} style={inputStyle}>
                  {FOLLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.part_number}<br /><small>{item.description}</small></td>
              <td>{item.repair_order_number || "-"}</td>
              <td>{item.follow_up_date || "-"}</td>
              <td>{item.eta || "-"}</td>
              <td>{item.contact_name || "-"}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{item.note}</td>
            </tr>
          ))}

          {followUps.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No supplier follow-ups.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default SupplierFollowUpManager;
