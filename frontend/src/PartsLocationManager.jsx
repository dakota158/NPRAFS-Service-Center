import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PartsLocationManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    part_id: "",
    part_number: "",
    description: "",
    aisle: "",
    shelf: "",
    bin: "",
    zone: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, settingsResult] = await Promise.all([
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_locations_json").maybeSingle()
    ]);

    if (partsResult.error) {
      setMessage(partsResult.error.message);
      return;
    }

    setParts(partsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setLocations(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLocations([]);
    }
  };

  const saveLocations = async (nextLocations) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "parts_locations_json",
        setting_value: JSON.stringify(nextLocations, null, 2),
        description: "Parts bin and location map records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setLocations(nextLocations);
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

  const saveLocation = async () => {
    setMessage("");

    if (!form.part_number) {
      setMessage("Part is required.");
      return;
    }

    const existing = locations.find((item) => item.part_number === form.part_number);

    const location = {
      id: existing?.id || `location_${Date.now()}`,
      ...form,
      updated_by: user?.id || null,
      updated_by_email: user?.email || "",
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString()
    };

    const nextLocations = existing
      ? locations.map((item) => (item.id === existing.id ? location : item))
      : [location, ...locations];

    const saved = await saveLocations(nextLocations);

    if (!saved) return;

    setMessage("Part location saved.");
    setForm({
      part_id: "",
      part_number: "",
      description: "",
      aisle: "",
      shelf: "",
      bin: "",
      zone: "",
      notes: ""
    });
  };

  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return locations;

    return locations.filter((item) =>
      [item.part_number, item.description, item.aisle, item.shelf, item.bin, item.zone, item.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [locations, search]);

  const missingLocations = useMemo(
    () => parts.filter((part) => !locations.some((location) => location.part_number === part.part_number)),
    [parts, locations]
  );

  return (
    <div>
      <h2>Parts Bin / Location Map</h2>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Mapped Parts" value={locations.length} />
        <StatCard title="Missing Locations" value={missingLocations.length} />
        <StatCard title="Inventory Items" value={parts.length} />
      </div>

      <div style={panelStyle}>
        <h3>Add / Update Location</h3>

        <div style={gridStyle}>
          <label>
            Part
            <select value={form.part_id} onChange={(e) => updateForm("part_id", e.target.value)} style={inputStyle}>
              <option value="">Select part</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.part_number || "No Part #"} - {part.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Aisle
            <input value={form.aisle} onChange={(e) => updateForm("aisle", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Shelf
            <input value={form.shelf} onChange={(e) => updateForm("shelf", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Bin
            <input value={form.bin} onChange={(e) => updateForm("bin", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Zone
            <input value={form.zone} onChange={(e) => updateForm("zone", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={saveLocation}>Save Location</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search locations..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part</th>
            <th>Description</th>
            <th>Zone</th>
            <th>Aisle</th>
            <th>Shelf</th>
            <th>Bin</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {filteredLocations.map((item) => (
            <tr key={item.id}>
              <td>{item.part_number}</td>
              <td>{item.description}</td>
              <td>{item.zone || "-"}</td>
              <td>{item.aisle || "-"}</td>
              <td>{item.shelf || "-"}</td>
              <td>{item.bin || "-"}</td>
              <td>{item.notes || "-"}</td>
            </tr>
          ))}

          {filteredLocations.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No locations found.</td></tr>}
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PartsLocationManager;
