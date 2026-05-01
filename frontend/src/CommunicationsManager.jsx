import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CommunicationsManager({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const [form, setForm] = useState({
    emailed_to: "",
    subject: "",
    body: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, emailResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("invoice_email_logs")
        .select("*, invoices(invoice_number, repair_order_number, customer_name)")
        .order("created_at", { ascending: false })
        .limit(200)
    ]);

    if (invoiceResult.error) {
      setMessage(invoiceResult.error.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setEmailLogs(emailResult.data || []);
  };

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId),
    [invoices, selectedInvoiceId]
  );

  const selectInvoice = (invoiceId) => {
    const invoice = invoices.find((item) => item.id === invoiceId);

    setSelectedInvoiceId(invoiceId);

    if (invoice) {
      setForm({
        emailed_to: invoice.customer_email || "",
        subject: `${invoice.document_status || "Invoice"} ${
          invoice.invoice_number || invoice.repair_order_number || ""
        }`,
        body: `Hello ${invoice.customer_name || ""},

Your ${invoice.document_status || "invoice"} ${
          invoice.invoice_number || invoice.repair_order_number || ""
        } is ready.

Total: $${Number(invoice.grand_total || 0).toFixed(2)}

Thank you.`
      });
    }
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const saveEmailDraft = async () => {
    setMessage("");

    if (!selectedInvoice) {
      setMessage("Select an invoice/estimate/RO first.");
      return;
    }

    if (!form.emailed_to || !form.subject) {
      setMessage("Email to and subject are required.");
      return;
    }

    const { error } = await supabase.from("invoice_email_logs").insert({
      invoice_id: selectedInvoice.id,
      emailed_to: form.emailed_to,
      subject: form.subject,
      body: form.body,
      status: "Drafted",
      created_by: user?.id || null
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase
      .from("invoices")
      .update({
        emailed_to: form.emailed_to,
        email_subject: form.subject,
        email_body: form.body
      })
      .eq("id", selectedInvoice.id);

    await supabase.from("audit_logs").insert({
      action: "Email Draft Created",
      table_name: "invoice_email_logs",
      record_id: selectedInvoice.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created email draft to ${form.emailed_to}`
    });

    setMessage("Email draft saved. This stores the message; actual sending can be connected later.");
    loadAll();
  };

  return (
    <div>
      <h2>Customer Communications</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Email / SMS Ready Draft</h3>

        <label>
          Select Document
          <select
            value={selectedInvoiceId}
            onChange={(e) => selectInvoice(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select invoice, estimate, or repair order</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.document_status || "Invoice"} -{" "}
                {invoice.invoice_number || invoice.repair_order_number} -{" "}
                {invoice.customer_name || "Customer"}
              </option>
            ))}
          </select>
        </label>

        <div style={gridStyle}>
          <label>
            To
            <input
              value={form.emailed_to}
              onChange={(e) => updateForm("emailed_to", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Subject
            <input
              value={form.subject}
              onChange={(e) => updateForm("subject", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Message
          <textarea
            value={form.body}
            onChange={(e) => updateForm("body", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={saveEmailDraft}>
          Save Communication Draft
        </button>
      </div>

      <h3>Communication Log</h3>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer / Document</th>
            <th>To</th>
            <th>Subject</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {emailLogs.map((log) => (
            <tr key={log.id}>
              <td>
                {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
              </td>
              <td>
                {log.invoices?.customer_name || "-"}
                <br />
                <small>
                  {log.invoices?.invoice_number ||
                    log.invoices?.repair_order_number ||
                    "-"}
                </small>
              </td>
              <td>{log.emailed_to || "-"}</td>
              <td>{log.subject || "-"}</td>
              <td>{log.status || "-"}</td>
            </tr>
          ))}

          {emailLogs.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center" }}>
                No communication logs yet.
              </td>
            </tr>
          )}
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
  minHeight: 160
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default CommunicationsManager;
