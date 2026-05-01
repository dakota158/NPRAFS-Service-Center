import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Open", "Investigating", "Resolved", "Warranty", "Customer Declined", "Closed"];

function ComebackManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [comebacks, setComebacks] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    issue: "",
    cause: "",
    resolution: "",
    status: "Open",
    severity: "Medium",
    assigned_to: "",
    warranty_related: false
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "comebacks_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setComebacks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setComebacks([]);
    }
  };

  const saveComebacks = async (nextComebacks) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "comebacks_json",
        setting_value: JSON.stringify(nextComebacks, null, 2),
        description: "Comeback / recheck tracking",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setComebacks(nextComebacks);
    return true;
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const createComeback = async () => {
    setMessage("");

    if (!form.issue) {
      setMessage("Issue is required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const comeback = {
      id: `comeback_${Date.now()}`,
      ...form,
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      customer_name: doc?.customer_name || "",
      vehicle_name: [doc?.vehicle_year, doc?.vehicle_make, doc?.vehicle_model].filter(Boolean).join(" "),
      technician_name: doc?.technician_name || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveComebacks([comeback, ...comebacks]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Comeback Created",
      table_name: "app_settings",
      record_id: comeback.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Comeback created for ${comeback.document_number || comeback.customer_name}`
    });

    setMessage("Comeback recorded.");
    setForm({
      invoice_id: "",
      issue: "",
      cause: "",
      resolution: "",
      status: "Open",
      severity: "Medium",
      assigned_to: "",
      warranty_related: false
    });
  };

  const updateComeback = async (id, updates) => {
    const next = comebacks.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveComebacks(next);
    if (saved) setMessage("Comeback updated.");
  };

  const openCount = useMemo(
    () => comebacks.filter((item) => !["Resolved", "Closed"].includes(item.status)).length,
    [comebacks]
  );

  return (
    <div>
      <h2>Comeback Tracking</h2>

      {message && <p style={{ color: message.includes("recorded") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open" value={openCount} />
        <StatCard title="Warranty Related" value={comebacks.filter((item) => item.warranty_related).length} />
        <StatCard title="Total" value={comebacks.length} />
      </div>

      <div style={panelStyle}>
        <h3>Record Comeback</h3>

        <div style={gridStyle}>
          <label>
            Original Document
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">No linked document</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Severity
            <select value={form.severity} onChange={(e) => updateForm("severity", e.target.value)} style={inputStyle}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Assigned To
            <input value={form.assigned_to} onChange={(e) => updateForm("assigned_to", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Issue
          <textarea value={form.issue} onChange={(e) => updateForm("issue", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Cause
          <textarea value={form.cause} onChange={(e) => updateForm("cause", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Resolution
          <textarea value={form.resolution} onChange={(e) => updateForm("resolution", e.target.value)} style={textareaStyle} />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={form.warranty_related} onChange={(e) => updateForm("warranty_related", e.target.checked)} /> Warranty related
        </label>

        <button type="button" onClick={createComeback}>Save Comeback</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Severity</th>
            <th>Customer / Vehicle</th>
            <th>Document</th>
            <th>Issue</th>
            <th>Cause</th>
            <th>Resolution</th>
          </tr>
        </thead>

        <tbody>
          {comebacks.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateComeback(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.severity}</td>
              <td>{item.customer_name || "-"}<br /><small>{item.vehicle_name || ""}</small></td>
              <td>{item.document_number || "-"}</td>
              <td>{item.issue}</td>
              <td>{item.cause || "-"}</td>
              <td>{item.resolution || "-"}</td>
            </tr>
          ))}
          {comebacks.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No comebacks recorded.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default ComebackManager;
