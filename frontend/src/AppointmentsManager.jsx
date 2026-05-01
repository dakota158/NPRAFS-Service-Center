import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const APPOINTMENT_STATUSES = [
  "Scheduled",
  "Confirmed",
  "Checked In",
  "In Progress",
  "Completed",
  "No Show",
  "Cancelled"
];

function AppointmentsManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  const [form, setForm] = useState({
    customer_id: "",
    vehicle_id: "",
    invoice_id: "",
    appointment_date: new Date().toISOString().slice(0, 10),
    appointment_time: "09:00",
    duration_minutes: "60",
    status: "Scheduled",
    reason: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, vehiclesResult, jobsResult, settingsResult] =
      await Promise.all([
        supabase.from("customers").select("*").order("name", { ascending: true }),
        supabase.from("customer_vehicles").select("*, customers(name)"),
        supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
        supabase
          .from("app_settings")
          .select("*")
          .eq("setting_key", "appointments_json")
          .maybeSingle()
      ]);

    if (customersResult.error || vehiclesResult.error || jobsResult.error) {
      setMessage(
        customersResult.error?.message ||
          vehiclesResult.error?.message ||
          jobsResult.error?.message
      );
      return;
    }

    setCustomers(customersResult.data || []);
    setVehicles(vehiclesResult.data || []);
    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setAppointments(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAppointments([]);
    }
  };

  const saveAppointments = async (nextAppointments) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "appointments_json",
        setting_value: JSON.stringify(nextAppointments, null, 2),
        description: "Shop appointment schedule",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setAppointments(nextAppointments);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const job = jobs.find((item) => item.id === value);

        if (job) {
          next.customer_id = job.customer_id || "";
          next.vehicle_id = job.vehicle_id || "";
          next.reason =
            job.document_status === "Repair Order"
              ? `Repair Order ${job.repair_order_number || job.invoice_number}`
              : job.document_status || "Service";
        }
      }

      return next;
    });
  };

  const createAppointment = async () => {
    setMessage("");

    if (!form.appointment_date || !form.appointment_time) {
      setMessage("Appointment date and time are required.");
      return;
    }

    const customer = customers.find((item) => item.id === form.customer_id);
    const vehicle = vehicles.find((item) => item.id === form.vehicle_id);
    const job = jobs.find((item) => item.id === form.invoice_id);

    const nextAppointment = {
      id: `appt_${Date.now()}`,
      customer_id: form.customer_id,
      customer_name: customer?.name || job?.customer_name || "",
      vehicle_id: form.vehicle_id,
      vehicle_name:
        [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") ||
        [job?.vehicle_year, job?.vehicle_make, job?.vehicle_model]
          .filter(Boolean)
          .join(" "),
      invoice_id: form.invoice_id,
      document_number:
        job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      duration_minutes: Number(form.duration_minutes || 60),
      status: form.status,
      reason: form.reason,
      notes: form.notes,
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const nextAppointments = [nextAppointment, ...appointments];

    const saved = await saveAppointments(nextAppointments);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Appointment Created",
      table_name: "app_settings",
      record_id: nextAppointment.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created appointment for ${nextAppointment.customer_name || "customer"}`
    });

    setMessage("Appointment scheduled.");
    setForm({
      customer_id: "",
      vehicle_id: "",
      invoice_id: "",
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: "09:00",
      duration_minutes: "60",
      status: "Scheduled",
      reason: "",
      notes: ""
    });
  };

  const updateAppointment = async (appointmentId, updates) => {
    const nextAppointments = appointments.map((appointment) =>
      appointment.id === appointmentId
        ? { ...appointment, ...updates, updated_at: new Date().toISOString() }
        : appointment
    );

    const saved = await saveAppointments(nextAppointments);

    if (saved) {
      setMessage("Appointment updated.");
    }
  };

  const filteredAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) =>
          filterDate ? appointment.appointment_date === filterDate : true
        )
        .sort((a, b) =>
          `${a.appointment_date} ${a.appointment_time}`.localeCompare(
            `${b.appointment_date} ${b.appointment_time}`
          )
        ),
    [appointments, filterDate]
  );

  return (
    <div>
      <h2>Appointments</h2>

      {message && (
        <p style={{ color: message.includes("scheduled") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Schedule Appointment</h3>

        <div style={gridStyle}>
          <label>
            Link Job / RO
            <select
              value={form.invoice_id}
              onChange={(e) => updateForm("invoice_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">No linked job</option>
              {jobs.slice(0, 200).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.document_status || "Invoice"} -{" "}
                  {job.repair_order_number || job.invoice_number || job.estimate_number} -{" "}
                  {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Customer
            <select
              value={form.customer_id}
              onChange={(e) => updateForm("customer_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vehicle
            <select
              value={form.vehicle_id}
              onChange={(e) => updateForm("vehicle_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select vehicle</option>
              {vehicles
                .filter(
                  (vehicle) => !form.customer_id || vehicle.customer_id === form.customer_id
                )
                .map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              value={form.appointment_date}
              onChange={(e) => updateForm("appointment_date", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Time
            <input
              type="time"
              value={form.appointment_time}
              onChange={(e) => updateForm("appointment_time", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Duration Minutes
            <input
              type="number"
              value={form.duration_minutes}
              onChange={(e) => updateForm("duration_minutes", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => updateForm("status", e.target.value)}
              style={inputStyle}
            >
              {APPOINTMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Reason
            <input
              value={form.reason}
              onChange={(e) => updateForm("reason", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={createAppointment}>
          Schedule Appointment
        </button>
      </div>

      <div style={panelStyle}>
        <h3>Schedule View</h3>

        <label>
          Filter Date
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={() => setFilterDate("")}>
          Show All
        </button>{" "}
        <button type="button" onClick={loadAll}>
          Refresh
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Document</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {filteredAppointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>
                {appointment.appointment_date}
                <br />
                <strong>{appointment.appointment_time}</strong>
                <br />
                <small>{appointment.duration_minutes} min</small>
              </td>
              <td>{appointment.customer_name || "-"}</td>
              <td>{appointment.vehicle_name || "-"}</td>
              <td>{appointment.document_number || "-"}</td>
              <td>{appointment.reason || "-"}</td>
              <td>
                <select
                  value={appointment.status}
                  onChange={(e) =>
                    updateAppointment(appointment.id, { status: e.target.value })
                  }
                  style={inputStyle}
                >
                  {APPOINTMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td>{appointment.notes || "-"}</td>
            </tr>
          ))}

          {filteredAppointments.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No appointments found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default AppointmentsManager;
