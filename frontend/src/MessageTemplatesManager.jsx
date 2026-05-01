import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_TEMPLATES = [
  {
    id: "vehicle_ready",
    name: "Vehicle Ready",
    subject: "Your vehicle is ready",
    body: "Hello {customer_name}, your {vehicle} is ready for pickup. Total due: {balance_due}. Thank you."
  },
  {
    id: "estimate_followup",
    name: "Estimate Follow Up",
    subject: "Following up on your estimate",
    body: "Hello {customer_name}, we are following up on estimate {document_number}. Please contact us with any questions."
  },
  {
    id: "payment_reminder",
    name: "Payment Reminder",
    subject: "Payment reminder",
    body: "Hello {customer_name}, this is a reminder that your balance due is {balance_due} for {document_number}."
  }
];

function MessageTemplatesManager({ user, canEditEverything }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    subject: "",
    body: ""
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "message_templates_json")
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
        setting_key: "message_templates_json",
        setting_value: JSON.stringify(nextTemplates, null, 2),
        description: "Customer message templates",
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

    if (!form.name || !form.body) {
      setMessage("Template name and body are required.");
      return;
    }

    const template = {
      id: `template_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveTemplates([template, ...templates]);

    if (!saved) return;

    setMessage("Template saved.");
    setForm({ name: "", subject: "", body: "" });
  };

  const deleteTemplate = async (templateId) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can delete templates.");
      return;
    }

    const saved = await saveTemplates(templates.filter((item) => item.id !== templateId));
    if (saved) setMessage("Template deleted.");
  };

  const copyTemplate = async (template) => {
    try {
      await navigator.clipboard.writeText(`${template.subject}\n\n${template.body}`);
      setMessage("Template copied.");
    } catch {
      setMessage("Could not copy template.");
    }
  };

  return (
    <div>
      <h2>Message Templates</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("copied") || message.includes("deleted") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Add Template</h3>

        <div style={gridStyle}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Subject
            <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Body
          <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} style={textareaStyle} />
        </label>

        <p>
          Placeholders: {"{customer_name}"}, {"{vehicle}"}, {"{document_number}"}, {"{balance_due}"}
        </p>

        <button type="button" onClick={addTemplate}>Save Template</button>
      </div>

      <div style={cardGrid}>
        {templates.map((template) => (
          <div key={template.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{template.name}</h3>
            <p><strong>Subject:</strong> {template.subject || "-"}</p>
            <pre style={preStyle}>{template.body}</pre>
            <button type="button" onClick={() => copyTemplate(template)}>Copy</button>{" "}
            {canEditEverything && <button type="button" onClick={() => deleteTemplate(template.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 130, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 };
const preStyle = { background: "#f8fafc", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit" };

export default MessageTemplatesManager;
