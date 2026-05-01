import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const METHODS = ["Phone", "Text", "Email", "In Person", "Voicemail", "Other"];
const DIRECTIONS = ["Outbound", "Inbound"];

function CommunicationLogManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    invoice_id: "",
    customer_name: "",
    method: "Phone",
    direction: "Outbound",
    subject: "",
    note: "",
    follow_up_date: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, docsResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "communication_log_json").maybeSingle()
    ]);

    if (customersResult.error || docsResult.error) {
      setMessage(customersResult.error?.message || docsResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setLogs(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLogs([]);
    }
  };

  const saveLogs = async (nextLogs) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "communication_log_json",
        setting_value: JSON.stringify(nextLogs, null, 2),
        description: "Customer communication log records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setLogs(nextLogs);
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
          next.subject = next.subject || `Regarding ${doc.invoice_number || doc.repair_order_number || doc.estimate_number || "document"}`;
        }
      }

      return next;
    });
  };

  const addLog = async () => {
    setMessage("");

    if (!form.customer_name || !form.note) {
      setMessage("Customer and note are required.");
      return;
    }

    const doc = documents.find((item) => item.id === form.invoice_id);

    const log = {
      id: `comm_${Date.now()}`,
      ...form,
      document_number: doc?.invoice_number || doc?.repair_order_number || doc?.estimate_number || "",
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveLogs([log, ...logs]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Communication Log Created",
      table_name: "app_settings",
      record_id: log.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${log.method} ${log.direction}: ${log.customer_name}`
    });

    setMessage("Communication logged.");
    setForm({
      customer_id: "",
      invoice_id: "",
      customer_name: "",
      method: "Phone",
      direction: "Outbound",
      subject: "",
      note: "",
      follow_up_date: ""
    });
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;

    return logs.filter((log) =>
      [log.customer_name, log.method, log.direction, log.subject, log.note, log.document_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [logs, search]);

  const dueFollowUps = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return logs.filter((log) => log.follow_up_date && log.follow_up_date <= today);
  }, [logs]);

  return (
    <div>
      <h2>Customer Communication Log</h2>

      {message && <p style={{ color: message.includes("logged") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Logs" value={logs.length} />
        <StatCard title="Follow Ups Due" value={dueFollowUps.length} />
        <StatCard title="Outbound" value={logs.filter((log) => log.direction === "Outbound").length} />
        <StatCard title="Inbound" value={logs.filter((log) => log.direction === "Inbound").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Communication</h3>

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
              <option value="">No linked document</option>
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
            Method
            <select value={form.method} onChange={(e) => updateForm("method", e.target.value)} style={inputStyle}>
              {METHODS.map((method) => <option key={method}>{method}</option>)}
            </select>
          </label>

          <label>
            Direction
            <select value={form.direction} onChange={(e) => updateForm("direction", e.target.value)} style={inputStyle}>
              {DIRECTIONS.map((direction) => <option key={direction}>{direction}</option>)}
            </select>
          </label>

          <label>
            Follow-Up Date
            <input type="date" value={form.follow_up_date} onChange={(e) => updateForm("follow_up_date", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Subject
          <input value={form.subject} onChange={(e) => updateForm("subject", e.target.value)} style={inputStyle} />
        </label>

        <label>
          Note
          <textarea value={form.note} onChange={(e) => updateForm("note", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addLog}>Save Communication</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search communication logs..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Method</th>
            <th>Direction</th>
            <th>Subject</th>
            <th>Note</th>
            <th>Follow Up</th>
          </tr>
        </thead>

        <tbody>
          {filteredLogs.map((log) => (
            <tr key={log.id}>
              <td>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
              <td>{log.customer_name}<br /><small>{log.document_number || ""}</small></td>
              <td>{log.method}</td>
              <td>{log.direction}</td>
              <td>{log.subject || "-"}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{log.note}</td>
              <td>{log.follow_up_date || "-"}</td>
            </tr>
          ))}

          {filteredLogs.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No communication logs.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CommunicationLogManager;
