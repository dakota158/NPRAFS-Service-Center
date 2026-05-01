import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Unmatched", "Matched", "Price Variance", "Qty Variance", "Approved", "Disputed", "Paid"];

function VendorInvoiceMatchingManager({ user, canEditEverything }) {
  const [orders, setOrders] = useState([]);
  const [matches, setMatches] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    order_id: "",
    vendor_invoice_number: "",
    vendor_name: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    billed_qty: "",
    billed_cost: "",
    tax: "",
    freight: "",
    status: "Unmatched",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [ordersResult, matchesResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "vendor_invoice_matching_json").maybeSingle()
    ]);

    if (ordersResult.error) {
      setMessage(ordersResult.error.message);
      return;
    }

    setOrders(ordersResult.data || []);

    try {
      const parsed = JSON.parse(matchesResult.data?.setting_value || "[]");
      setMatches(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMatches([]);
    }
  };

  const saveMatches = async (nextMatches) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "vendor_invoice_matching_json",
        setting_value: JSON.stringify(nextMatches, null, 2),
        description: "Vendor invoice matching records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setMatches(nextMatches);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "order_id") {
        const order = orders.find((item) => item.id === value);
        if (order) {
          next.billed_qty = String(order.quantity || "");
          next.billed_cost = String(order.cost || "");
        }
      }

      return next;
    });
  };

  const addMatch = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add vendor invoice matches.");
      return;
    }

    if (!form.order_id || !form.vendor_invoice_number) {
      setMessage("Order and vendor invoice number are required.");
      return;
    }

    const order = orders.find((item) => item.id === form.order_id);
    const orderedQty = Number(order?.quantity || 0);
    const orderedCost = Number(order?.cost || 0);
    const billedQty = Number(form.billed_qty || 0);
    const billedCost = Number(form.billed_cost || 0);
    const qtyVariance = billedQty - orderedQty;
    const costVariance = billedCost - orderedCost;

    let autoStatus = form.status;
    if (qtyVariance !== 0) autoStatus = "Qty Variance";
    else if (Math.abs(costVariance) > 0.01) autoStatus = "Price Variance";
    else if (form.status === "Unmatched") autoStatus = "Matched";

    const record = {
      id: `vendor_match_${Date.now()}`,
      ...form,
      status: autoStatus,
      ordered_qty: orderedQty,
      ordered_cost: orderedCost,
      billed_qty: billedQty,
      billed_cost: billedCost,
      tax: Number(form.tax || 0),
      freight: Number(form.freight || 0),
      qty_variance: qtyVariance,
      cost_variance: costVariance,
      part_number: order?.part_number || "",
      description: order?.part_description_seller || "",
      repair_order_number: order?.repair_order_number || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveMatches([record, ...matches]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Vendor Invoice Match Created",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${record.vendor_invoice_number} ${record.status}`
    });

    setMessage("Vendor invoice match saved.");
    setForm({
      order_id: "",
      vendor_invoice_number: "",
      vendor_name: "",
      invoice_date: new Date().toISOString().slice(0, 10),
      billed_qty: "",
      billed_cost: "",
      tax: "",
      freight: "",
      status: "Unmatched",
      notes: ""
    });
  };

  const updateMatch = async (id, updates) => {
    const next = matches.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveMatches(next);
    if (saved) setMessage("Vendor invoice match updated.");
  };

  const totals = useMemo(
    () => ({
      count: matches.length,
      variances: matches.filter((item) => ["Price Variance", "Qty Variance", "Disputed"].includes(item.status)).length,
      billed: matches.reduce((sum, item) => sum + Number(item.billed_qty || 0) * Number(item.billed_cost || 0) + Number(item.tax || 0) + Number(item.freight || 0), 0)
    }),
    [matches]
  );

  return (
    <div>
      <h2>Vendor Invoice Matching</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Matches" value={totals.count} />
        <StatCard title="Variances" value={totals.variances} />
        <StatCard title="Billed Total" value={`$${totals.billed.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Vendor Invoice Match</h3>

        <div style={gridStyle}>
          <label>
            Order
            <select value={form.order_id} onChange={(e) => updateForm("order_id", e.target.value)} style={inputStyle}>
              <option value="">Select order</option>
              {orders.slice(0, 300).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.part_number} - {order.part_description_seller} - Qty {order.quantity}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vendor Invoice #
            <input value={form.vendor_invoice_number} onChange={(e) => updateForm("vendor_invoice_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Vendor
            <input value={form.vendor_name} onChange={(e) => updateForm("vendor_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Invoice Date
            <input type="date" value={form.invoice_date} onChange={(e) => updateForm("invoice_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Billed Qty
            <input type="number" value={form.billed_qty} onChange={(e) => updateForm("billed_qty", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Billed Cost Each
            <input type="number" value={form.billed_cost} onChange={(e) => updateForm("billed_cost", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Tax
            <input type="number" value={form.tax} onChange={(e) => updateForm("tax", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Freight
            <input type="number" value={form.freight} onChange={(e) => updateForm("freight", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addMatch} disabled={!canEditEverything}>Save Match</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Invoice</th>
            <th>Part</th>
            <th>Ordered</th>
            <th>Billed</th>
            <th>Variance</th>
            <th>Total</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {matches.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateMatch(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.vendor_invoice_number}<br /><small>{item.vendor_name || ""}</small></td>
              <td>{item.part_number}<br /><small>{item.description}</small></td>
              <td>Qty {item.ordered_qty}<br />${Number(item.ordered_cost || 0).toFixed(2)}</td>
              <td>Qty {item.billed_qty}<br />${Number(item.billed_cost || 0).toFixed(2)}</td>
              <td>Qty {Number(item.qty_variance || 0)}<br />Cost ${Number(item.cost_variance || 0).toFixed(2)}</td>
              <td>${(Number(item.billed_qty || 0) * Number(item.billed_cost || 0) + Number(item.tax || 0) + Number(item.freight || 0)).toFixed(2)}</td>
              <td>{item.notes || "-"}</td>
            </tr>
          ))}

          {matches.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No vendor invoice matches.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default VendorInvoiceMatchingManager;
