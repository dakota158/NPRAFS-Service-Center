import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_TEMPLATES = [
  {
    id: "general_inspection",
    title: "General Vehicle Inspection",
    category: "General",
    items: [
      "Check engine oil",
      "Check coolant",
      "Check brake fluid",
      "Inspect tires",
      "Inspect brakes",
      "Check lights",
      "Road test"
    ],
    notes: "Standard inspection template"
  },
  {
    id: "pre_trip",
    title: "Pre-Trip Inspection",
    category: "Fleet",
    items: [
      "Tires and wheels",
      "Lights and signals",
      "Brakes",
      "Steering/suspension",
      "Fluids",
      "Safety equipment"
    ],
    notes: "Fleet pre-trip checklist"
  }
];

function InspectionTemplateManager({ user, canEditEverything }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    itemsText: "",
    notes: ""
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "inspection_templates_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) setTemplates(parsed);
    } catch {
      setTemplates(DEFAULT_TEMPLATES);
    }
  };

  const saveTemplates = async (nextTemplates) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "inspection_templates_json",
        setting_value: JSON.stringify(nextTemplates, null, 2),
        description: "Vehicle inspection checklist templates",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setTemplates(nextTemplates);
    return true;
  };

  const addTemplate = async () => {
    setMessage("");

    if (!form.title || !form.itemsText) {
      setMessage("Title and inspection items are required.");
      return;
    }

    const template = {
      id: `inspection_${Date.now()}`,
      title: form.title,
      category: form.category || "General",
      items: form.itemsText.split("\n").map((item) => item.trim()).filter(Boolean),
      notes: form.notes,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveTemplates([template, ...templates]);

    if (!saved) return;

    setMessage("Inspection template saved.");
    setForm({
      title: "",
      category: "",
      itemsText: "",
      notes: ""
    });
  };

  const deleteTemplate = async (id) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can delete templates.");
      return;
    }

    const saved = await saveTemplates(templates.filter((template) => template.id !== id));
    if (saved) setMessage("Inspection template deleted.");
  };

  const copyTemplate = async (template) => {
    const text = `${template.title}
${(template.items || []).map((item) => `☐ ${item}`).join("\n")}
Notes: ${template.notes || ""}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Inspection copied.");
    } catch {
      setMessage("Could not copy inspection.");
    }
  };

  const totalItems = useMemo(
    () => templates.reduce((sum, template) => sum + (template.items?.length || 0), 0),
    [templates]
  );

  return (
    <div>
      <h2>Inspection Templates</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("deleted") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGridStats}>
        <StatCard title="Templates" value={templates.length} />
        <StatCard title="Checklist Items" value={totalItems} />
      </div>

      <div style={panelStyle}>
        <h3>Add Inspection Template</h3>

        <div style={gridStyle}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Items
          <textarea
            value={form.itemsText}
            onChange={(e) => setForm((p) => ({ ...p, itemsText: e.target.value }))}
            placeholder="One checklist item per line"
            style={textareaStyle}
          />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addTemplate}>Save Inspection Template</button>
      </div>

      <div style={templateGrid}>
        {templates.map((template) => (
          <div key={template.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{template.title}</h3>
            <p><strong>{template.category}</strong></p>
            <ul>
              {(template.items || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p>{template.notes || ""}</p>
            <button type="button" onClick={() => copyTemplate(template)}>Copy Checklist</button>{" "}
            {canEditEverything && <button type="button" onClick={() => deleteTemplate(template.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 100, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const templateGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 };
const cardGridStats = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default InspectionTemplateManager;
