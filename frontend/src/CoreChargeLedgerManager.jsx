import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Outstanding", "Returned", "Credited", "Denied", "Written Off"];

function CoreChargeLedgerManager({ user, canEditEverything }) {
  const [orders, setOrders] = useState([]);
  const [cores, setCores] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    order_id: "",
    part_number: "",
    description: "",
    customer_name: "",
    document_number: "",
    core_charge: "",
    status: "Outstanding",
    due_date: "",
    returned_date: "",
    credited_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [ordersResult, coresResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "core_charge_ledger_json").maybeSingle()
    ]);

    if (ordersResult.error) {
      setMessage(ordersResult.error.message);
      return;
    }

    setOrders(ordersResult.data || []);

    try {
      const parsed = JSON.parse(coresResult.data?.setting_value || "[]");
      setCores(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCores([]);
    }
  };

  const saveCores = async (nextCores) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "core_charge_ledger_json",
        setting_value: JSON.stringify(nextCores, null, 2),
        description: "Parts core charge ledger records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setCores(nextCores);
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
          next.document_number = order.repair_order_number || "";
        }
      }

      return next;
    });
  };

  const addCore = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add core charges.");
      return;
    }

    if (!form.part_number || !form.core_charge) {
      setMessage("Part number and core charge are required.");
      return;
    }

    const core = {
      id: `core_${Date.now()}`,
      ...form,
      core_charge: Number(form.core_charge || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveCores([core, ...cores]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Core Charge Created",
      table_name: "app_settings",
      record_id: core.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${core.part_number} core $${core.core_charge.toFixed(2)}`
    });

    setMessage("Core charge saved.");
    setForm({
      order_id: "",
      part_number: "",
      description: "",
      customer_name: "",
      document_number: "",
      core_charge: "",
      status: "Outstanding",
      due_date: "",
      returned_date: "",
      credited_date: "",
      notes: ""
    });
  };

  const updateCore = async (id, updates) => {
    const next = cores.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveCores(next);
    if (saved) setMessage("Core charge updated.");
  };

  const totals = useMemo(
    () => ({
      outstanding: cores.filter((item) => item.status === "Outstanding").reduce((sum, item) => sum + Number(item.core_charge || 0), 0),
      credited: cores.filter((item) => item.status === "Credited").reduce((sum, item) => sum + Number(item.core_charge || 0), 0),
      count: cores.length
    }),
    [cores]
  );

  return (
    <div>
      <h2>Core Charge Ledger</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Core Records" value={totals.count} />
        <StatCard title="Outstanding" value={`$${totals.outstanding.toFixed(2)}`} />
        <StatCard title="Credited" value={`$${totals.credited.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Core Charge</h3>

        <div style={gridStyle}>
          <label>
            Related Order
            <select value={form.order_id} onChange={(e) => updateForm("order_id", e.target.value)} style={inputStyle}>
              <option value="">Manual entry</option>
              {orders.slice(0, 300).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.part_number} - {order.part_description_seller} - RO {order.repair_order_number || "-"}
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
            Customer
            <input value={form.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Document #
            <input value={form.document_number} onChange={(e) => updateForm("document_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Core Charge
            <input type="number" value={form.core_charge} onChange={(e) => updateForm("core_charge", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Due Date
            <input type="date" value={form.due_date} onChange={(e) => updateForm("due_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Returned Date
            <input type="date" value={form.returned_date} onChange={(e) => updateForm("returned_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Credited Date
            <input type="date" value={form.credited_date} onChange={(e) => updateForm("credited_date", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addCore} disabled={!canEditEverything}>Save Core Charge</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Part</th>
            <th>Customer / Doc</th>
            <th>Core Charge</th>
            <th>Due</th>
            <th>Returned</th>
            <th>Credited</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {cores.map((core) => (
            <tr key={core.id}>
              <td>
                <select value={core.status} onChange={(e) => updateCore(core.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{core.part_number}<br /><small>{core.description}</small></td>
              <td>{core.customer_name || "-"}<br /><small>{core.document_number || ""}</small></td>
              <td>${Number(core.core_charge || 0).toFixed(2)}</td>
              <td>{core.due_date || "-"}</td>
              <td>{core.returned_date || "-"}</td>
              <td>{core.credited_date || "-"}</td>
              <td>{core.notes || "-"}</td>
            </tr>
          ))}

          {cores.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No core charges.</td></tr>}
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

export default CoreChargeLedgerManager;
