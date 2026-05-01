import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { integrationRequest, getIntegrationApiBase, setIntegrationApiBase } from "./integrationApi";

const SIGNATURE_STATUSES = ["Draft", "Requested", "Signed", "Declined", "Expired"];

function RepairOrderSignatureManager({ user, canEditEverything }) {
  const [apiBase, setApiBase] = useState(getIntegrationApiBase());
  const [documents, setDocuments] = useState([]);
  const [readers, setReaders] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    invoice_id: "",
    reader_id: "",
    signer_name: "",
    status: "Draft",
    authorization_text: "I authorize the repair work listed on this repair order and understand the estimate, diagnostic, payment, storage, and warranty terms.",
    signature_data: "",
    notes: ""
  });

  useEffect(() => {
    loadDocuments();
    loadSignatures();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments(data || []);
  };

  const loadSignatures = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "repair_order_signatures_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setSignatures(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSignatures([]);
    }
  };

  const saveSignatures = async (nextSignatures) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "repair_order_signatures_json",
        setting_value: JSON.stringify(nextSignatures, null, 2),
        description: "Repair order customer signature records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setSignatures(nextSignatures);
    return true;
  };

  const loadReaders = async () => {
    setMessage("");
    try {
      const payload = await integrationRequest("/api/stripe-terminal/readers");
      setReaders(payload.readers || []);
      setMessage(payload.mock ? "Loaded mock readers." : "Loaded readers.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) next.signer_name = doc.customer_name || "";
      }

      return next;
    });
  };

  const saveManualSignature = async () => {
    setMessage("");

    if (!form.invoice_id || !form.signer_name) {
      setMessage("Repair order and signer name are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const signature = {
      id: `ro_sig_${Date.now()}`,
      ...form,
      document_number: doc?.repair_order_number || doc?.invoice_number || doc?.estimate_number || "",
      customer_name: doc?.customer_name || "",
      status: form.signature_data ? "Signed" : form.status,
      signed_at: form.signature_data ? new Date().toISOString() : "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveSignatures([signature, ...signatures]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Repair Order Signature Saved",
      table_name: "app_settings",
      record_id: signature.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${signature.document_number} signed by ${signature.signer_name}`
    });

    setMessage("Repair order signature saved.");
    setForm({
      invoice_id: "",
      reader_id: "",
      signer_name: "",
      status: "Draft",
      authorization_text: "I authorize the repair work listed on this repair order and understand the estimate, diagnostic, payment, storage, and warranty terms.",
      signature_data: "",
      notes: ""
    });
  };

  const requestReaderSignature = async () => {
    setMessage("");

    if (!form.reader_id || !form.invoice_id) {
      setMessage("Select a reader and repair order first.");
      return;
    }

    try {
      const payload = await integrationRequest("/api/stripe-terminal/collect-repair-order-signature", {
        method: "POST",
        body: {
          readerId: form.reader_id,
          label: "Repair Order Authorization",
          description: form.authorization_text
        }
      });

      const doc = documents.find((item) => item.id === form.invoice_id);
      const signature = {
        id: `ro_sig_${Date.now()}`,
        ...form,
        document_number: doc?.repair_order_number || doc?.invoice_number || doc?.estimate_number || "",
        customer_name: doc?.customer_name || "",
        status: payload.mock ? "Signed" : "Requested",
        signature_data: payload.signature || "",
        reader_action: payload.reader?.action || payload.action || null,
        signed_at: payload.mock ? new Date().toISOString() : "",
        mock: Boolean(payload.mock),
        created_by: user?.id || null,
        created_by_email: user?.email || "",
        created_at: new Date().toISOString()
      };

      await saveSignatures([signature, ...signatures]);
      setMessage(payload.mock ? "Mock reader signature captured." : "Signature request sent to reader.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateSignature = async (id, updates) => {
    const next = signatures.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveSignatures(next);
    if (saved) setMessage("Signature updated.");
  };

  const saveApiBase = () => {
    setIntegrationApiBase(apiBase);
    setMessage("Integration API base saved.");
  };

  return (
    <div>
      <h2>Repair Order Signatures</h2>

      <p>
        Use this to record customer authorization for repair orders. In live mode,
        a Stripe smart reader can collect the signature input; in mock mode it records a test signature.
      </p>

      {message && <p style={{ color: message.includes("required") || message.includes("Select") ? "red" : "green" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Integration Backend</h3>
        <label>
          Backend URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={saveApiBase}>Save Backend URL</button>{" "}
        <button type="button" onClick={loadReaders}>Load Readers</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Signatures" value={signatures.length} />
        <StatCard title="Signed" value={signatures.filter((item) => item.status === "Signed").length} />
        <StatCard title="Requested" value={signatures.filter((item) => item.status === "Requested").length} />
      </div>

      <div style={panelStyle}>
        <h3>Request / Record Signature</h3>

        <div style={gridStyle}>
          <label>
            Repair Order / Invoice
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">Select document</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.repair_order_number || doc.invoice_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Signer Name
            <input value={form.signer_name} onChange={(e) => updateForm("signer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Reader
            <select value={form.reader_id} onChange={(e) => updateForm("reader_id", e.target.value)} style={inputStyle}>
              <option value="">Select reader</option>
              {readers.map((reader) => (
                <option key={reader.id} value={reader.id}>{reader.label || reader.id} - {reader.status || "unknown"}</option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {SIGNATURE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Authorization Text
          <textarea value={form.authorization_text} onChange={(e) => updateForm("authorization_text", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Manual Signature / Typed Authorization
          <input
            value={form.signature_data}
            onChange={(e) => updateForm("signature_data", e.target.value)}
            placeholder="Customer typed name or signature reference"
            style={inputStyle}
          />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={requestReaderSignature}>Request Signature On Reader</button>{" "}
        <button type="button" onClick={saveManualSignature} disabled={!canEditEverything}>Save Manual Signature</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Signer</th>
            <th>Signed At</th>
            <th>Signature</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {signatures.map((signature) => (
            <tr key={signature.id}>
              <td>
                <select value={signature.status} onChange={(e) => updateSignature(signature.id, { status: e.target.value })} style={inputStyle}>
                  {SIGNATURE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{signature.document_number || "-"}</td>
              <td>{signature.customer_name || "-"}</td>
              <td>{signature.signer_name}</td>
              <td>{signature.signed_at ? new Date(signature.signed_at).toLocaleString() : "-"}</td>
              <td>{signature.signature_data || (signature.mock ? "Mock reader signature" : "-")}</td>
              <td>{signature.notes || "-"}</td>
            </tr>
          ))}

          {signatures.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No signatures yet.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default RepairOrderSignatureManager;
