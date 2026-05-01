import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Open", "Ordered", "Backordered", "Substitute Found", "Resolved", "Cancelled"];

function PartsShortageBoardManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [parts, setParts] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    part_number: "",
    description: "",
    quantity_needed: "1",
    status: "Open",
    eta: "",
    supplier: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, partsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_shortage_board_json").maybeSingle()
    ]);

    if (jobsResult.error || partsResult.error) {
      setMessage(jobsResult.error?.message || partsResult.error?.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setParts(partsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setShortages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setShortages([]);
    }
  };

  const saveShortages = async (nextShortages) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "parts_shortage_board_json",
        setting_value: JSON.stringify(nextShortages, null, 2),
        description: "Parts shortage board records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setShortages(nextShortages);
    return true;
  };

  const addShortage = async () => {
    setMessage("");

    if (!form.invoice_id || (!form.part_number && !form.description)) {
      setMessage("Job and part info are required.");
      return;
    }

    const job = jobs.find((item) => item.id === form.invoice_id);

    const shortage = {
      id: `shortage_${Date.now()}`,
      ...form,
      quantity_needed: Number(form.quantity_needed || 1),
      document_number: job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      customer_name: job?.customer_name || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveShortages([shortage, ...shortages]);

    if (!saved) return;

    await supabase.from("invoices").update({
      status: "Waiting Parts",
      updated_at: new Date().toISOString()
    }).eq("id", form.invoice_id);

    await supabase.from("audit_logs").insert({
      action: "Parts Shortage Created",
      table_name: "app_settings",
      record_id: shortage.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${shortage.part_number || shortage.description} shortage for ${shortage.document_number}`
    });

    setMessage("Shortage saved.");
    setForm({
      invoice_id: "",
      part_number: "",
      description: "",
      quantity_needed: "1",
      status: "Open",
      eta: "",
      supplier: "",
      notes: ""
    });
  };

  const updateShortage = async (id, updates) => {
    const next = shortages.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveShortages(next);
    if (saved) setMessage("Shortage updated.");
  };

  const rows = useMemo(() => {
    return shortages.map((shortage) => {
      const stock = parts
        .filter((part) => part.part_number === shortage.part_number)
        .reduce((sum, part) => sum + Number(part.quantity || 0), 0);

      return {
        ...shortage,
        stock,
        stillShort: stock < Number(shortage.quantity_needed || 0)
      };
    });
  }, [shortages, parts]);

  return (
    <div>
      <h2>Parts Shortage Board</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open Shortages" value={rows.filter((row) => !["Resolved", "Cancelled"].includes(row.status)).length} />
        <StatCard title="Backordered" value={rows.filter((row) => row.status === "Backordered").length} />
        <StatCard title="Stock Still Short" value={rows.filter((row) => row.stillShort && row.status !== "Resolved").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Shortage</h3>

        <div style={gridStyle}>
          <label>
            Job
            <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
              <option value="">Select job</option>
              {jobs.slice(0, 300).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Part #
            <input value={form.part_number} onChange={(e) => setForm((p) => ({ ...p, part_number: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Description
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Qty Needed
            <input type="number" value={form.quantity_needed} onChange={(e) => setForm((p) => ({ ...p, quantity_needed: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            ETA
            <input value={form.eta} onChange={(e) => setForm((p) => ({ ...p, eta: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Supplier
            <input value={form.supplier} onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addShortage}>Save Shortage</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Job</th>
            <th>Customer</th>
            <th>Part</th>
            <th>Needed</th>
            <th>Stock</th>
            <th>ETA</th>
            <th>Supplier</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <select value={row.status} onChange={(e) => updateShortage(row.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{row.document_number || "-"}</td>
              <td>{row.customer_name || "-"}</td>
              <td>{row.part_number || "-"}<br /><small>{row.description || ""}</small></td>
              <td>{row.quantity_needed}</td>
              <td style={{ color: row.stillShort ? "red" : "green" }}>{row.stock}</td>
              <td>{row.eta || "-"}</td>
              <td>{row.supplier || "-"}</td>
              <td>{row.notes || "-"}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No shortages.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PartsShortageBoardManager;
