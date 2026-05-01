import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { integrationRequest, getIntegrationApiBase, setIntegrationApiBase } from "./integrationApi";

const SMS_STATUSES = ["Draft", "Sent", "Failed"];
const TEMPLATE_TEXT = {
  ready: "Hello {{customer_name}}, your vehicle is ready for pickup. Please contact us with any questions.",
  estimate: "Hello {{customer_name}}, your estimate {{document_number}} is ready for review. Total: ${{amount}}.",
  payment: "Hello {{customer_name}}, your balance for {{document_number}} is ${{amount}}. Please contact us to pay.",
  reminder: "Hello {{customer_name}}, this is a friendly reminder about your upcoming service.",
  custom: ""
};

function SmsMessagingManager({ user, canEditEverything }) {
  const [apiBase, setApiBase] = useState(getIntegrationApiBase());
  const [customers, setCustomers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    invoice_id: "",
    to: "",
    customer_name: "",
    template: "ready",
    body: TEMPLATE_TEXT.ready
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([loadCustomers(), loadDocuments(), loadMessages()]);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setCustomers(data || []);
  };

  const loadDocuments = async () => {
    const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments(data || []);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase.from("app_settings").select("*").eq("setting_key", "sms_messages_json").maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMessages([]);
    }
  };

  const saveMessages = async (nextMessages) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "sms_messages_json",
        setting_value: JSON.stringify(nextMessages, null, 2),
        description: "SMS messaging records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setMessages(nextMessages);
    return true;
  };

  const hydrateTemplate = (template, nextForm) => {
    const doc = documents.find((item) => item.id === nextForm.invoice_id);
    const amount = doc
      ? Math.max(0, Number(doc.grand_total || 0) - Number(doc.amount_paid || 0)).toFixed(2)
      : "0.00";

    return template
      .replaceAll("{{customer_name}}", nextForm.customer_name || "Customer")
      .replaceAll("{{document_number}}", doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "")
      .replaceAll("{{amount}}", amount);
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "customer_id") {
        const customer = customers.find((item) => item.id === value);
        if (customer) {
          next.customer_name = customer.name || "";
          next.to = customer.phone || "";
        }
      }

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) {
          next.customer_name = doc.customer_name || next.customer_name;
          next.to = doc.customer_phone || next.to;
        }
      }

      if (field === "template") {
        next.body = hydrateTemplate(TEMPLATE_TEXT[value] || "", next);
      } else if (["customer_id", "invoice_id"].includes(field) && next.template !== "custom") {
        next.body = hydrateTemplate(TEMPLATE_TEXT[next.template] || "", next);
      }

      return next;
    });
  };

  const sendSms = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can send SMS messages.");
      return;
    }

    if (!form.to || !form.body) {
      setMessage("Phone number and message body are required.");
      return;
    }

    setLoading(true);

    try {
      const payload = await integrationRequest("/api/sms/send", {
        method: "POST",
        body: {
          to: form.to,
          body: form.body
        }
      });

      const smsRecord = {
        id: `sms_${Date.now()}`,
        customer_id: form.customer_id,
        invoice_id: form.invoice_id,
        to: form.to,
        customer_name: form.customer_name,
        template: form.template,
        body: form.body,
        provider_message_id: payload.message?.sid || payload.sid || "",
        status: payload.mock ? "Sent" : "Sent",
        mock: Boolean(payload.mock),
        created_by: user?.id || null,
        created_by_email: user?.email || "",
        created_at: new Date().toISOString()
      };

      const saved = await saveMessages([smsRecord, ...messages]);

      if (!saved) return;

      await supabase.from("audit_logs").insert({
        action: "SMS Message Sent",
        table_name: "app_settings",
        record_id: smsRecord.id,
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `${smsRecord.to} ${smsRecord.template}`
      });

      setMessage(payload.mock ? "Mock SMS saved as sent." : "SMS sent.");
    } catch (error) {
      const smsRecord = {
        id: `sms_${Date.now()}`,
        customer_id: form.customer_id,
        invoice_id: form.invoice_id,
        to: form.to,
        customer_name: form.customer_name,
        template: form.template,
        body: form.body,
        status: "Failed",
        error: error.message,
        created_by: user?.id || null,
        created_by_email: user?.email || "",
        created_at: new Date().toISOString()
      };

      await saveMessages([smsRecord, ...messages]);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveApiBase = () => {
    setIntegrationApiBase(apiBase);
    setMessage("Integration API base saved.");
  };

  const totals = useMemo(
    () => ({
      sent: messages.filter((item) => item.status === "Sent").length,
      failed: messages.filter((item) => item.status === "Failed").length
    }),
    [messages]
  );

  return (
    <div>
      <h2>SMS Messaging</h2>

      <p>
        Twilio-ready SMS system. Keep TWILIO_MOCK=true while testing, then add Twilio keys to your backend env.
      </p>

      {message && <p style={{ color: message.includes("required") || message.includes("Only") || message.includes("failed") ? "red" : "green" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Integration Backend</h3>
        <label>
          Backend URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={saveApiBase}>Save Backend URL</button>{" "}
        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Sent" value={totals.sent} />
        <StatCard title="Failed" value={totals.failed} />
        <StatCard title="Total" value={messages.length} />
      </div>

      <div style={panelStyle}>
        <h3>Send Message</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => updateForm("customer_id", e.target.value)} style={inputStyle}>
              <option value="">Manual number</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} - {customer.phone || "No phone"}</option>)}
            </select>
          </label>

          <label>
            Document
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">No document</option>
              {documents.slice(0, 300).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} - {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            To Phone
            <input value={form.to} onChange={(e) => updateForm("to", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Customer Name
            <input value={form.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Template
            <select value={form.template} onChange={(e) => updateForm("template", e.target.value)} style={inputStyle}>
              <option value="ready">Vehicle Ready</option>
              <option value="estimate">Estimate Ready</option>
              <option value="payment">Payment Due</option>
              <option value="reminder">Service Reminder</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>

        <label>
          Message
          <textarea value={form.body} onChange={(e) => updateForm("body", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={sendSms} disabled={loading || !canEditEverything}>Send SMS</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>To</th>
            <th>Customer</th>
            <th>Template</th>
            <th>Message</th>
            <th>Mock</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          {messages.map((item) => (
            <tr key={item.id}>
              <td>{item.status}</td>
              <td>{item.to}</td>
              <td>{item.customer_name || "-"}</td>
              <td>{item.template}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{item.body}</td>
              <td>{item.mock ? "Yes" : "No"}</td>
              <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</td>
            </tr>
          ))}

          {messages.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No SMS messages yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 100 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default SmsMessagingManager;
