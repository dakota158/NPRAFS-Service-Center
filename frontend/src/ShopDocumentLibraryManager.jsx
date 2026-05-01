import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CATEGORIES = ["Policy", "Procedure", "Warranty", "Supplier", "HR", "Safety", "Template", "Other"];

function ShopDocumentLibraryManager({ user, canEditEverything }) {
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "Procedure",
    description: "",
    link: "",
    content: "",
    version: "1.0",
    active: true
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "shop_document_library_json")
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
        setting_key: "shop_document_library_json",
        setting_value: JSON.stringify(nextDocuments, null, 2),
        description: "Shop document library records",
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

    if (!form.title) {
      setMessage("Document title is required.");
      return;
    }

    const documentRecord = {
      id: `library_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveDocuments([documentRecord, ...documents]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Shop Document Created",
      table_name: "app_settings",
      record_id: documentRecord.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${documentRecord.title} v${documentRecord.version}`
    });

    setMessage("Document saved.");
    setForm({
      title: "",
      category: "Procedure",
      description: "",
      link: "",
      content: "",
      version: "1.0",
      active: true
    });
  };

  const updateDocument = async (id, updates) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can edit documents.");
      return;
    }

    const next = documents.map((documentRecord) =>
      documentRecord.id === id
        ? { ...documentRecord, ...updates, updated_at: new Date().toISOString() }
        : documentRecord
    );

    const saved = await saveDocuments(next);
    if (saved) setMessage("Document updated.");
  };

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return documents
      .filter((documentRecord) => documentRecord.active || search)
      .filter((documentRecord) => {
        if (!term) return true;
        return [documentRecord.title, documentRecord.category, documentRecord.description, documentRecord.content]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
  }, [documents, search]);

  const copyDocument = async (documentRecord) => {
    const text = `${documentRecord.title}
Category: ${documentRecord.category}
Version: ${documentRecord.version}

${documentRecord.content || documentRecord.description || documentRecord.link || ""}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Document copied.");
    } catch {
      setMessage("Could not copy document.");
    }
  };

  return (
    <div>
      <h2>Shop Document Library</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Add Document</h3>

        <div style={gridStyle}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>

          <label>
            Version
            <input value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} style={inputStyle} />
          </label>

          <label style={{ marginTop: 28 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} /> Active
          </label>
        </div>

        <label>
          Description
          <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
        </label>

        <label>
          Link / Path
          <input value={form.link} onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} style={inputStyle} />
        </label>

        <label>
          Document Content / Notes
          <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addDocument}>Save Document</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search documents..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <div style={cardGrid}>
        {filteredDocuments.map((documentRecord) => (
          <div key={documentRecord.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{documentRecord.title}</h3>
            <p><strong>{documentRecord.category}</strong> | v{documentRecord.version}</p>
            <p>{documentRecord.description}</p>
            {documentRecord.link && <p><strong>Link:</strong> {documentRecord.link}</p>}
            {documentRecord.content && <pre style={preStyle}>{documentRecord.content}</pre>}
            <button type="button" onClick={() => copyDocument(documentRecord)}>Copy</button>{" "}
            {canEditEverything && (
              <button type="button" onClick={() => updateDocument(documentRecord.id, { active: !documentRecord.active })}>
                {documentRecord.active ? "Archive" : "Restore"}
              </button>
            )}
          </div>
        ))}

        {filteredDocuments.length === 0 && <p>No documents found.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 100 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 };
const preStyle = { background: "#f8fafc", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit" };

export default ShopDocumentLibraryManager;
