import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Active", "Due", "Down", "Retired"];
const TYPES = ["Lift", "Compressor", "Alignment", "Scanner", "Tire Machine", "Balancer", "Shop Tool", "Other"];

function EquipmentMaintenanceManager({ user, canEditEverything }) {
  const [equipment, setEquipment] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    equipment_type: "Other",
    serial_number: "",
    location: "",
    interval_days: "90",
    last_service_date: "",
    next_service_date: "",
    status: "Active",
    notes: ""
  });

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "equipment_maintenance_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setEquipment(Array.isArray(parsed) ? parsed : []);
    } catch {
      setEquipment([]);
    }
  };

  const saveEquipment = async (nextEquipment) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "equipment_maintenance_json",
        setting_value: JSON.stringify(nextEquipment, null, 2),
        description: "Shop equipment maintenance schedules",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setEquipment(nextEquipment);
    return true;
  };

  const addEquipment = async () => {
    setMessage("");

    if (!form.name) {
      setMessage("Equipment name is required.");
      return;
    }

    const record = {
      id: `equipment_${Date.now()}`,
      ...form,
      interval_days: Number(form.interval_days || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveEquipment([record, ...equipment]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Equipment Maintenance Created",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: record.name
    });

    setMessage("Equipment saved.");
    setForm({
      name: "",
      equipment_type: "Other",
      serial_number: "",
      location: "",
      interval_days: "90",
      last_service_date: "",
      next_service_date: "",
      status: "Active",
      notes: ""
    });
  };

  const updateEquipment = async (id, updates) => {
    const next = equipment.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveEquipment(next);
    if (saved) setMessage("Equipment updated.");
  };

  const markServiced = async (item) => {
    const today = new Date();
    const nextDate = new Date();
    nextDate.setDate(today.getDate() + Number(item.interval_days || 0));

    await updateEquipment(item.id, {
      last_service_date: today.toISOString().slice(0, 10),
      next_service_date: nextDate.toISOString().slice(0, 10),
      status: "Active"
    });
  };

  const rows = useMemo(() => {
    const today = new Date();

    return equipment.map((item) => {
      const nextService = item.next_service_date ? new Date(item.next_service_date) : null;
      const due = nextService ? nextService <= today : false;

      return {
        ...item,
        computedStatus: due && item.status === "Active" ? "Due" : item.status,
        due
      };
    }).sort((a, b) => String(a.next_service_date || "").localeCompare(String(b.next_service_date || "")));
  }, [equipment]);

  return (
    <div>
      <h2>Equipment Maintenance</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Equipment" value={equipment.length} />
        <StatCard title="Due" value={rows.filter((item) => item.computedStatus === "Due").length} />
        <StatCard title="Down" value={rows.filter((item) => item.status === "Down").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Equipment</h3>

        <div style={gridStyle}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Type
            <select value={form.equipment_type} onChange={(e) => setForm((p) => ({ ...p, equipment_type: e.target.value }))} style={inputStyle}>
              {TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          <label>
            Serial #
            <input value={form.serial_number} onChange={(e) => setForm((p) => ({ ...p, serial_number: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Location
            <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Interval Days
            <input type="number" value={form.interval_days} onChange={(e) => setForm((p) => ({ ...p, interval_days: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Last Service
            <input type="date" value={form.last_service_date} onChange={(e) => setForm((p) => ({ ...p, last_service_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Next Service
            <input type="date" value={form.next_service_date} onChange={(e) => setForm((p) => ({ ...p, next_service_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addEquipment}>Save Equipment</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Equipment</th>
            <th>Type</th>
            <th>Location</th>
            <th>Last Service</th>
            <th>Next Service</th>
            <th>Notes</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateEquipment(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
                <br />
                <small style={{ color: item.computedStatus === "Due" ? "red" : "green" }}>{item.computedStatus}</small>
              </td>
              <td>{item.name}<br /><small>{item.serial_number || ""}</small></td>
              <td>{item.equipment_type}</td>
              <td>{item.location || "-"}</td>
              <td>{item.last_service_date || "-"}</td>
              <td>{item.next_service_date || "-"}</td>
              <td>{item.notes || "-"}</td>
              <td><button type="button" onClick={() => markServiced(item)}>Mark Serviced</button></td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No equipment records.</td></tr>}
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

export default EquipmentMaintenanceManager;
