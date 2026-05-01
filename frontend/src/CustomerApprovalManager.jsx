import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const APPROVAL_STATUSES = ["Pending", "Approved", "Declined", "Needs Changes", "Expired"];

function CustomerApprovalManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    requested_amount: "",
    status: "Pending",
    approval_method: "Text",
    request_note: "",
    response_note: "",
    expires_at: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_approvals_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setApprovals(Array.isArray(parsed) ? parsed : []);
    } catch {
      setApprovals([]);
    }
  };

  const saveApprovals = async (nextApprovals) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_approvals_json",
        setting_value: JSON.stringify(nextApprovals, null, 2),
        description: "Customer approval request records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setApprovals(nextApprovals);
    return true;
  };

  const addApproval = async () => {
    setMessage("");

    if (!form.invoice_id) {
      setMessage("Select a document first.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const approval = {
      id: `approval_${Date.now()}`,
      ...form,
      requested_amount: Number(form.requested_amount || doc?.grand_total || 0),
      document_number: doc?.estimate_number || doc?.repair_order_number || doc?.invoice_number || "",
      customer_name: doc?.customer_name || "",
      customer_phone: doc?.customer_phone || "",
      customer_email: doc?.customer_email || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveApprovals([approval, ...approvals]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Customer Approval Created",
      table_name: "app_settings",
      record_id: approval.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${approval.document_number} approval requested`
    });

    setMessage("Approval request saved.");
    setForm({
      invoice_id: "",
      requested_amount: "",
      status: "Pending",
      approval_method: "Text",
      request_note: "",
      response_note: "",
      expires_at: ""
    });
  };

  const updateApproval = async (id, updates) => {
    const next = approvals.map((item) =>
      item.id === id
        ? {
            ...item,
            ...updates,
            responded_at: ["Approved", "Declined", "Needs Changes"].includes(updates.status) ? new Date().toISOString() : item.responded_at,
            updated_at: new Date().toISOString()
          }
        : item
    );

    const saved = await saveApprovals(next);
    if (saved) setMessage("Approval updated.");
  };

  const copyApprovalRequest = async (approval) => {
    const text = `Hello ${approval.customer_name || ""},

Please review approval request ${approval.document_number || ""}.

Amount: $${Number(approval.requested_amount || 0).toFixed(2)}

${approval.request_note || ""}

Please reply APPROVED or DECLINED.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Approval request copied.");
    } catch {
      setMessage("Could not copy approval request.");
    }
  };

  const pendingTotal = useMemo(
    () =>
      approvals
        .filter((item) => item.status === "Pending")
        .reduce((sum, item) => sum + Number(item.requested_amount || 0), 0),
    [approvals]
  );

  return (
    <div>
      <h2>Customer Approval Tracking</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Pending" value={approvals.filter((item) => item.status === "Pending").length} />
        <StatCard title="Pending Value" value={`$${pendingTotal.toFixed(2)}`} />
        <StatCard title="Approved" value={approvals.filter((item) => item.status === "Approved").length} />
        <StatCard title="Declined" value={approvals.filter((item) => item.status === "Declined").length} />
      </div>

      <div style={panelStyle}>
        <h3>Create Approval Request</h3>

        <div style={gridStyle}>
          <label>
            Document
            <select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))} style={inputStyle}>
              <option value="">Select document</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.estimate_number || doc.repair_order_number || doc.invoice_number} - {doc.customer_name || "Customer"} - ${Number(doc.grand_total || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Requested Amount
            <input type="number" value={form.requested_amount} onChange={(e) => setForm((p) => ({ ...p, requested_amount: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Method
            <select value={form.approval_method} onChange={(e) => setForm((p) => ({ ...p, approval_method: e.target.value }))} style={inputStyle}>
              <option>Text</option>
              <option>Email</option>
              <option>Phone</option>
              <option>In Person</option>
            </select>
          </label>

          <label>
            Expires
            <input type="date" value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Request Note
          <textarea value={form.request_note} onChange={(e) => setForm((p) => ({ ...p, request_note: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addApproval}>Save Approval Request</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Expires</th>
            <th>Response Note</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {approvals.map((approval) => (
            <tr key={approval.id}>
              <td>
                <select value={approval.status} onChange={(e) => updateApproval(approval.id, { status: e.target.value })} style={inputStyle}>
                  {APPROVAL_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{approval.document_number || "-"}</td>
              <td>{approval.customer_name || "-"}</td>
              <td>${Number(approval.requested_amount || 0).toFixed(2)}</td>
              <td>{approval.approval_method}</td>
              <td>{approval.expires_at || "-"}</td>
              <td>
                <input
                  value={approval.response_note || ""}
                  onChange={(e) => updateApproval(approval.id, { response_note: e.target.value })}
                  style={inputStyle}
                />
              </td>
              <td><button type="button" onClick={() => copyApprovalRequest(approval)}>Copy Request</button></td>
            </tr>
          ))}

          {approvals.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No approvals.</td></tr>}
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

export default CustomerApprovalManager;
