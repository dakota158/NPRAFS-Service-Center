import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_GUIDES = [
  { id: "diag", category: "Diagnostics", operation: "Diagnostic Testing", hours: 1, notes: "General diagnostic labor" },
  { id: "front_brakes", category: "Brakes", operation: "Front Brakes R&R", hours: 2, notes: "Pads and rotors as needed" },
  { id: "rear_brakes", category: "Brakes", operation: "Rear Brakes R&R", hours: 2, notes: "Pads/shoes and rotors/drums as needed" },
  { id: "oil", category: "Maintenance", operation: "Oil Change Service", hours: 0.5, notes: "Oil/filter service" }
];

function LaborGuideManager({ user, canEditEverything }) {
  const [guides, setGuides] = useState(DEFAULT_GUIDES);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    category: "",
    operation: "",
    hours: "",
    notes: ""
  });

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "labor_guide_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) setGuides(parsed);
    } catch {
      setGuides(DEFAULT_GUIDES);
    }
  };

  const saveGuides = async (nextGuides) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "labor_guide_json",
        setting_value: JSON.stringify(nextGuides, null, 2),
        description: "Labor operation guide presets",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setGuides(nextGuides);
    return true;
  };

  const addGuide = async () => {
    setMessage("");

    if (!form.operation || !form.hours) {
      setMessage("Operation and hours are required.");
      return;
    }

    const guide = {
      id: `labor_${Date.now()}`,
      category: form.category || "General",
      operation: form.operation,
      hours: Number(form.hours || 0),
      notes: form.notes,
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveGuides([guide, ...guides]);

    if (!saved) return;

    setMessage("Labor guide saved.");
    setForm({ category: "", operation: "", hours: "", notes: "" });
  };

  const copyGuide = async (guide) => {
    const text = `Labor - ${guide.operation} - ${guide.hours} Hours`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Labor line copied.");
    } catch {
      setMessage("Could not copy labor line.");
    }
  };

  const deleteGuide = async (guideId) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can delete guide entries.");
      return;
    }

    const saved = await saveGuides(guides.filter((guide) => guide.id !== guideId));
    if (saved) setMessage("Labor guide deleted.");
  };

  const filteredGuides = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guides;

    return guides.filter((guide) =>
      [guide.category, guide.operation, guide.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [guides, search]);

  return (
    <div>
      <h2>Labor Guide</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("copied") || message.includes("deleted") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Add Labor Preset</h3>

        <div style={gridStyle}>
          <label>
            Category
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Operation
            <input value={form.operation} onChange={(e) => setForm((p) => ({ ...p, operation: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Hours
            <input type="number" value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Notes
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <button type="button" onClick={addGuide}>Save Labor Preset</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search labor guide..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <div style={cardGrid}>
        {filteredGuides.map((guide) => (
          <div key={guide.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{guide.operation}</h3>
            <p><strong>Category:</strong> {guide.category}</p>
            <p><strong>Hours:</strong> {guide.hours}</p>
            <p>{guide.notes || ""}</p>
            <button type="button" onClick={() => copyGuide(guide)}>Copy Labor Line</button>{" "}
            {canEditEverything && <button type="button" onClick={() => deleteGuide(guide.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 };

export default LaborGuideManager;
