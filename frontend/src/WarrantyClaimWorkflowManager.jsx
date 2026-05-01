import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CLAIM_STATUSES = ["Open", "Submitted", "Approved", "Denied", "Paid", "Closed"];
const CLAIM_TYPES = ["Parts", "Labor", "Parts + Labor", "Comeback", "Supplier", "Manufacturer"];

function WarrantyClaimWorkflowManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [claims, setClaims] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    claim_type: "Parts + Labor",
    status: "Open",
    claim_number: "",
    vendor_or_manufacturer: "",
    amount_requested: "",
    amount_approved: "",
    failure_description: "",
    corrective_action: "",
    submitted_date: "",
    expected_response_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "warranty_claim_workflow_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setClaims(Array.isArray(parsed) ? parsed : []);
    } catch {
      setClaims([]);
    }
  };

  const saveClaims = async (nextClaims) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "warranty_claim_workflow_json",
        setting_value: JSON.stringify(nextClaims, null, 2),
        description: "Warranty claim workflow records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setClaims(nextClaims);
    return true;
  };

  const addClaim = async () => {
    setMessage("");

    if (!form.invoice_id || !form.failure_description) {
      setMessage("Document and failure description are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const claim = {
      id: `wclaim_${Date.now()}`,
      ...form,
      amount_requested: Number(form.amount_requested || 0),
      amount_approved: Number(form.amount_approved || 0),
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      customer_name: doc?.customer_name || "",
      vehicle_name: [doc?.vehicle_year, doc?.vehicle_make, doc?.vehicle_model].filter(Boolean).join(" "),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveClaims([claim, ...claims]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Warranty Claim Created",
      table_name: "app_settings",
      record_id: claim.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${claim.claim_type} claim for ${claim.document_number}`
    });

    setMessage("Warranty claim saved.");
    setForm({
      invoice_id: "",
      claim_type: "Parts + Labor",
      status: "Open",
      claim_number: "",
      vendor_or_manufacturer: "",
      amount_requested: "",
      amount_approved: "",
      failure_description: "",
      corrective_action: "",
      submitted_date: "",
      expected_response_date: "",
      notes: ""
    });
  };

  const updateClaim = async (id, updates) => {
    const next = claims.map((claim) =>
      claim.id === id ? { ...claim, ...updates, updated_at: new Date().toISOString() } : claim
    );

    const saved = await saveClaims(next);
    if (saved) setMessage("Claim updated.");
  };

  const copyClaimSummary = async (claim) => {
    const text = `Warranty Claim: ${claim.claim_number || claim.id}
Document: ${claim.document_number || "-"}
Customer: ${claim.customer_name || "-"}
Vehicle: ${claim.vehicle_name || "-"}
Type: ${claim.claim_type}
Failure: ${claim.failure_description}
Corrective Action: ${claim.corrective_action || "-"}
Requested: $${Number(claim.amount_requested || 0).toFixed(2)}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Claim summary copied.");
    } catch {
      setMessage("Could not copy claim summary.");
    }
  };

  const totals = useMemo(
    () => ({
      requested: claims.reduce((sum, claim) => sum + Number(claim.amount_requested || 0), 0),
      approved: claims.reduce((sum, claim) => sum + Number(claim.amount_approved || 0), 0),
      open: claims.filter((claim) => !["Paid", "Closed", "Denied"].includes(claim.status)).length
    }),
    [claims]
  );

  return (
    <div>
      <h2>Warranty Claim Workflow</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open Claims" value={totals.open} />
        <StatCard title="Requested" value={`$${totals.requested.toFixed(2)}`} />
        <StatCard title="Approved" value={`$${totals.approved.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Create Claim</h3>

        <div style={gridStyle}>
          <label>
            Related Document
            <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
              <option value="">Select document</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Claim Type
            <select value={form.claim_type} onChange={(e) => setForm((p) => ({ ...p, claim_type: e.target.value }))} style={inputStyle}>
              {CLAIM_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {CLAIM_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            Claim #
            <input value={form.claim_number} onChange={(e) => setForm((p) => ({ ...p, claim_number: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Vendor / Manufacturer
            <input value={form.vendor_or_manufacturer} onChange={(e) => setForm((p) => ({ ...p, vendor_or_manufacturer: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Amount Requested
            <input type="number" value={form.amount_requested} onChange={(e) => setForm((p) => ({ ...p, amount_requested: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Amount Approved
            <input type="number" value={form.amount_approved} onChange={(e) => setForm((p) => ({ ...p, amount_approved: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Submitted Date
            <input type="date" value={form.submitted_date} onChange={(e) => setForm((p) => ({ ...p, submitted_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Expected Response
            <input type="date" value={form.expected_response_date} onChange={(e) => setForm((p) => ({ ...p, expected_response_date: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Failure Description
          <textarea value={form.failure_description} onChange={(e) => setForm((p) => ({ ...p, failure_description: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Corrective Action
          <textarea value={form.corrective_action} onChange={(e) => setForm((p) => ({ ...p, corrective_action: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addClaim}>Save Claim</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Claim</th>
            <th>Document</th>
            <th>Customer / Vehicle</th>
            <th>Requested</th>
            <th>Approved</th>
            <th>Failure</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td>
                <select value={claim.status} onChange={(e) => updateClaim(claim.id, { status: e.target.value })} style={inputStyle}>
                  {CLAIM_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{claim.claim_number || claim.id}<br /><small>{claim.claim_type}</small></td>
              <td>{claim.document_number || "-"}</td>
              <td>{claim.customer_name || "-"}<br /><small>{claim.vehicle_name || ""}</small></td>
              <td>${Number(claim.amount_requested || 0).toFixed(2)}</td>
              <td>${Number(claim.amount_approved || 0).toFixed(2)}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{claim.failure_description}</td>
              <td><button type="button" onClick={() => copyClaimSummary(claim)}>Copy</button></td>
            </tr>
          ))}

          {claims.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No warranty claims.</td></tr>}
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default WarrantyClaimWorkflowManager;
