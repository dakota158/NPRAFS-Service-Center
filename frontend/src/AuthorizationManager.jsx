import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function AuthorizationManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [signature, setSignature] = useState("");
  const [authorizationText, setAuthorizationText] = useState(
    "I authorize the above repairs and charges."
  );

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments(data || []);
  };

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedId),
    [documents, selectedId]
  );

  const selectDocument = (id) => {
    const doc = documents.find((item) => item.id === id);

    setSelectedId(id);
    setSignature(doc?.customer_signature || "");
  };

  const saveAuthorization = async () => {
    setMessage("");

    if (!selectedDocument) {
      setMessage("Select a document first.");
      return;
    }

    if (!signature.trim()) {
      setMessage("Customer signature/name is required.");
      return;
    }

    const nextStatus =
      selectedDocument.document_status === "Estimate"
        ? "Approved"
        : selectedDocument.status || "Authorized";

    const { error } = await supabase
      .from("invoices")
      .update({
        customer_signature: signature,
        status: nextStatus,
        internal_notes: [
          selectedDocument.internal_notes || "",
          `Authorization: ${authorizationText}`,
          `Signed by: ${signature}`,
          `Authorized at: ${new Date().toLocaleString()}`
        ]
          .filter(Boolean)
          .join("\n"),
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedDocument.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Customer Authorization Saved",
      table_name: "invoices",
      record_id: selectedDocument.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Authorization saved for ${
        selectedDocument.invoice_number ||
        selectedDocument.estimate_number ||
        selectedDocument.repair_order_number
      }`
    });

    setMessage("Authorization saved.");
    loadDocuments();
  };

  return (
    <div>
      <h2>Customer Authorization / Signature</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Authorization Form</h3>

        <label>
          Select Document
          <select
            value={selectedId}
            onChange={(e) => selectDocument(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select estimate, RO, or invoice</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.document_status || "Invoice"} -{" "}
                {doc.invoice_number || doc.repair_order_number || doc.estimate_number} -{" "}
                {doc.customer_name || "Customer"}
              </option>
            ))}
          </select>
        </label>

        {selectedDocument && (
          <div style={summaryBox}>
            <h4 style={{ marginTop: 0 }}>
              {selectedDocument.document_status || "Invoice"}{" "}
              {selectedDocument.invoice_number ||
                selectedDocument.repair_order_number ||
                selectedDocument.estimate_number}
            </h4>
            <p>
              <strong>Customer:</strong> {selectedDocument.customer_name || "-"}
            </p>
            <p>
              <strong>Vehicle:</strong>{" "}
              {[selectedDocument.vehicle_year, selectedDocument.vehicle_make, selectedDocument.vehicle_model]
                .filter(Boolean)
                .join(" ") || "-"}
            </p>
            <p>
              <strong>Total:</strong> $
              {Number(selectedDocument.grand_total || 0).toFixed(2)}
            </p>
          </div>
        )}

        <label>
          Authorization Text
          <textarea
            value={authorizationText}
            onChange={(e) => setAuthorizationText(e.target.value)}
            style={textareaStyle}
          />
        </label>

        <label>
          Customer Signature / Typed Name
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Customer typed name"
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={saveAuthorization}>
          Save Authorization
        </button>
      </div>

      <h3>Recently Authorized / Pending</h3>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Document</th>
            <th>Status</th>
            <th>Customer</th>
            <th>Signature</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {documents.slice(0, 80).map((doc) => (
            <tr key={doc.id}>
              <td>
                {doc.document_status || "Invoice"}{" "}
                {doc.invoice_number || doc.repair_order_number || doc.estimate_number}
              </td>
              <td>{doc.status || "-"}</td>
              <td>{doc.customer_name || "-"}</td>
              <td>{doc.customer_signature || "Not signed"}</td>
              <td>${Number(doc.grand_total || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4,
  marginBottom: 10
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 100
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const summaryBox = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 10,
  padding: 12,
  marginBottom: 12
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default AuthorizationManager;
