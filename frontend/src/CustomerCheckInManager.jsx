import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CHECKIN_STATUSES = ["Waiting", "Checked In", "In Bay", "Ready", "Picked Up", "Cancelled"];

function CustomerCheckInManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    vehicle_id: "",
    invoice_id: "",
    customer_name: "",
    phone: "",
    vehicle: "",
    concern: "",
    keys_received: false,
    belongings_noted: "",
    odometer: "",
    fuel_level: "",
    status: "Waiting"
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, vehiclesResult, jobsResult, settingsResult] =
      await Promise.all([
        supabase.from("customers").select("*").order("name", { ascending: true }),
        supabase.from("customer_vehicles").select("*, customers(name, phone)"),
        supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
        supabase.from("app_settings").select("*").eq("setting_key", "customer_checkins_json").maybeSingle()
      ]);

    if (customersResult.error || vehiclesResult.error || jobsResult.error) {
      setMessage(customersResult.error?.message || vehiclesResult.error?.message || jobsResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setVehicles(vehiclesResult.data || []);
    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setCheckIns(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCheckIns([]);
    }
  };

  const saveCheckIns = async (nextCheckIns) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_checkins_json",
        setting_value: JSON.stringify(nextCheckIns, null, 2),
        description: "Customer check-in records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setCheckIns(nextCheckIns);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "customer_id") {
        const customer = customers.find((item) => item.id === value);
        next.customer_name = customer?.name || "";
        next.phone = customer?.phone || "";
      }

      if (field === "vehicle_id") {
        const vehicle = vehicles.find((item) => item.id === value);
        next.vehicle = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
        next.odometer = vehicle?.mileage || "";
      }

      if (field === "invoice_id") {
        const job = jobs.find((item) => item.id === value);
        if (job) {
          next.customer_id = job.customer_id || "";
          next.vehicle_id = job.vehicle_id || "";
          next.customer_name = job.customer_name || "";
          next.phone = job.customer_phone || "";
          next.vehicle = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ");
          next.odometer = job.vehicle_mileage || "";
        }
      }

      return next;
    });
  };

  const createCheckIn = async () => {
    setMessage("");

    if (!form.customer_name || !form.concern) {
      setMessage("Customer name and concern are required.");
      return;
    }

    const job = jobs.find((item) => item.id === form.invoice_id);

    const checkIn = {
      id: `checkin_${Date.now()}`,
      ...form,
      document_number: job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      checked_in_by: user?.email || user?.username || "",
      checked_in_at: new Date().toISOString(),
      created_by: user?.id || null
    };

    const saved = await saveCheckIns([checkIn, ...checkIns]);

    if (!saved) return;

    if (job) {
      await supabase.from("invoices").update({
        status: "Checked In",
        vehicle_mileage: form.odometer || job.vehicle_mileage,
        technician_notes: [job.technician_notes || "", `Customer concern: ${form.concern}`].filter(Boolean).join("\n"),
        updated_at: new Date().toISOString()
      }).eq("id", job.id);
    }

    await supabase.from("audit_logs").insert({
      action: "Customer Check-In Created",
      table_name: "app_settings",
      record_id: checkIn.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Checked in ${checkIn.customer_name}`
    });

    setMessage("Customer checked in.");
    setForm({
      customer_id: "",
      vehicle_id: "",
      invoice_id: "",
      customer_name: "",
      phone: "",
      vehicle: "",
      concern: "",
      keys_received: false,
      belongings_noted: "",
      odometer: "",
      fuel_level: "",
      status: "Waiting"
    });
    loadAll();
  };

  const updateCheckInStatus = async (checkIn, status) => {
    const next = checkIns.map((item) =>
      item.id === checkIn.id ? { ...item, status, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveCheckIns(next);
    if (saved) setMessage("Check-in updated.");
  };

  const todayCheckIns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return checkIns.filter((item) => String(item.checked_in_at || "").startsWith(today));
  }, [checkIns]);

  return (
    <div>
      <h2>Customer Check-In</h2>

      {message && <p style={{ color: message.includes("checked") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Today" value={todayCheckIns.length} />
        <StatCard title="Waiting" value={checkIns.filter((item) => item.status === "Waiting").length} />
        <StatCard title="In Bay" value={checkIns.filter((item) => item.status === "In Bay").length} />
        <StatCard title="Ready" value={checkIns.filter((item) => item.status === "Ready").length} />
      </div>

      <div style={panelStyle}>
        <h3>New Check-In</h3>

        <div style={gridStyle}>
          <label>
            Related Job / RO
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">No linked job</option>
              {jobs.slice(0, 200).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => updateForm("customer_id", e.target.value)} style={inputStyle}>
              <option value="">Manual customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label>
            Vehicle
            <select value={form.vehicle_id} onChange={(e) => updateForm("vehicle_id", e.target.value)} style={inputStyle}>
              <option value="">Manual vehicle</option>
              {vehicles.filter((vehicle) => !form.customer_id || vehicle.customer_id === form.customer_id).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}</option>
              ))}
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
            Vehicle
            <input value={form.vehicle} onChange={(e) => updateForm("vehicle", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Odometer
            <input value={form.odometer} onChange={(e) => updateForm("odometer", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Fuel Level
            <select value={form.fuel_level} onChange={(e) => updateForm("fuel_level", e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              <option>Empty</option>
              <option>1/4</option>
              <option>1/2</option>
              <option>3/4</option>
              <option>Full</option>
            </select>
          </label>
        </div>

        <label>
          Customer Concern
          <textarea value={form.concern} onChange={(e) => updateForm("concern", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Belongings / Damage Notes
          <textarea value={form.belongings_noted} onChange={(e) => updateForm("belongings_noted", e.target.value)} style={textareaStyle} />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={form.keys_received} onChange={(e) => updateForm("keys_received", e.target.checked)} /> Keys received
        </label>

        <button type="button" onClick={createCheckIn}>Check In Customer</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Concern</th>
            <th>Odometer / Fuel</th>
            <th>Keys</th>
            <th>Checked In</th>
          </tr>
        </thead>
        <tbody>
          {checkIns.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateCheckInStatus(item, e.target.value)} style={inputStyle}>
                  {CHECKIN_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.customer_name}<br /><small>{item.phone || ""}</small></td>
              <td>{item.vehicle || "-"}</td>
              <td>{item.concern}</td>
              <td>{item.odometer || "-"}<br /><small>{item.fuel_level || ""}</small></td>
              <td>{item.keys_received ? "Yes" : "No"}</td>
              <td>{item.checked_in_at ? new Date(item.checked_in_at).toLocaleString() : "-"}</td>
            </tr>
          ))}
          {checkIns.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No check-ins.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CustomerCheckInManager;
