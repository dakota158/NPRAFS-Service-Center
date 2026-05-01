import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function VehiclesManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    customer_id: "",
    year: "",
    make: "",
    model: "",
    vin: "",
    mileage: "",
    license_plate: "",
    color: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customerResult, vehicleResult, invoiceResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase
        .from("customer_vehicles")
        .select("*, customers(name, phone, email)")
        .order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false })
    ]);

    if (vehicleResult.error) {
      setMessage(vehicleResult.error.message);
      return;
    }

    setCustomers(customerResult.data || []);
    setVehicles(vehicleResult.data || []);
    setInvoices(invoiceResult.data || []);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const addVehicle = async () => {
    setMessage("");

    if (!form.customer_id) {
      setMessage("Select a customer before adding a vehicle.");
      return;
    }

    const { data, error } = await supabase
      .from("customer_vehicles")
      .insert({
        customer_id: form.customer_id,
        year: form.year,
        make: form.make,
        model: form.model,
        vin: form.vin,
        mileage: form.mileage,
        license_plate: form.license_plate,
        color: form.color,
        notes: form.notes,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Vehicle Created",
      table_name: "customer_vehicles",
      record_id: data.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created vehicle ${form.year} ${form.make} ${form.model}`
    });

    setForm({
      customer_id: "",
      year: "",
      make: "",
      model: "",
      vin: "",
      mileage: "",
      license_plate: "",
      color: "",
      notes: ""
    });

    setMessage("Vehicle saved.");
    loadAll();
  };

  const updateVehicle = async (vehicle, field, value) => {
    const { error } = await supabase
      .from("customer_vehicles")
      .update({
        [field]: value,
        updated_at: new Date().toISOString()
      })
      .eq("id", vehicle.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    loadAll();
  };

  const filteredVehicles = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return vehicles;

    return vehicles.filter((vehicle) =>
      [
        vehicle.customers?.name,
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.vin,
        vehicle.mileage,
        vehicle.license_plate,
        vehicle.color,
        vehicle.notes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [vehicles, search]);

  const getVehicleInvoices = (vehicle) =>
    invoices.filter(
      (invoice) =>
        invoice.vehicle_id === vehicle.id ||
        (vehicle.vin &&
          invoice.vehicle_vin &&
          vehicle.vin.toLowerCase() === invoice.vehicle_vin.toLowerCase())
    );

  return (
    <div>
      <h2>Vehicles</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Add Vehicle</h3>

        <div style={gridStyle}>
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
                  {customer.name} {customer.phone ? `- ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <input
              value={form.year}
              onChange={(e) => updateForm("year", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Make
            <input
              value={form.make}
              onChange={(e) => updateForm("make", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Model
            <input
              value={form.model}
              onChange={(e) => updateForm("model", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            VIN
            <input
              value={form.vin}
              onChange={(e) => updateForm("vin", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Mileage
            <input
              value={form.mileage}
              onChange={(e) => updateForm("mileage", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            License Plate
            <input
              value={form.license_plate}
              onChange={(e) => updateForm("license_plate", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Color
            <input
              value={form.color}
              onChange={(e) => updateForm("color", e.target.value)}
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

        <button type="button" onClick={addVehicle}>
          Add Vehicle
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search vehicles..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>VIN / Plate</th>
            <th>Mileage</th>
            <th>History</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {filteredVehicles.map((vehicle) => {
            const vehicleInvoices = getVehicleInvoices(vehicle);

            return (
              <tr key={vehicle.id}>
                <td>{vehicle.customers?.name || "-"}</td>
                <td>
                  <div style={gridStyle}>
                    <input
                      value={vehicle.year || ""}
                      onChange={(e) =>
                        updateVehicle(vehicle, "year", e.target.value)
                      }
                      disabled={!canEditEverything}
                      placeholder="Year"
                      style={inputStyle}
                    />
                    <input
                      value={vehicle.make || ""}
                      onChange={(e) =>
                        updateVehicle(vehicle, "make", e.target.value)
                      }
                      disabled={!canEditEverything}
                      placeholder="Make"
                      style={inputStyle}
                    />
                    <input
                      value={vehicle.model || ""}
                      onChange={(e) =>
                        updateVehicle(vehicle, "model", e.target.value)
                      }
                      disabled={!canEditEverything}
                      placeholder="Model"
                      style={inputStyle}
                    />
                  </div>
                </td>
                <td>
                  <input
                    value={vehicle.vin || ""}
                    onChange={(e) =>
                      updateVehicle(vehicle, "vin", e.target.value)
                    }
                    disabled={!canEditEverything}
                    placeholder="VIN"
                    style={inputStyle}
                  />
                  <input
                    value={vehicle.license_plate || ""}
                    onChange={(e) =>
                      updateVehicle(vehicle, "license_plate", e.target.value)
                    }
                    disabled={!canEditEverything}
                    placeholder="Plate"
                    style={inputStyle}
                  />
                </td>
                <td>
                  <input
                    value={vehicle.mileage || ""}
                    onChange={(e) =>
                      updateVehicle(vehicle, "mileage", e.target.value)
                    }
                    disabled={!canEditEverything}
                    style={inputStyle}
                  />
                </td>
                <td>
                  {vehicleInvoices.length} document(s)
                  <br />
                  <small>
                    Total: $
                    {vehicleInvoices
                      .reduce(
                        (sum, invoice) => sum + Number(invoice.grand_total || 0),
                        0
                      )
                      .toFixed(2)}
                  </small>
                </td>
                <td>
                  <textarea
                    value={vehicle.notes || ""}
                    onChange={(e) =>
                      updateVehicle(vehicle, "notes", e.target.value)
                    }
                    disabled={!canEditEverything}
                    style={{ ...textareaStyle, minHeight: 60 }}
                  />
                </td>
              </tr>
            );
          })}

          {filteredVehicles.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No vehicles found.
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
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
  marginBottom: 8
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

export default VehiclesManager;
