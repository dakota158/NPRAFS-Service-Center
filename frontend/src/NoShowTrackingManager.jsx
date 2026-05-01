import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["No-Show", "Rescheduled", "Fee Charged", "Waived", "Cancelled"];
const REASONS = ["No Call", "Customer Forgot", "Weather", "Parts Delay", "Vehicle Sold", "Other"];

function NoShowTrackingManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [noShows, setNoShows] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    customer_name: "",
    phone: "",
    appointment_date: "",
    appointment_time: "",
    service_requested: "",
    reason: "No Call",
    status: "No-Show",
    fee_amount: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "no_show_tracking_json").maybeSingle()
    ]);

    if (customersResult.error) {
      setMessage(customersResult.error.message);
      return;
    }

    setCustomers(customersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setNoShows(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNoShows([]);
    }
  };

  const saveNoShows = async (nextNoShows) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "no_show_tracking_json",
        setting_value: JSON.stringify(nextNoShows, null, 2),
        description: "Customer appointment no-show records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setNoShows(nextNoShows);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "customer_id") {
        const customer = customers.find((item) => item.id === value);
        if (customer) {
          next.customer_name = customer.name || "";
          next.phone = customer.phone || "";
        }
      }
      return next;
    });
  };

  const addNoShow = async () => {
    setMessage("");

    if (!form.customer_name || !form.appointment_date) {
      setMessage("Customer and appointment date are required.");
      return;
    }

    const record = {
      id: `noshow_${Date.now()}`,
      ...form,
      fee_amount: Number(form.fee_amount || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveNoShows([record, ...noShows]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "No Show Recorded",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${record.customer_name} ${record.appointment_date}`
    });

    setMessage("No-show recorded.");
    setForm({
      customer_id: "",
      customer_name: "",
      phone: "",
      appointment_date: "",
      appointment_time: "",
      service_requested: "",
      reason: "No Call",
      status: "No-Show",
      fee_amount: "",
      notes: ""
    });
  };

  const updateNoShow = async (id, updates) => {
    const next = noShows.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveNoShows(next);
    if (saved) setMessage("No-show updated.");
  };

  const copyRescheduleMessage = async (record) => {
    const text = `Hello ${record.customer_name || ""},

We missed you for your appointment on ${record.appointment_date || ""} ${record.appointment_time || ""}.
Please contact us if you would like to reschedule.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Reschedule message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  const fees = useMemo(
    () => noShows.reduce((sum, item) => sum + Number(item.fee_amount || 0), 0),
    [noShows]
  );

  return (
    <div>
      <h2>No-Show Tracking</h2>

      {message && <p style={{ color: message.includes("recorded") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Records" value={noShows.length} />
        <StatCard title="No-Shows" value={noShows.filter((item) => item.status === "No-Show").length} />
        <StatCard title="Rescheduled" value={noShows.filter((item) => item.status === "Rescheduled").length} />
        <StatCard title="Fees" value={`$${fees.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add No-Show</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => updateForm("customer_id", e.target.value)} style={inputStyle}>
              <option value="">Manual customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label>
            Customer Name
            <input value={form.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Phone
            <input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Appointment Date
            <input type="date" value={form.appointment_date} onChange={(e) => updateForm("appointment_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Appointment Time
            <input type="time" value={form.appointment_time} onChange={(e) => updateForm("appointment_time", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Reason
            <select value={form.reason} onChange={(e) => updateForm("reason", e.target.value)} style={inputStyle}>
              {REASONS.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Fee Amount
            <input type="number" value={form.fee_amount} onChange={(e) => updateForm("fee_amount", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Service Requested
          <textarea value={form.service_requested} onChange={(e) => updateForm("service_requested", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addNoShow}>Save No-Show</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Customer</th>
            <th>Appointment</th>
            <th>Service</th>
            <th>Reason</th>
            <th>Fee</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {noShows.map((record) => (
            <tr key={record.id}>
              <td>
                <select value={record.status} onChange={(e) => updateNoShow(record.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{record.customer_name}<br /><small>{record.phone || ""}</small></td>
              <td>{record.appointment_date || "-"} {record.appointment_time || ""}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{record.service_requested || "-"}</td>
              <td>{record.reason}</td>
              <td>${Number(record.fee_amount || 0).toFixed(2)}</td>
              <td><button type="button" onClick={() => copyRescheduleMessage(record)}>Copy Message</button></td>
            </tr>
          ))}

          {noShows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No no-shows recorded.</td></tr>}
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

export default NoShowTrackingManager;
