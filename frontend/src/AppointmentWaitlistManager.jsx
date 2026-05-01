import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Waiting", "Contacted", "Scheduled", "Cancelled"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

function AppointmentWaitlistManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    customer_name: "",
    phone: "",
    email: "",
    vehicle: "",
    requested_service: "",
    preferred_date: "",
    preferred_time: "",
    priority: "Normal",
    status: "Waiting",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "appointment_waitlist_json").maybeSingle()
    ]);

    if (customersResult.error) {
      setMessage(customersResult.error.message);
      return;
    }

    setCustomers(customersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setWaitlist(Array.isArray(parsed) ? parsed : []);
    } catch {
      setWaitlist([]);
    }
  };

  const saveWaitlist = async (nextWaitlist) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "appointment_waitlist_json",
        setting_value: JSON.stringify(nextWaitlist, null, 2),
        description: "Appointment waitlist records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setWaitlist(nextWaitlist);
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
          next.email = customer.email || "";
        }
      }

      return next;
    });
  };

  const addWaitlistItem = async () => {
    setMessage("");

    if (!form.customer_name || !form.requested_service) {
      setMessage("Customer name and requested service are required.");
      return;
    }

    const item = {
      id: `waitlist_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveWaitlist([item, ...waitlist]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Appointment Waitlist Created",
      table_name: "app_settings",
      record_id: item.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${item.customer_name} - ${item.requested_service}`
    });

    setMessage("Waitlist entry saved.");
    setForm({
      customer_id: "",
      customer_name: "",
      phone: "",
      email: "",
      vehicle: "",
      requested_service: "",
      preferred_date: "",
      preferred_time: "",
      priority: "Normal",
      status: "Waiting",
      notes: ""
    });
  };

  const updateItem = async (id, updates) => {
    const next = waitlist.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveWaitlist(next);
    if (saved) setMessage("Waitlist updated.");
  };

  const copyScheduleMessage = async (item) => {
    const text = `Hello ${item.customer_name || ""},

We have an opening available for your requested service: ${item.requested_service || ""}.

Please contact us to confirm a time that works for you.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Schedule message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  const activeItems = useMemo(
    () => waitlist.filter((item) => !["Scheduled", "Cancelled"].includes(item.status)),
    [waitlist]
  );

  return (
    <div>
      <h2>Appointment Waitlist</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Active Waitlist" value={activeItems.length} />
        <StatCard title="Urgent" value={waitlist.filter((item) => item.priority === "Urgent").length} />
        <StatCard title="Scheduled" value={waitlist.filter((item) => item.status === "Scheduled").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Waitlist Entry</h3>

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
            Email
            <input value={form.email} onChange={(e) => updateForm("email", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Vehicle
            <input value={form.vehicle} onChange={(e) => updateForm("vehicle", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Preferred Date
            <input type="date" value={form.preferred_date} onChange={(e) => updateForm("preferred_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Preferred Time
            <input type="time" value={form.preferred_time} onChange={(e) => updateForm("preferred_time", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)} style={inputStyle}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
        </div>

        <label>
          Requested Service
          <textarea value={form.requested_service} onChange={(e) => updateForm("requested_service", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addWaitlistItem}>Save Waitlist Entry</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Priority</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Requested Service</th>
            <th>Preferred</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {waitlist.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateItem(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.priority}</td>
              <td>{item.customer_name}<br /><small>{item.phone || item.email || ""}</small></td>
              <td>{item.vehicle || "-"}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{item.requested_service}</td>
              <td>{item.preferred_date || "-"} {item.preferred_time || ""}</td>
              <td><button type="button" onClick={() => copyScheduleMessage(item)}>Copy Message</button></td>
            </tr>
          ))}

          {waitlist.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No waitlist entries.</td></tr>}
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

export default AppointmentWaitlistManager;
