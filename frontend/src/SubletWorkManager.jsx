import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Quoted", "Approved", "Sent Out", "In Progress", "Returned", "Billed", "Cancelled"];

function SubletWorkManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [sublets, setSublets] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    vendor_name: "",
    work_type: "",
    description: "",
    quoted_cost: "",
    customer_price: "",
    status: "Quoted",
    sent_date: "",
    expected_return_date: "",
    returned_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, subletsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "sublet_work_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(subletsResult.data?.setting_value || "[]");
      setSublets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSublets([]);
    }
  };

  const saveSublets = async (nextSublets) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "sublet_work_json",
        setting_value: JSON.stringify(nextSublets, null, 2),
        description: "Subcontracted/sublet work records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setSublets(nextSublets);
    return true;
  };

  const addSublet = async () => {
    setMessage("");

    if (!form.invoice_id || !form.vendor_name || !form.description) {
      setMessage("Job, vendor, and description are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const sublet = {
      id: `sublet_${Date.now()}`,
      ...form,
      quoted_cost: Number(form.quoted_cost || 0),
      customer_price: Number(form.customer_price || 0),
      document_number: doc?.repair_order_number || doc?.invoice_number || doc?.estimate_number || "",
      customer_name: doc?.customer_name || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveSublets([sublet, ...sublets]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Sublet Work Created",
      table_name: "app_settings",
      record_id: sublet.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${sublet.document_number} ${sublet.vendor_name}`
    });

    setMessage("Sublet work saved.");
    setForm({
      invoice_id: "",
      vendor_name: "",
      work_type: "",
      description: "",
      quoted_cost: "",
      customer_price: "",
      status: "Quoted",
      sent_date: "",
      expected_return_date: "",
      returned_date: "",
      notes: ""
    });
  };

  const updateSublet = async (id, updates) => {
    const next = sublets.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveSublets(next);
    if (saved) setMessage("Sublet updated.");
  };

  const totals = useMemo(
    () => ({
      open: sublets.filter((item) => !["Billed", "Cancelled"].includes(item.status)).length,
      cost: sublets.reduce((sum, item) => sum + Number(item.quoted_cost || 0), 0),
      price: sublets.reduce((sum, item) => sum + Number(item.customer_price || 0), 0)
    }),
    [sublets]
  );

  return (
    <div>
      <h2>Sublet / Subcontracted Work</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open" value={totals.open} />
        <StatCard title="Sublet Cost" value={`$${totals.cost.toFixed(2)}`} />
        <StatCard title="Customer Price" value={`$${totals.price.toFixed(2)}`} />
        <StatCard title="Gross" value={`$${(totals.price - totals.cost).toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Sublet Work</h3>

        <div style={gridStyle}>
          <label>
            Job
            <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
              <option value="">Select job</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.repair_order_number || doc.invoice_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vendor
            <input value={form.vendor_name} onChange={(e) => setForm((p) => ({ ...p, vendor_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Work Type
            <input value={form.work_type} onChange={(e) => setForm((p) => ({ ...p, work_type: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Cost
            <input type="number" value={form.quoted_cost} onChange={(e) => setForm((p) => ({ ...p, quoted_cost: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Customer Price
            <input type="number" value={form.customer_price} onChange={(e) => setForm((p) => ({ ...p, customer_price: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Sent Date
            <input type="date" value={form.sent_date} onChange={(e) => setForm((p) => ({ ...p, sent_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Expected Return
            <input type="date" value={form.expected_return_date} onChange={(e) => setForm((p) => ({ ...p, expected_return_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Returned
            <input type="date" value={form.returned_date} onChange={(e) => setForm((p) => ({ ...p, returned_date: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Description
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addSublet}>Save Sublet Work</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Job</th>
            <th>Vendor</th>
            <th>Work</th>
            <th>Cost</th>
            <th>Price</th>
            <th>Expected</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {sublets.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateSublet(item.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.document_number || "-"}<br /><small>{item.customer_name || ""}</small></td>
              <td>{item.vendor_name}</td>
              <td>{item.work_type || "-"}<br /><small>{item.description}</small></td>
              <td>${Number(item.quoted_cost || 0).toFixed(2)}</td>
              <td>${Number(item.customer_price || 0).toFixed(2)}</td>
              <td>{item.expected_return_date || "-"}</td>
              <td>{item.notes || "-"}</td>
            </tr>
          ))}

          {sublets.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No sublet work.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default SubletWorkManager;
