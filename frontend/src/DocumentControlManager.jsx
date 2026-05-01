import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function DocumentControlManager({ user, canEditEverything }) {
  const [documents, setDocuments] = useState([]);
  const [controlRecords, setControlRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "document_control_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setControlRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setControlRecords([]);
    }
  };

  const saveRecords = async (nextRecords) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "document_control_json",
        setting_value: JSON.stringify(nextRecords, null, 2),
        description: "Document lock/void/change-control records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setControlRecords(nextRecords);
    return true;
  };

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedId),
    [documents, selectedId]
  );

  const addControlRecord = async (action) => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can perform document control actions.");
      return;
    }

    if (!selectedDocument) {
      setMessage("Select a document first.");
      return;
    }

    if (!reason.trim()) {
      setMessage("Reason is required.");
      return;
    }

    const record = {
      id: `docctrl_${Date.now()}`,
      invoice_id: selectedDocument.id,
      document_number:
        selectedDocument.invoice_number ||
        selectedDocument.repair_order_number ||
        selectedDocument.estimate_number ||
        "",
      customer_name: selectedDocument.customer_name || "",
      action,
      reason,
      performed_by: user?.email || user?.username || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveRecords([record, ...controlRecords]);

    if (!saved) return;

    const updatePayload = {
      internal_notes: [
        selectedDocument.internal_notes || "",
        `DOCUMENT CONTROL: ${action} by ${record.performed_by}`,
        `Reason: ${reason}`
      ].filter(Boolean).join("\n"),
      updated_at: new Date().toISOString()
    };

    if (action === "Void") {
      updatePayload.status = "Voided";
      updatePayload.payment_status = selectedDocument.payment_status || "Voided";
    }

    if (action === "Lock") {
      updatePayload.status = selectedDocument.status || "Locked";
    }

    await supabase.from("invoices").update(updatePayload).eq("id", selectedDocument.id);

    await supabase.from("audit_logs").insert({
      action: `Document ${action}`,
      table_name: "invoices",
      record_id: selectedDocument.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${action}: ${record.document_number}. Reason: ${reason}`
    });

    setReason("");
    setMessage(`Document ${action.toLowerCase()} recorded.`);
    loadAll();
  };

  const voidedCount = documents.filter((doc) => doc.status === "Voided").length;

  return (
    <div>
      <h2>Document Control</h2>

      {message && (
        <p style={{ color: message.includes("recorded") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Control Records" value={controlRecords.length} />
        <StatCard title="Voided Documents" value={voidedCount} />
        <StatCard title="Documents" value={documents.length} />
      </div>

      <div style={panelStyle}>
        <h3>Lock / Void Document</h3>

        <label>
          Document
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={inputStyle}>
            <option value="">Select document</option>
            {documents.slice(0, 400).map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.document_status || "Invoice"} - {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"} - {doc.status || ""}
              </option>
            ))}
          </select>
        </label>

        {selectedDocument && (
          <div style={summaryBox}>
            <strong>{selectedDocument.customer_name}</strong>
            <br />
            Status: {selectedDocument.status || "-"}
            <br />
            Total: ${Number(selectedDocument.grand_total || 0).toFixed(2)}
          </div>
        )}

        <label>
          Reason
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={() => addControlRecord("Lock")} disabled={!canEditEverything}>
          Record Lock
        </button>{" "}
        <button type="button" onClick={() => addControlRecord("Void")} disabled={!canEditEverything}>
          Void Document
        </button>{" "}
        <button type="button" onClick={() => addControlRecord("Correction")} disabled={!canEditEverything}>
          Record Correction
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Reason</th>
            <th>User</th>
          </tr>
        </thead>

        <tbody>
          {controlRecords.map((record) => (
            <tr key={record.id}>
              <td>{record.created_at ? new Date(record.created_at).toLocaleString() : "-"}</td>
              <td>{record.action}</td>
              <td>{record.document_number}</td>
              <td>{record.customer_name || "-"}</td>
              <td>{record.reason}</td>
              <td>{record.performed_by}</td>
            </tr>
          ))}

          {controlRecords.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center" }}>No control records.</td></tr>}
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
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const summaryBox = { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default DocumentControlManager;
