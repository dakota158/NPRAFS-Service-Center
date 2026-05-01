import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function WarrantyManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    part_number: "",
    description: "",
    warranty_type: "Parts",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    mileage_limit: "",
    notes: "",
    status: "Active"
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "warranty_records_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setWarranties(Array.isArray(parsed) ? parsed : []);
    } catch {
      setWarranties([]);
    }
  };

  const saveWarranties = async (nextWarranties) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "warranty_records_json",
        setting_value: JSON.stringify(nextWarranties, null, 2),
        description: "Warranty records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setWarranties(nextWarranties);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc && !next.description) {
          next.description = `Warranty for ${doc.invoice_number || doc.repair_order_number || doc.estimate_number}`;
        }
      }

      return next;
    });
  };

  const createWarranty = async () => {
    setMessage("");

    if (!form.description) {
      setMessage("Warranty description is required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const warranty = {
      id: `warranty_${Date.now()}`,
      ...form,
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      customer_name: doc?.customer_name || "",
      vehicle_name: [doc?.vehicle_year, doc?.vehicle_make, doc?.vehicle_model].filter(Boolean).join(" "),
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveWarranties([warranty, ...warranties]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Warranty Created",
      table_name: "app_settings",
      record_id: warranty.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created warranty ${warranty.description}`
    });

    setMessage("Warranty record created.");
    setForm({
      invoice_id: "",
      part_number: "",
      description: "",
      warranty_type: "Parts",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      mileage_limit: "",
      notes: "",
      status: "Active"
    });
  };

  const updateWarranty = async (warrantyId, updates) => {
    const next = warranties.map((item) =>
      item.id === warrantyId ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveWarranties(next);
    if (saved) setMessage("Warranty updated.");
  };

  const activeWarranties = useMemo(
    () => warranties.filter((item) => item.status === "Active"),
    [warranties]
  );

  const expiredWarranties = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return warranties.filter((item) => item.end_date && item.end_date < today);
  }, [warranties]);

  return (
    <div>
      <h2>Warranty Tracking</h2>

      {message && <p style={{ color: message.includes("created") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Active" value={activeWarranties.length} />
        <StatCard title="Expired" value={expiredWarranties.length} />
        <StatCard title="Total Records" value={warranties.length} />
      </div>

      <div style={panelStyle}>
        <h3>Create Warranty Record</h3>

        <div style={gridStyle}>
          <label>
            Related Invoice / RO
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">No linked document</option>
              {documents.slice(0, 200).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Warranty Type
            <select value={form.warranty_type} onChange={(e) => updateForm("warranty_type", e.target.value)} style={inputStyle}>
              <option>Parts</option>
              <option>Labor</option>
              <option>Parts & Labor</option>
              <option>Manufacturer</option>
              <option>Shop Goodwill</option>
            </select>
          </label>

          <label>
            Part Number
            <input value={form.part_number} onChange={(e) => updateForm("part_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Description
            <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Start Date
            <input type="date" value={form.start_date} onChange={(e) => updateForm("start_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            End Date
            <input type="date" value={form.end_date} onChange={(e) => updateForm("end_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Mileage Limit
            <input value={form.mileage_limit} onChange={(e) => updateForm("mileage_limit", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              <option>Active</option>
              <option>Expired</option>
              <option>Claimed</option>
              <option>Denied</option>
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={createWarranty}>Create Warranty</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Type</th>
            <th>Customer / Vehicle</th>
            <th>Document</th>
            <th>Description</th>
            <th>Dates</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {warranties.map((warranty) => (
            <tr key={warranty.id}>
              <td>
                <select value={warranty.status} onChange={(e) => updateWarranty(warranty.id, { status: e.target.value })} style={inputStyle}>
                  <option>Active</option>
                  <option>Expired</option>
                  <option>Claimed</option>
                  <option>Denied</option>
                </select>
              </td>
              <td>{warranty.warranty_type}</td>
              <td>{warranty.customer_name || "-"}<br /><small>{warranty.vehicle_name || ""}</small></td>
              <td>{warranty.document_number || "-"}</td>
              <td>{warranty.description}<br /><small>{warranty.part_number || ""}</small></td>
              <td>{warranty.start_date || "-"} to {warranty.end_date || "-"}<br /><small>{warranty.mileage_limit || ""}</small></td>
              <td>{warranty.notes || "-"}</td>
            </tr>
          ))}

          {warranties.length === 0 && (
            <tr><td colSpan="7" style={{ textAlign: "center" }}>No warranty records.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default WarrantyManager;
