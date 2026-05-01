import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const REASONS = ["Price", "Customer Delayed", "No Response", "Went Elsewhere", "Parts Availability", "Warranty/Insurance", "Other"];

function LostSalesManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [lostSales, setLostSales] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    customer_name: "",
    document_number: "",
    amount: "",
    reason: "No Response",
    competitor: "",
    follow_up_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "lost_sales_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setLostSales(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLostSales([]);
    }
  };

  const saveLostSales = async (nextLostSales) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "lost_sales_json",
        setting_value: JSON.stringify(nextLostSales, null, 2),
        description: "Lost sales and declined work records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setLostSales(nextLostSales);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) {
          next.customer_name = doc.customer_name || "";
          next.document_number = doc.estimate_number || doc.repair_order_number || doc.invoice_number || "";
          next.amount = String(doc.grand_total || "");
        }
      }

      return next;
    });
  };

  const addLostSale = async () => {
    setMessage("");

    if (!form.customer_name || !form.amount) {
      setMessage("Customer and amount are required.");
      return;
    }

    const record = {
      id: `lost_${Date.now()}`,
      ...form,
      amount: Number(form.amount || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveLostSales([record, ...lostSales]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Lost Sale Recorded",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${record.customer_name} - $${record.amount} - ${record.reason}`
    });

    setMessage("Lost sale recorded.");
    setForm({
      invoice_id: "",
      customer_name: "",
      document_number: "",
      amount: "",
      reason: "No Response",
      competitor: "",
      follow_up_date: "",
      notes: ""
    });
  };

  const reasonTotals = useMemo(() => {
    const totals = {};
    lostSales.forEach((record) => {
      totals[record.reason] = (totals[record.reason] || 0) + Number(record.amount || 0);
    });
    return totals;
  }, [lostSales]);

  const copyFollowUp = async (record) => {
    const text = `Hello ${record.customer_name || ""},

We wanted to follow up on your estimate/work recommendation ${record.document_number || ""}. If timing or price was a concern, we would be happy to review options with you.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Follow-up message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  return (
    <div>
      <h2>Lost Sales / Declined Work</h2>

      {message && (
        <p style={{ color: message.includes("recorded") || message.includes("copied") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Records" value={lostSales.length} />
        <StatCard title="Lost Value" value={`$${lostSales.reduce((s, r) => s + Number(r.amount || 0), 0).toFixed(2)}`} />
        <StatCard title="Follow Ups" value={lostSales.filter((item) => item.follow_up_date).length} />
      </div>

      <div style={panelStyle}>
        <h3>Record Lost Sale</h3>

        <div style={gridStyle}>
          <label>
            Related Estimate / Document
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">Manual entry</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.estimate_number || doc.repair_order_number || doc.invoice_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Customer
            <input value={form.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Document #
            <input value={form.document_number} onChange={(e) => updateForm("document_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Amount
            <input type="number" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Reason
            <select value={form.reason} onChange={(e) => updateForm("reason", e.target.value)} style={inputStyle}>
              {REASONS.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>

          <label>
            Competitor
            <input value={form.competitor} onChange={(e) => updateForm("competitor", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Follow-Up Date
            <input type="date" value={form.follow_up_date} onChange={(e) => updateForm("follow_up_date", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addLostSale}>Save Lost Sale</button>
      </div>

      <div style={panelStyle}>
        <h3>Lost Value by Reason</h3>
        {Object.entries(reasonTotals).map(([reason, total]) => (
          <p key={reason}><strong>{reason}:</strong> ${total.toFixed(2)}</p>
        ))}
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Document</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Competitor</th>
            <th>Follow Up</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {lostSales.map((record) => (
            <tr key={record.id}>
              <td>{record.customer_name}</td>
              <td>{record.document_number || "-"}</td>
              <td>${Number(record.amount || 0).toFixed(2)}</td>
              <td>{record.reason}</td>
              <td>{record.competitor || "-"}</td>
              <td>{record.follow_up_date || "-"}</td>
              <td><button type="button" onClick={() => copyFollowUp(record)}>Copy Follow-Up</button></td>
            </tr>
          ))}

          {lostSales.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No lost sales recorded.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default LostSalesManager;
