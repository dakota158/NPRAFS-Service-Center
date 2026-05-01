import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const POLICY_TYPES = ["Storage Fee", "Diagnostic Authorization", "Tow-In", "Warranty Terms", "Payment Terms", "Custom"];

function PolicyAcknowledgementManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    invoice_id: "",
    customer_name: "",
    policy_type: "Diagnostic Authorization",
    policy_text: "",
    acknowledgement_method: "In Person",
    acknowledged_date: new Date().toISOString().slice(0, 10),
    acknowledged_by: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, docsResult, ackResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "policy_acknowledgements_json").maybeSingle()
    ]);

    if (customersResult.error || docsResult.error) {
      setMessage(customersResult.error?.message || docsResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(ackResult.data?.setting_value || "[]");
      setAcknowledgements(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAcknowledgements([]);
    }
  };

  const saveAcknowledgements = async (nextAcknowledgements) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "policy_acknowledgements_json",
        setting_value: JSON.stringify(nextAcknowledgements, null, 2),
        description: "Customer policy acknowledgement records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setAcknowledgements(nextAcknowledgements);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "customer_id") {
        const customer = customers.find((item) => item.id === value);
        if (customer) next.customer_name = customer.name || "";
      }

      if (field === "invoice_id") {
        const doc = documents.find((item) => item.id === value);
        if (doc) {
          next.customer_id = doc.customer_id || next.customer_id;
          next.customer_name = doc.customer_name || next.customer_name;
        }
      }

      return next;
    });
  };

  const addAcknowledgement = async () => {
    setMessage("");

    if (!form.customer_name || !form.policy_text) {
      setMessage("Customer and policy text are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const acknowledgement = {
      id: `policy_ack_${Date.now()}`,
      ...form,
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveAcknowledgements([acknowledgement, ...acknowledgements]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Policy Acknowledgement Created",
      table_name: "app_settings",
      record_id: acknowledgement.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${acknowledgement.customer_name} - ${acknowledgement.policy_type}`
    });

    setMessage("Policy acknowledgement saved.");
    setForm({
      customer_id: "",
      invoice_id: "",
      customer_name: "",
      policy_type: "Diagnostic Authorization",
      policy_text: "",
      acknowledgement_method: "In Person",
      acknowledged_date: new Date().toISOString().slice(0, 10),
      acknowledged_by: "",
      notes: ""
    });
  };

  const copyAcknowledgement = async (ack) => {
    const text = `Policy Acknowledgement
Customer: ${ack.customer_name}
Document: ${ack.document_number || "-"}
Policy: ${ack.policy_type}
Date: ${ack.acknowledged_date}
Method: ${ack.acknowledgement_method}
Acknowledged by: ${ack.acknowledged_by || "-"}

${ack.policy_text}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Acknowledgement copied.");
    } catch {
      setMessage("Could not copy acknowledgement.");
    }
  };

  return (
    <div>
      <h2>Policy Acknowledgements</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Acknowledgements" value={acknowledgements.length} />
        <StatCard title="Diagnostic" value={acknowledgements.filter((item) => item.policy_type === "Diagnostic Authorization").length} />
        <StatCard title="Storage" value={acknowledgements.filter((item) => item.policy_type === "Storage Fee").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Acknowledgement</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => updateForm("customer_id", e.target.value)} style={inputStyle}>
              <option value="">Manual customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
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
            Customer Name
            <input value={form.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Policy Type
            <select value={form.policy_type} onChange={(e) => updateForm("policy_type", e.target.value)} style={inputStyle}>
              {POLICY_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          <label>
            Method
            <select value={form.acknowledgement_method} onChange={(e) => updateForm("acknowledgement_method", e.target.value)} style={inputStyle}>
              <option>In Person</option>
              <option>Text</option>
              <option>Email</option>
              <option>Phone</option>
              <option>Signed Paper</option>
            </select>
          </label>

          <label>
            Date
            <input type="date" value={form.acknowledged_date} onChange={(e) => updateForm("acknowledged_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Acknowledged By
            <input value={form.acknowledged_by} onChange={(e) => updateForm("acknowledged_by", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Policy Text
          <textarea value={form.policy_text} onChange={(e) => updateForm("policy_text", e.target.value)} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addAcknowledgement}>Save Acknowledgement</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Document</th>
            <th>Policy</th>
            <th>Method</th>
            <th>Acknowledged By</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {acknowledgements.map((ack) => (
            <tr key={ack.id}>
              <td>{ack.acknowledged_date}</td>
              <td>{ack.customer_name}</td>
              <td>{ack.document_number || "-"}</td>
              <td>{ack.policy_type}</td>
              <td>{ack.acknowledgement_method}</td>
              <td>{ack.acknowledged_by || "-"}</td>
              <td><button type="button" onClick={() => copyAcknowledgement(ack)}>Copy</button></td>
            </tr>
          ))}

          {acknowledgements.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No acknowledgements.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 90, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PolicyAcknowledgementManager;
