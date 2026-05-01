import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Open", "Submitted", "Approved", "Denied", "Credited", "Replacement Received", "Closed"];

function PartsWarrantyReturnManager({ user }) {
  const [orders, setOrders] = useState([]);
  const [claims, setClaims] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    order_id: "",
    part_number: "",
    description: "",
    quantity: "1",
    vendor: "",
    status: "Open",
    claim_number: "",
    failure_reason: "",
    credit_expected: "",
    submitted_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [ordersResult, settingsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_warranty_returns_json").maybeSingle()
    ]);

    if (ordersResult.error) {
      setMessage(ordersResult.error.message);
      return;
    }

    setOrders(ordersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setClaims(Array.isArray(parsed) ? parsed : []);
    } catch {
      setClaims([]);
    }
  };

  const saveClaims = async (nextClaims) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "parts_warranty_returns_json",
        setting_value: JSON.stringify(nextClaims, null, 2),
        description: "Parts warranty return tracking records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setClaims(nextClaims);
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

  const addClaim = async () => {
    setMessage("");

    if (!form.part_number || !form.failure_reason) {
      setMessage("Part number and failure reason are required.");
      return;
    }

    const claim = {
      id: `part_warranty_${Date.now()}`,
      ...form,
      quantity: Number(form.quantity || 1),
      credit_expected: Number(form.credit_expected || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveClaims([claim, ...claims]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Parts Warranty Return Created",
      table_name: "app_settings",
      record_id: claim.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${claim.part_number} ${claim.status}`
    });

    setMessage("Parts warranty return saved.");
    setForm({
      order_id: "",
      part_number: "",
      description: "",
      quantity: "1",
      vendor: "",
      status: "Open",
      claim_number: "",
      failure_reason: "",
      credit_expected: "",
      submitted_date: "",
      notes: ""
    });
  };

  const updateClaim = async (id, updates) => {
    const next = claims.map((claim) =>
      claim.id === id ? { ...claim, ...updates, updated_at: new Date().toISOString() } : claim
    );

    const saved = await saveClaims(next);
    if (saved) setMessage("Warranty return updated.");
  };

  const openCredit = useMemo(
    () =>
      claims
        .filter((claim) => !["Credited", "Denied", "Closed"].includes(claim.status))
        .reduce((sum, claim) => sum + Number(claim.credit_expected || 0), 0),
    [claims]
  );

  return (
    <div>
      <h2>Parts Warranty Returns</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Claims" value={claims.length} />
        <StatCard title="Open Credit" value={`$${openCredit.toFixed(2)}`} />
        <StatCard title="Submitted" value={claims.filter((claim) => claim.status === "Submitted").length} />
        <StatCard title="Credited" value={claims.filter((claim) => claim.status === "Credited").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Parts Warranty Return</h3>

        <div style={gridStyle}>
          <label>
            Original Order
            <select value={form.order_id} onChange={(e) => updateForm("order_id", e.target.value)} style={inputStyle}>
              <option value="">Manual entry</option>
              {orders.slice(0, 300).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.part_number} - {order.part_description_seller}
                </option>
              ))}
            </select>
          </label>

          <label>
            Part #
            <input value={form.part_number} onChange={(e) => updateForm("part_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Description
            <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Quantity
            <input type="number" value={form.quantity} onChange={(e) => updateForm("quantity", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Vendor
            <input value={form.vendor} onChange={(e) => updateForm("vendor", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Claim #
            <input value={form.claim_number} onChange={(e) => updateForm("claim_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Credit Expected
            <input type="number" value={form.credit_expected} onChange={(e) => updateForm("credit_expected", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Submitted Date
            <input type="date" value={form.submitted_date} onChange={(e) => updateForm("submitted_date", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Failure Reason
          <textarea value={form.failure_reason} onChange={(e) => updateForm("failure_reason", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addClaim}>Save Parts Warranty Return</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Claim</th>
            <th>Part</th>
            <th>Qty</th>
            <th>Vendor</th>
            <th>Credit</th>
            <th>Failure</th>
          </tr>
        </thead>

        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td>
                <select value={claim.status} onChange={(e) => updateClaim(claim.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{claim.claim_number || claim.id}</td>
              <td>{claim.part_number}<br /><small>{claim.description}</small></td>
              <td>{claim.quantity}</td>
              <td>{claim.vendor || "-"}</td>
              <td>${Number(claim.credit_expected || 0).toFixed(2)}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{claim.failure_reason}</td>
            </tr>
          ))}

          {claims.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No warranty returns.</td></tr>}
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PartsWarrantyReturnManager;
