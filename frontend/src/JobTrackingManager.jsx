import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const JOB_STATUSES = [
  "Pending",
  "Approved",
  "Open",
  "Waiting Parts",
  "In Progress",
  "Ready",
  "Completed",
  "Delivered",
  "Cancelled"
];

function JobTrackingManager({ user, canEditEverything }) {
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    document_status: "Repair Order",
    repair_order_number: "",
    customer_id: "",
    vehicle_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    vehicle_year: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_vin: "",
    vehicle_mileage: "",
    status: "Open",
    technician_name: "",
    service_advisor: user?.name || user?.username || user?.email || "",
    technician_notes: "",
    internal_notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setMessage("");

    const [invoiceResult, profileResult, customerResult, vehicleResult] =
      await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase.from("profiles").select("*").order("name", { ascending: true }),
        supabase.from("customers").select("*").order("name", { ascending: true }),
        supabase
          .from("customer_vehicles")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

    if (invoiceResult.error) {
      setMessage(invoiceResult.error.message);
      return;
    }

    setJobs(invoiceResult.data || []);
    setProfiles(profileResult.data || []);
    setCustomers(customerResult.data || []);
    setVehicles(vehicleResult.data || []);
  };

  const technicians = profiles.filter((profile) =>
    ["Tech", "Manager", "IT", "admin", "Admin"].includes(profile.role)
  );

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const isJob =
        job.document_status === "Repair Order" ||
        job.repair_order_number ||
        job.status;

      if (!isJob) return false;

      if (!term) return true;

      return [
        job.repair_order_number,
        job.estimate_number,
        job.invoice_number,
        job.customer_name,
        job.customer_phone,
        job.customer_email,
        job.vehicle_year,
        job.vehicle_make,
        job.vehicle_model,
        job.vehicle_vin,
        job.status,
        job.technician_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [jobs, search]);

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "customer_id") {
        const customer = customers.find((item) => item.id === value);

        if (customer) {
          next.customer_name = customer.name || "";
          next.customer_phone = customer.phone || "";
          next.customer_email = customer.email || "";
        }
      }

      if (field === "vehicle_id") {
        const vehicle = vehicles.find((item) => item.id === value);

        if (vehicle) {
          next.vehicle_year = vehicle.year || "";
          next.vehicle_make = vehicle.make || "";
          next.vehicle_model = vehicle.model || "";
          next.vehicle_vin = vehicle.vin || "";
          next.vehicle_mileage = vehicle.mileage || "";
        }
      }

      return next;
    });
  };

  const makeRoNumber = () => {
    const existingCount = jobs.length + 1;
    return `RO-${String(existingCount).padStart(5, "0")}`;
  };

  const createJob = async () => {
    setMessage("");

    if (!form.customer_name) {
      setMessage("Customer name is required.");
      return;
    }

    const repairOrderNumber = form.repair_order_number || makeRoNumber();

    const payload = {
      document_status: "Repair Order",
      invoice_number: repairOrderNumber,
      estimate_number: repairOrderNumber,
      repair_order_number: repairOrderNumber,
      customer_id: form.customer_id || null,
      vehicle_id: form.vehicle_id || null,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_email: form.customer_email,
      vehicle_year: form.vehicle_year,
      vehicle_make: form.vehicle_make,
      vehicle_model: form.vehicle_model,
      vehicle_vin: form.vehicle_vin,
      vehicle_mileage: form.vehicle_mileage,
      invoice_date: new Date().toISOString().slice(0, 10),
      status: form.status,
      payment_status: "Unpaid",
      technician_name: form.technician_name,
      service_advisor: form.service_advisor,
      technician_notes: form.technician_notes,
      internal_notes: form.internal_notes,
      labor_items: [],
      part_items: [],
      created_by: user?.id || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("invoices").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Repair Order Created",
      table_name: "invoices",
      record_id: repairOrderNumber,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created repair order ${repairOrderNumber} for ${form.customer_name}`
    });

    setMessage("Repair order created.");
    setForm((prev) => ({
      ...prev,
      repair_order_number: "",
      customer_id: "",
      vehicle_id: "",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      vehicle_year: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_vin: "",
      vehicle_mileage: "",
      status: "Open",
      technician_name: "",
      technician_notes: "",
      internal_notes: ""
    }));
    loadAll();
  };

  const updateJob = async (job, updates) => {
    const { error } = await supabase
      .from("invoices")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Repair Order Updated",
      table_name: "invoices",
      record_id: job.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Updated ${job.repair_order_number || job.invoice_number}`
    });

    loadAll();
  };

  const statusCounts = JOB_STATUSES.reduce((counts, status) => {
    counts[status] = filteredJobs.filter((job) => job.status === status).length;
    return counts;
  }, {});

  return (
    <div>
      <h2>Jobs / Work Orders</h2>

      {message && (
        <p style={{ color: message.includes("created") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        {JOB_STATUSES.map((status) => (
          <div key={status} style={statCard}>
            <div style={{ color: "#64748b", fontSize: 13 }}>{status}</div>
            <div style={{ fontSize: 24, fontWeight: "bold" }}>
              {statusCounts[status] || 0}
            </div>
          </div>
        ))}
      </div>

      <div style={panelStyle}>
        <h3>Create Repair Order</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select
              value={form.customer_id}
              onChange={(e) => updateForm("customer_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Manual / Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.phone ? `- ${customer.phone}` : ""}
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
              <option value="">Manual / Select Vehicle</option>
              {vehicles
                .filter(
                  (vehicle) =>
                    !form.customer_id || vehicle.customer_id === form.customer_id
                )
                .map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {[vehicle.year, vehicle.make, vehicle.model]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    {vehicle.vin ? `- ${vehicle.vin}` : ""}
                  </option>
                ))}
            </select>
          </label>

          <label>
            RO #
            <input
              value={form.repair_order_number}
              onChange={(e) => updateForm("repair_order_number", e.target.value)}
              placeholder="Auto if blank"
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
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Customer Name
            <input
              value={form.customer_name}
              onChange={(e) => updateForm("customer_name", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Phone
            <input
              value={form.customer_phone}
              onChange={(e) => updateForm("customer_phone", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Email
            <input
              value={form.customer_email}
              onChange={(e) => updateForm("customer_email", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Technician
            <select
              value={form.technician_name}
              onChange={(e) => updateForm("technician_name", e.target.value)}
              style={inputStyle}
            >
              <option value="">Unassigned</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.name || tech.email}>
                  {tech.name || tech.email} ({tech.role})
                </option>
              ))}
            </select>
          </label>

          <label>
            Vehicle Year
            <input
              value={form.vehicle_year}
              onChange={(e) => updateForm("vehicle_year", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Make
            <input
              value={form.vehicle_make}
              onChange={(e) => updateForm("vehicle_make", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Model
            <input
              value={form.vehicle_model}
              onChange={(e) => updateForm("vehicle_model", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            VIN
            <input
              value={form.vehicle_vin}
              onChange={(e) => updateForm("vehicle_vin", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Technician Notes
          <textarea
            value={form.technician_notes}
            onChange={(e) => updateForm("technician_notes", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <label>
          Internal Notes
          <textarea
            value={form.internal_notes}
            onChange={(e) => updateForm("internal_notes", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={createJob}>
          Create Repair Order
        </button>
      </div>

      <h3>Current Jobs</h3>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search jobs by customer, vehicle, status, RO, VIN..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>RO #</th>
            <th>Status</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Technician</th>
            <th>Advisor</th>
            <th>Total</th>
            <th>Updated</th>
          </tr>
        </thead>

        <tbody>
          {filteredJobs.map((job) => (
            <tr key={job.id}>
              <td>{job.repair_order_number || job.invoice_number || "-"}</td>
              <td>
                <select
                  value={job.status || "Open"}
                  onChange={(e) => updateJob(job, { status: e.target.value })}
                  style={inputStyle}
                >
                  {JOB_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <strong>{job.customer_name || "-"}</strong>
                <br />
                <small>{job.customer_phone || job.customer_email || ""}</small>
              </td>
              <td>
                {[job.vehicle_year, job.vehicle_make, job.vehicle_model]
                  .filter(Boolean)
                  .join(" ") || "-"}
                <br />
                <small>{job.vehicle_vin || ""}</small>
              </td>
              <td>
                <select
                  value={job.technician_name || ""}
                  onChange={(e) =>
                    updateJob(job, { technician_name: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.name || tech.email}>
                      {tech.name || tech.email}
                    </option>
                  ))}
                </select>
              </td>
              <td>{job.service_advisor || "-"}</td>
              <td>${Number(job.grand_total || 0).toFixed(2)}</td>
              <td>
                {job.updated_at
                  ? new Date(job.updated_at).toLocaleString()
                  : "-"}
              </td>
            </tr>
          ))}

          {filteredJobs.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                No jobs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 80,
  marginBottom: 12
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  marginBottom: 18
};

const statCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12
};

export default JobTrackingManager;
