import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function VehicleTimelineManager() {
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [vehiclesResult, invoicesResult, commsResult] = await Promise.all([
      supabase.from("customer_vehicles").select("*, customers(name, phone, email)").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "communication_log_json").maybeSingle()
    ]);

    if (vehiclesResult.error || invoicesResult.error) {
      setMessage(vehiclesResult.error?.message || invoicesResult.error?.message);
      return;
    }

    setVehicles(vehiclesResult.data || []);
    setInvoices(invoicesResult.data || []);

    try {
      const parsed = JSON.parse(commsResult.data?.setting_value || "[]");
      setCommunications(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCommunications([]);
    }
  };

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);

  const timeline = useMemo(() => {
    if (!selectedVehicle) return [];

    const vehicleLabel = [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const relatedInvoices = invoices.filter((invoice) => {
      if (invoice.vehicle_id && invoice.vehicle_id === selectedVehicle.id) return true;
      const invoiceVehicle = [invoice.vehicle_year, invoice.vehicle_make, invoice.vehicle_model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return invoice.customer_id === selectedVehicle.customer_id && invoiceVehicle && invoiceVehicle === vehicleLabel;
    });

    const invoiceEvents = relatedInvoices.map((invoice) => ({
      id: `invoice_${invoice.id}`,
      date: invoice.invoice_date || invoice.created_at,
      type: invoice.document_status || "Document",
      title: invoice.invoice_number || invoice.repair_order_number || invoice.estimate_number || "Document",
      details: `${invoice.customer_name || ""} - $${Number(invoice.grand_total || 0).toFixed(2)} - ${invoice.status || ""}`
    }));

    const commEvents = communications
      .filter((comm) => comm.customer_id === selectedVehicle.customer_id || comm.customer_name === selectedVehicle.customers?.name)
      .map((comm) => ({
        id: `comm_${comm.id}`,
        date: comm.created_at,
        type: "Communication",
        title: comm.subject || `${comm.method} ${comm.direction}`,
        details: comm.note || ""
      }));

    return [...invoiceEvents, ...commEvents]
      .filter((event) => event.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedVehicle, invoices, communications]);

  return (
    <div>
      <h2>Customer Vehicle Timeline</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Vehicle
          <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} style={inputStyle}>
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.customers?.name || "Customer"} - {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")} {vehicle.vin ? `- ${vehicle.vin}` : ""}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      {selectedVehicle && (
        <div style={panelStyle}>
          <h3>{[selectedVehicle.year, selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ")}</h3>
          <p>
            <strong>Customer:</strong> {selectedVehicle.customers?.name || "-"} |{" "}
            <strong>VIN:</strong> {selectedVehicle.vin || "-"} |{" "}
            <strong>Mileage:</strong> {selectedVehicle.mileage || "-"}
          </p>
        </div>
      )}

      <div>
        {timeline.map((event) => (
          <div key={event.id} style={timelineItem}>
            <div style={timelineDot} />
            <div>
              <h3 style={{ margin: 0 }}>{event.title}</h3>
              <p style={{ margin: "4px 0" }}><strong>{event.type}</strong> | {new Date(event.date).toLocaleString()}</p>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{event.details}</p>
            </div>
          </div>
        ))}

        {selectedVehicle && timeline.length === 0 && <p>No timeline events found for this vehicle.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", maxWidth: 600, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const timelineItem = { display: "flex", gap: 12, borderLeft: "2px solid #d1d5db", paddingLeft: 12, paddingBottom: 18, marginLeft: 8 };
const timelineDot = { width: 12, height: 12, borderRadius: 999, background: "#2563eb", marginLeft: -19, marginTop: 6, flex: "0 0 auto" };

export default VehicleTimelineManager;
