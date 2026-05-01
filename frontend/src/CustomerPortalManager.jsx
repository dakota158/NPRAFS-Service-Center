import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CustomerPortalManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [portalLinks, setPortalLinks] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_portal_links_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setPortalLinks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPortalLinks([]);
    }
  };

  const savePortalLinks = async (nextLinks) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_portal_links_json",
        setting_value: JSON.stringify(nextLinks, null, 2),
        description: "Customer portal share code records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setPortalLinks(nextLinks);
    return true;
  };

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId),
    [documents, selectedDocumentId]
  );

  const generateCode = () =>
    Math.random().toString(36).slice(2, 8).toUpperCase() +
    "-" +
    Date.now().toString().slice(-4);

  const createPortalCode = async () => {
    setMessage("");

    if (!selectedDocument) {
      setMessage("Select a document first.");
      return;
    }

    const code = generateCode();

    const link = {
      id: `portal_${Date.now()}`,
      code,
      invoice_id: selectedDocument.id,
      document_number:
        selectedDocument.invoice_number ||
        selectedDocument.repair_order_number ||
        selectedDocument.estimate_number ||
        "",
      document_status: selectedDocument.document_status || "Invoice",
      customer_name: selectedDocument.customer_name || "",
      customer_email: selectedDocument.customer_email || "",
      total: Number(selectedDocument.grand_total || 0),
      status: "Active",
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await savePortalLinks([link, ...portalLinks]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Customer Portal Code Created",
      table_name: "app_settings",
      record_id: link.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created portal code ${code} for ${link.document_number}`
    });

    setMessage("Portal share code created.");
  };

  const toggleStatus = async (link) => {
    const nextLinks = portalLinks.map((item) =>
      item.id === link.id
        ? {
            ...item,
            status: item.status === "Active" ? "Disabled" : "Active",
            updated_at: new Date().toISOString()
          }
        : item
    );

    const saved = await savePortalLinks(nextLinks);
    if (saved) setMessage("Portal code updated.");
  };

  const copyCustomerMessage = async (link) => {
    const text = `Hello ${link.customer_name || ""},

You can reference your ${link.document_status} ${link.document_number} with this secure shop code:

${link.code}

Total: $${Number(link.total || 0).toFixed(2)}

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Customer portal message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  return (
    <div>
      <h2>Customer Portal Share Codes</h2>

      {message && (
        <p style={{ color: message.includes("created") || message.includes("copied") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Create Share Code</h3>

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
                {doc.customer_name || "Customer"} - ${Number(doc.grand_total || 0).toFixed(2)}
              </option>
            ))}
          </select>
        </label>

        {selectedDocument && (
          <div style={summaryBox}>
            <strong>{selectedDocument.customer_name}</strong>
            <br />
            {selectedDocument.customer_email || selectedDocument.customer_phone || ""}
            <br />
            Total: ${Number(selectedDocument.grand_total || 0).toFixed(2)}
          </div>
        )}

        <button type="button" onClick={createPortalCode}>
          Generate Share Code
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {portalLinks.map((link) => (
            <tr key={link.id}>
              <td><strong>{link.code}</strong></td>
              <td>{link.status}</td>
              <td>{link.document_status} {link.document_number}</td>
              <td>{link.customer_name || "-"}</td>
              <td>${Number(link.total || 0).toFixed(2)}</td>
              <td>{link.created_at ? new Date(link.created_at).toLocaleString() : "-"}</td>
              <td>
                <button type="button" onClick={() => copyCustomerMessage(link)}>
                  Copy Message
                </button>{" "}
                <button type="button" onClick={() => toggleStatus(link)}>
                  {link.status === "Active" ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}

          {portalLinks.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>No portal codes yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const summaryBox = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, marginBottom: 12 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default CustomerPortalManager;
