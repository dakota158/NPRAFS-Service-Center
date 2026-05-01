import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CustomerSatisfactionManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    rating: "5",
    would_return: true,
    feedback: "",
    issue_resolved: true
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_satisfaction_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setSurveys(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSurveys([]);
    }
  };

  const saveSurveys = async (nextSurveys) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_satisfaction_json",
        setting_value: JSON.stringify(nextSurveys, null, 2),
        description: "Customer satisfaction feedback",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setSurveys(nextSurveys);
    return true;
  };

  const saveSurvey = async () => {
    setMessage("");

    const doc = documents.find((item) => item.id === form.invoice_id);

    if (!doc) {
      setMessage("Select a document first.");
      return;
    }

    const survey = {
      id: `survey_${Date.now()}`,
      ...form,
      rating: Number(form.rating || 0),
      document_number: doc.invoice_number || doc.repair_order_number || doc.estimate_number || "",
      customer_name: doc.customer_name || "",
      customer_phone: doc.customer_phone || "",
      customer_email: doc.customer_email || "",
      vehicle_name: [doc.vehicle_year, doc.vehicle_make, doc.vehicle_model].filter(Boolean).join(" "),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveSurveys([survey, ...surveys]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Customer Satisfaction Saved",
      table_name: "app_settings",
      record_id: survey.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Saved satisfaction rating ${survey.rating} for ${survey.customer_name}`
    });

    setMessage("Feedback saved.");
    setForm({
      invoice_id: "",
      rating: "5",
      would_return: true,
      feedback: "",
      issue_resolved: true
    });
  };

  const averageRating = useMemo(
    () =>
      surveys.length
        ? surveys.reduce((sum, survey) => sum + Number(survey.rating || 0), 0) / surveys.length
        : 0,
    [surveys]
  );

  const copySurveyRequest = async (doc) => {
    const text = `Hello ${doc.customer_name || ""},

Thank you for trusting us with your vehicle. We would appreciate your feedback on your recent visit for ${doc.invoice_number || doc.repair_order_number || ""}.

Please reply with a rating from 1-5 and any comments about your experience.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Survey request copied.");
    } catch {
      setMessage("Could not copy request.");
    }
  };

  return (
    <div>
      <h2>Customer Satisfaction</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Responses" value={surveys.length} />
        <StatCard title="Average Rating" value={averageRating.toFixed(1)} />
        <StatCard title="Would Return" value={surveys.filter((s) => s.would_return).length} />
      </div>

      <div style={panelStyle}>
        <h3>Record Feedback</h3>

        <label>
          Document
          <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
            <option value="">Select invoice/RO</option>
            {documents.slice(0, 300).map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"}
              </option>
            ))}
          </select>
        </label>

        <div style={gridStyle}>
          <label>
            Rating
            <select value={form.rating} onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))} style={inputStyle}>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Bad</option>
            </select>
          </label>

          <label style={{ marginTop: 28 }}>
            <input type="checkbox" checked={form.would_return} onChange={(e) => setForm((p) => ({ ...p, would_return: e.target.checked }))} /> Would return
          </label>

          <label style={{ marginTop: 28 }}>
            <input type="checkbox" checked={form.issue_resolved} onChange={(e) => setForm((p) => ({ ...p, issue_resolved: e.target.checked }))} /> Issue resolved
          </label>
        </div>

        <label>
          Feedback
          <textarea value={form.feedback} onChange={(e) => setForm((p) => ({ ...p, feedback: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={saveSurvey}>Save Feedback</button>
      </div>

      <h3>Recent Documents</h3>
      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Document</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Request</th>
          </tr>
        </thead>
        <tbody>
          {documents.slice(0, 12).map((doc) => (
            <tr key={doc.id}>
              <td>{doc.invoice_number || doc.repair_order_number || doc.estimate_number}</td>
              <td>{doc.customer_name || "-"}</td>
              <td>${Number(doc.grand_total || 0).toFixed(2)}</td>
              <td><button type="button" onClick={() => copySurveyRequest(doc)}>Copy Survey Request</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Feedback Log</h3>
      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Rating</th>
            <th>Customer</th>
            <th>Document</th>
            <th>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {surveys.map((survey) => (
            <tr key={survey.id}>
              <td>{survey.created_at ? new Date(survey.created_at).toLocaleString() : "-"}</td>
              <td>{survey.rating}</td>
              <td>{survey.customer_name || "-"}</td>
              <td>{survey.document_number || "-"}</td>
              <td>{survey.feedback || "-"}</td>
            </tr>
          ))}
          {surveys.length === 0 && <tr><td colSpan="5" style={{ textAlign: "center" }}>No feedback yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 80 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse", marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CustomerSatisfactionManager;
