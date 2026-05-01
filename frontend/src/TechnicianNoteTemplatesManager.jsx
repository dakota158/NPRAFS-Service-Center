import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_TEMPLATES = [
  {
    id: "diag_template",
    title: "Diagnostic Notes",
    category: "Diagnostics",
    body: "Customer concern:\nVerified concern:\nTesting performed:\nFindings:\nRecommended repair:"
  },
  {
    id: "qc_template",
    title: "Final QC Notes",
    category: "Quality Control",
    body: "Work completed:\nRoad test result:\nFinal inspection:\nCustomer notes:"
  }
];

function TechnicianNoteTemplatesManager({ user, canEditEverything }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    body: ""
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "technician_note_templates_json")
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
        setting_key: "technician_note_templates_json",
        setting_value: JSON.stringify(nextTemplates, null, 2),
        description: "Technician reusable note templates",
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

    if (!form.title || !form.body) {
      setMessage("Title and template body are required.");
      return;
    }

    const template = {
      id: `template_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveTemplates([template, ...templates]);

    if (!saved) return;

    setMessage("Template saved.");
    setForm({ title: "", category: "", body: "" });
  };

  const deleteTemplate = async (id) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can delete templates.");
      return;
    }

    const saved = await saveTemplates(templates.filter((template) => template.id !== id));
    if (saved) setMessage("Template deleted.");
  };

  const copyTemplate = async (template) => {
    try {
      await navigator.clipboard.writeText(template.body || "");
      setMessage("Template copied.");
    } catch {
      setMessage("Could not copy template.");
    }
  };

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;

    return templates.filter((template) =>
      [template.title, template.category, template.body]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [templates, search]);

  return (
    <div>
      <h2>Technician Note Templates</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("copied") || message.includes("deleted") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Add Template</h3>

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
          Template Body
          <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addTemplate}>Save Template</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <div style={cardGrid}>
        {filteredTemplates.map((template) => (
          <div key={template.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{template.title}</h3>
            <p><strong>{template.category || "General"}</strong></p>
            <pre style={preStyle}>{template.body}</pre>
            <button type="button" onClick={() => copyTemplate(template)}>Copy</button>{" "}
            {canEditEverything && <button type="button" onClick={() => deleteTemplate(template.id)}>Delete</button>}
          </div>
        ))}

        {filteredTemplates.length === 0 && <p>No templates found.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 120, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 };
const preStyle = { background: "#f8fafc", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", fontFamily: "inherit" };

export default TechnicianNoteTemplatesManager;
