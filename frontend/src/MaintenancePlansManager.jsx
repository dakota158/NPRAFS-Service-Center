import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PLAN_STATUSES = ["Active", "Paused", "Completed", "Cancelled"];

function MaintenancePlansManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    vehicle_id: "",
    plan_name: "",
    interval_miles: "5000",
    interval_months: "6",
    next_due_miles: "",
    next_due_date: "",
    services: "Oil change, tire rotation, inspection",
    status: "Active",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, vehiclesResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("customer_vehicles").select("*, customers(name, phone, email)").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "maintenance_plans_json").maybeSingle()
    ]);

    if (customersResult.error || vehiclesResult.error) {
      setMessage(customersResult.error?.message || vehiclesResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setVehicles(vehiclesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setPlans(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPlans([]);
    }
  };

  const savePlans = async (nextPlans) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "maintenance_plans_json",
        setting_value: JSON.stringify(nextPlans, null, 2),
        description: "Recurring vehicle maintenance plans",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setPlans(nextPlans);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "vehicle_id") {
        const vehicle = vehicles.find((item) => item.id === value);
        if (vehicle) {
          next.customer_id = vehicle.customer_id || next.customer_id;
          const mileage = Number(String(vehicle.mileage || "").replace(/[^0-9.]/g, ""));
          if (mileage && !next.next_due_miles) {
            next.next_due_miles = String(mileage + Number(next.interval_miles || 0));
          }
        }
      }

      return next;
    });
  };

  const addPlan = async () => {
    setMessage("");

    if (!form.plan_name || !form.vehicle_id) {
      setMessage("Plan name and vehicle are required.");
      return;
    }

    const customer = customers.find((item) => item.id === form.customer_id);
    const vehicle = vehicles.find((item) => item.id === form.vehicle_id);

    const plan = {
      id: `plan_${Date.now()}`,
      ...form,
      customer_name: customer?.name || vehicle?.customers?.name || "",
      vehicle_name: [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
      vin: vehicle?.vin || "",
      interval_miles: Number(form.interval_miles || 0),
      interval_months: Number(form.interval_months || 0),
      next_due_miles: Number(form.next_due_miles || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await savePlans([plan, ...plans]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Maintenance Plan Created",
      table_name: "app_settings",
      record_id: plan.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created maintenance plan ${plan.plan_name} for ${plan.customer_name}`
    });

    setMessage("Maintenance plan saved.");
    setForm({
      customer_id: "",
      vehicle_id: "",
      plan_name: "",
      interval_miles: "5000",
      interval_months: "6",
      next_due_miles: "",
      next_due_date: "",
      services: "Oil change, tire rotation, inspection",
      status: "Active",
      notes: ""
    });
  };

  const updatePlan = async (id, updates) => {
    const nextPlans = plans.map((plan) =>
      plan.id === id ? { ...plan, ...updates, updated_at: new Date().toISOString() } : plan
    );

    const saved = await savePlans(nextPlans);
    if (saved) setMessage("Maintenance plan updated.");
  };

  const dueSoon = useMemo(() => {
    const today = new Date();
    const soon = new Date();
    soon.setDate(today.getDate() + 30);

    return plans.filter((plan) => {
      if (plan.status !== "Active") return false;
      if (!plan.next_due_date) return false;
      const dueDate = new Date(plan.next_due_date);
      return dueDate <= soon;
    });
  }, [plans]);

  const copyReminder = async (plan) => {
    const text = `Hello ${plan.customer_name || ""},

This is a reminder that your ${plan.vehicle_name || "vehicle"} is due soon for:

${plan.services}

Due date: ${plan.next_due_date || "Not set"}
Due mileage: ${plan.next_due_miles || "Not set"}

Please contact us to schedule service.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Maintenance reminder copied.");
    } catch {
      setMessage("Could not copy reminder.");
    }
  };

  return (
    <div>
      <h2>Recurring Maintenance Plans</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Active Plans" value={plans.filter((plan) => plan.status === "Active").length} />
        <StatCard title="Due Soon" value={dueSoon.length} />
        <StatCard title="Total Plans" value={plans.length} />
      </div>

      <div style={panelStyle}>
        <h3>Create Maintenance Plan</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => updateForm("customer_id", e.target.value)} style={inputStyle}>
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label>
            Vehicle
            <select value={form.vehicle_id} onChange={(e) => updateForm("vehicle_id", e.target.value)} style={inputStyle}>
              <option value="">Select vehicle</option>
              {vehicles.filter((vehicle) => !form.customer_id || vehicle.customer_id === form.customer_id).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")} {vehicle.vin ? `- ${vehicle.vin}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Plan Name
            <input value={form.plan_name} onChange={(e) => updateForm("plan_name", e.target.value)} placeholder="5k Service Plan" style={inputStyle} />
          </label>

          <label>
            Interval Miles
            <input type="number" value={form.interval_miles} onChange={(e) => updateForm("interval_miles", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Interval Months
            <input type="number" value={form.interval_months} onChange={(e) => updateForm("interval_months", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Next Due Miles
            <input type="number" value={form.next_due_miles} onChange={(e) => updateForm("next_due_miles", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Next Due Date
            <input type="date" value={form.next_due_date} onChange={(e) => updateForm("next_due_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {PLAN_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Services
          <textarea value={form.services} onChange={(e) => updateForm("services", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addPlan}>Save Maintenance Plan</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Customer / Vehicle</th>
            <th>Plan</th>
            <th>Due</th>
            <th>Services</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>
                <select value={plan.status} onChange={(e) => updatePlan(plan.id, { status: e.target.value })} style={inputStyle}>
                  {PLAN_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{plan.customer_name || "-"}<br /><small>{plan.vehicle_name || ""}</small></td>
              <td>{plan.plan_name}<br /><small>Every {plan.interval_miles} mi / {plan.interval_months} mo</small></td>
              <td>{plan.next_due_date || "-"}<br /><small>{plan.next_due_miles ? `${plan.next_due_miles} miles` : ""}</small></td>
              <td style={{ whiteSpace: "pre-wrap" }}>{plan.services}</td>
              <td><button type="button" onClick={() => copyReminder(plan)}>Copy Reminder</button></td>
            </tr>
          ))}

          {plans.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center" }}>No maintenance plans.</td></tr>}
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

export default MaintenancePlansManager;
