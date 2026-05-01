import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function DocumentTimelineManager() {
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, logsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000)
    ]);

    if (docsResult.error || logsResult.error) {
      setMessage(docsResult.error?.message || logsResult.error?.message);
      return;
    }

    setDocuments(docsResult.data || []);
    setAuditLogs(logsResult.data || []);
  };

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId),
    [documents, selectedDocumentId]
  );

  const timelineItems = useMemo(() => {
    if (!selectedDocument) return [];

    const numberValues = [
      selectedDocument.id,
      selectedDocument.invoice_number,
      selectedDocument.repair_order_number,
      selectedDocument.estimate_number
    ].filter(Boolean);

    const items = [
      {
        date: selectedDocument.created_at,
        type: "Created",
        detail: `${selectedDocument.document_status || "Invoice"} created`,
        source: "Document"
      },
      {
        date: selectedDocument.updated_at,
        type: "Updated",
        detail: "Document last updated",
        source: "Document"
      }
    ];

    auditLogs.forEach((log) => {
      const details = typeof log.details === "string" ? log.details : JSON.stringify(log.details || "");
      const matches =
        numberValues.includes(log.record_id) ||
        numberValues.some((number) => details.includes(String(number)));

      if (matches) {
        items.push({
          date: log.created_at,
          type: log.action || "Audit",
          detail: details || log.table_name || "",
          source: log.user_email || log.user_id || "Audit Log"
        });
      }
    });

    return items
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedDocument, auditLogs]);

  return (
    <div>
      <h2>Document Timeline</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Select Document
          <select
            value={selectedDocumentId}
            onChange={(e) => setSelectedDocumentId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select estimate, RO, or invoice</option>
            {documents.slice(0, 300).map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.document_status || "Invoice"} -{" "}
                {doc.invoice_number || doc.repair_order_number || doc.estimate_number} -{" "}
                {doc.customer_name || "Customer"}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={loadAll}>
          Refresh
        </button>
      </div>

      {selectedDocument && (
        <div style={summaryBox}>
          <h3 style={{ marginTop: 0 }}>
            {selectedDocument.document_status || "Invoice"}{" "}
            {selectedDocument.invoice_number ||
              selectedDocument.repair_order_number ||
              selectedDocument.estimate_number}
          </h3>
          <p><strong>Customer:</strong> {selectedDocument.customer_name || "-"}</p>
          <p><strong>Status:</strong> {selectedDocument.status || "-"}</p>
          <p><strong>Total:</strong> ${Number(selectedDocument.grand_total || 0).toFixed(2)}</p>
        </div>
      )}

      <div>
        {timelineItems.map((item, index) => (
          <div key={`${item.date}-${index}`} style={timelineItemStyle}>
            <div style={timelineDotStyle} />
            <div>
              <strong>{item.type}</strong>
              <br />
              <small>{new Date(item.date).toLocaleString()} | {item.source}</small>
              <p style={{ whiteSpace: "pre-wrap" }}>{item.detail}</p>
            </div>
          </div>
        ))}

        {selectedDocument && timelineItems.length === 0 && <p>No timeline items found.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const summaryBox = { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 };
const timelineItemStyle = { display: "grid", gridTemplateColumns: "22px 1fr", gap: 10, borderLeft: "2px solid #dbeafe", padding: "0 0 16px 0", marginLeft: 10 };
const timelineDotStyle = { width: 12, height: 12, borderRadius: "50%", background: "#2563eb", marginLeft: -7, marginTop: 4 };

export default DocumentTimelineManager;
