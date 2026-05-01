import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CATEGORIES = ["Policy", "Procedure", "Checklist", "Vendor", "Training", "Other"];

function ShopDocumentsManager({ user, canEditEverything }) {
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "Procedure",
    content: "",
    link: ""
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "shop_documents_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setDocuments(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDocuments([]);
    }
  };

  const saveDocuments = async (nextDocuments) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "shop_documents_json",
        setting_value: JSON.stringify(nextDocuments, null, 2),
        description: "Shop SOPs, procedures, and notes",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setDocuments(nextDocuments);
    return true;
  };

  const addDocument = async () => {
    setMessage("");

    if (!form.title || !form.content) {
      setMessage("Title and content are required.");
      return;
    }

    const doc = {
      id: `doc_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveDocuments([doc, ...documents]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Shop Document Created",
      table_name: "app_settings",
      record_id: doc.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created shop document ${doc.title}`
    });

    setMessage("Shop document saved.");
    setForm({ title: "", category: "Procedure", content: "", link: "" });
  };

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return documents.filter((doc) => {
      if (categoryFilter && doc.category !== categoryFilter) return false;

      if (!term) return true;

      return [doc.title, doc.category, doc.content, doc.link]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [documents, search, categoryFilter]);

  const deleteDocument = async (docId) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can delete shop documents.");
      return;
    }

    const saved = await saveDocuments(documents.filter((doc) => doc.id !== docId));
    if (saved) setMessage("Document deleted.");
  };

  return (
    <div>
      <h2>Shop Documents / SOPs</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("deleted") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Add Shop Document</h3>

        <div style={gridStyle}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle}>
              {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
            </select>
          </label>

          <label>
            Link / URL
            <input value={form.link} onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Content
          <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addDocument}>Save Document</button>
      </div>

      <div style={gridStyle}>
        <label>
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </label>

        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
            <option value="">All categories</option>
            {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
          </select>
        </label>
      </div>

      <div style={cardGrid}>
        {filteredDocuments.map((doc) => (
          <div key={doc.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{doc.title}</h3>
            <p><strong>{doc.category}</strong></p>
            {doc.link && <p><a href={doc.link} target="_blank" rel="noreferrer">{doc.link}</a></p>}
            <pre style={preStyle}>{doc.content}</pre>
            <small>{doc.created_at ? new Date(doc.created_at).toLocaleString() : ""}</small>
            <br />
            {canEditEverything && <button type="button" onClick={() => deleteDocument(doc.id)} style={{ marginTop: 8 }}>Delete</button>}
          </div>
        ))}

        {filteredDocuments.length === 0 && <p>No shop documents found.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 140, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 };
const preStyle = { background: "#f8fafc", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit" };

export default ShopDocumentsManager;
