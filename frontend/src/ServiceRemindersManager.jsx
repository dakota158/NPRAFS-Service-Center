import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function ServiceRemindersManager({ user, canEditEverything }) {
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [mileageBuffer, setMileageBuffer] = useState("3000");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [vehicleResult, invoiceResult] = await Promise.all([
      supabase
        .from("customer_vehicles")
        .select("*, customers(name, phone, email)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false })
    ]);

    if (vehicleResult.error) {
      setMessage(vehicleResult.error.message);
      return;
    }

    setVehicles(vehicleResult.data || []);
    setInvoices(invoiceResult.data || []);
  };

  const getVehicleInvoices = (vehicle) =>
    invoices.filter(
      (invoice) =>
        invoice.vehicle_id === vehicle.id ||
        (vehicle.vin &&
          invoice.vehicle_vin &&
          vehicle.vin.toLowerCase() === invoice.vehicle_vin.toLowerCase())
    );

  const getRecommendations = (vehicle) => {
    const vehicleInvoices = getVehicleInvoices(vehicle);
    const laborText = vehicleInvoices
      .flatMap((invoice) => invoice.labor_items || [])
      .map((labor) => `${labor.description || ""} ${labor.rate_name || ""}`)
      .join(" ")
      .toLowerCase();

    const recommendations = [];

    if (!laborText.includes("oil")) {
      recommendations.push("Oil change / maintenance inspection");
    }

    if (!laborText.includes("brake")) {
      recommendations.push("Brake inspection");
    }

    if (!laborText.includes("battery")) {
      recommendations.push("Battery / charging system test");
    }

    if (!laborText.includes("tire")) {
      recommendations.push("Tire rotation / tire inspection");
    }

    const mileage = Number(String(vehicle.mileage || "").replace(/[^0-9.]/g, ""));
    const buffer = Number(mileageBuffer || 3000);

    if (mileage && mileage >= buffer) {
      recommendations.push(`Mileage-based service review at ${vehicle.mileage} miles`);
    }

    return recommendations;
  };

  const reminderRows = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        vehicle,
        invoices: getVehicleInvoices(vehicle),
        recommendations: getRecommendations(vehicle)
      })),
    [vehicles, invoices, mileageBuffer]
  );

  const createReminderDraft = async (row) => {
    setMessage("");

    const latestInvoice = row.invoices[0];

    if (!latestInvoice) {
      setMessage("This vehicle has no invoice to attach a communication log to yet.");
      return;
    }

    const customer = row.vehicle.customers;
    const vehicleName =
      [row.vehicle.year, row.vehicle.make, row.vehicle.model]
        .filter(Boolean)
        .join(" ") || "your vehicle";

    const body = `Hello ${customer?.name || ""},

This is a friendly service reminder for ${vehicleName}.

Recommended items:
${row.recommendations.map((item) => `- ${item}`).join("\n")}

Please contact us when you are ready to schedule service.

Thank you.`;

    const { error } = await supabase.from("invoice_email_logs").insert({
      invoice_id: latestInvoice.id,
      emailed_to: customer?.email || "",
      subject: `Service Reminder - ${vehicleName}`,
      body,
      status: "Drafted",
      created_by: user?.id || null
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Service Reminder Drafted",
      table_name: "invoice_email_logs",
      record_id: latestInvoice.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created service reminder for ${vehicleName}`
    });

    setMessage("Service reminder draft created in communications log.");
  };

  return (
    <div>
      <h2>Service Reminders / Recommendations</h2>

      {message && (
        <p style={{ color: message.includes("created") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Reminder Rules</h3>

        <label>
          Mileage Review Threshold
          <input
            type="number"
            value={mileageBuffer}
            onChange={(e) => setMileageBuffer(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={loadAll} style={{ marginTop: 8 }}>
          Refresh
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Mileage</th>
            <th>Service History</th>
            <th>Recommendations</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {reminderRows.map((row) => (
            <tr key={row.vehicle.id}>
              <td>
                <strong>{row.vehicle.customers?.name || "-"}</strong>
                <br />
                <small>
                  {row.vehicle.customers?.phone || row.vehicle.customers?.email || ""}
                </small>
              </td>
              <td>
                {[row.vehicle.year, row.vehicle.make, row.vehicle.model]
                  .filter(Boolean)
                  .join(" ") || "-"}
                <br />
                <small>{row.vehicle.vin || ""}</small>
              </td>
              <td>{row.vehicle.mileage || "-"}</td>
              <td>{row.invoices.length} document(s)</td>
              <td>
                {row.recommendations.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {row.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  "No recommendations"
                )}
              </td>
              <td>
                <button type="button" onClick={() => createReminderDraft(row)}>
                  Draft Reminder
                </button>
              </td>
            </tr>
          ))}

          {reminderRows.length === 0 && (
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

export default ServiceRemindersManager;
