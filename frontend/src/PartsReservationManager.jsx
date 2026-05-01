import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Reserved", "Pulled", "Installed", "Released", "Cancelled"];

function PartsReservationManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    part_id: "",
    part_number: "",
    description: "",
    invoice_id: "",
    quantity: "1",
    status: "Reserved",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, jobsResult, settingsResult] = await Promise.all([
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_reservations_json").maybeSingle()
    ]);

    if (partsResult.error || jobsResult.error) {
      setMessage(partsResult.error?.message || jobsResult.error?.message);
      return;
    }

    setParts(partsResult.data || []);
    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setReservations(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReservations([]);
    }
  };

  const saveReservations = async (nextReservations) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "parts_reservations_json",
        setting_value: JSON.stringify(nextReservations, null, 2),
        description: "Parts reservation and hold records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setReservations(nextReservations);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "part_id") {
        const part = parts.find((item) => item.id === value);
        if (part) {
          next.part_number = part.part_number || "";
          next.description = part.name || "";
        }
      }

      return next;
    });
  };

  const getReservedQty = (partNumber) =>
    reservations
      .filter((item) => item.part_number === partNumber && ["Reserved", "Pulled"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const addReservation = async () => {
    setMessage("");

    if (!form.part_number || !form.invoice_id) {
      setMessage("Part and job are required.");
      return;
    }

    const part = parts.find((item) => item.part_number === form.part_number);
    const job = jobs.find((item) => item.id === form.invoice_id);
    const qty = Number(form.quantity || 0);

    if (part && qty > Number(part.quantity || 0) - getReservedQty(form.part_number)) {
      setMessage("Reservation quantity exceeds available unreserved stock.");
      return;
    }

    const reservation = {
      id: `reservation_${Date.now()}`,
      ...form,
      quantity: qty,
      document_number: job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      customer_name: job?.customer_name || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveReservations([reservation, ...reservations]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Part Reserved",
      table_name: "app_settings",
      record_id: reservation.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${reservation.quantity} ${reservation.part_number} reserved for ${reservation.document_number}`
    });

    setMessage("Part reserved.");
    setForm({
      part_id: "",
      part_number: "",
      description: "",
      invoice_id: "",
      quantity: "1",
      status: "Reserved",
      notes: ""
    });
  };

  const updateReservation = async (id, updates) => {
    const next = reservations.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveReservations(next);
    if (saved) setMessage("Reservation updated.");
  };

  const rows = useMemo(
    () =>
      reservations.map((item) => {
        const part = parts.find((partItem) => partItem.part_number === item.part_number);
        return {
          ...item,
          stock: Number(part?.quantity || 0),
          reservedTotal: getReservedQty(item.part_number)
        };
      }),
    [reservations, parts]
  );

  return (
    <div>
      <h2>Parts Reservations / Holds</h2>

      {message && (
        <p style={{ color: message.includes("reserved") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Active Reservations" value={reservations.filter((item) => ["Reserved", "Pulled"].includes(item.status)).length} />
        <StatCard title="Reserved Units" value={reservations.filter((item) => ["Reserved", "Pulled"].includes(item.status)).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} />
        <StatCard title="Installed" value={reservations.filter((item) => item.status === "Installed").length} />
      </div>

      <div style={panelStyle}>
        <h3>Reserve Part</h3>

        <div style={gridStyle}>
          <label>
            Part
            <select value={form.part_id} onChange={(e) => updateForm("part_id", e.target.value)} style={inputStyle}>
              <option value="">Select part</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.part_number || "No Part #"} - {part.name} - Qty {part.quantity}
                </option>
              ))}
            </select>
          </label>

          <label>
            Job / RO
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">Select job</option>
              {jobs.slice(0, 250).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantity
            <input type="number" value={form.quantity} onChange={(e) => updateForm("quantity", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addReservation}>Reserve Part</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Part</th>
            <th>Qty</th>
            <th>Stock</th>
            <th>Total Reserved</th>
            <th>Job</th>
            <th>Customer</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateReservation(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.part_number}<br /><small>{item.description}</small></td>
              <td>{item.quantity}</td>
              <td>{item.stock}</td>
              <td>{item.reservedTotal}</td>
              <td>{item.document_number || "-"}</td>
              <td>{item.customer_name || "-"}</td>
              <td>{item.notes || "-"}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No reservations.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PartsReservationManager;
