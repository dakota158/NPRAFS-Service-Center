import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CustomerCreditManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [credits, setCredits] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    credit_limit: "",
    terms: "Due on receipt",
    account_status: "Active",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, invoicesResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_credit_accounts_json").maybeSingle()
    ]);

    if (customersResult.error || invoicesResult.error) {
      setMessage(customersResult.error?.message || invoicesResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setInvoices(invoicesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setCredits(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCredits([]);
    }
  };

  const saveCredits = async (nextCredits) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_credit_accounts_json",
        setting_value: JSON.stringify(nextCredits, null, 2),
        description: "Customer credit account settings",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setCredits(nextCredits);
    return true;
  };

  const saveCreditAccount = async () => {
    setMessage("");

    if (!form.customer_id) {
      setMessage("Select a customer first.");
      return;
    }

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save credit accounts.");
      return;
    }

    const customer = customers.find((item) => item.id === form.customer_id);
    const existing = credits.find((item) => item.customer_id === form.customer_id);

    const record = {
      id: existing?.id || `credit_${Date.now()}`,
      customer_id: form.customer_id,
      customer_name: customer?.name || "",
      credit_limit: Number(form.credit_limit || 0),
      terms: form.terms,
      account_status: form.account_status,
      notes: form.notes,
      updated_by: user?.id || null,
      updated_by_email: user?.email || "",
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString()
    };

    const nextCredits = existing
      ? credits.map((item) => (item.id === existing.id ? record : item))
      : [record, ...credits];

    const saved = await saveCredits(nextCredits);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Customer Credit Account Saved",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Credit account saved for ${record.customer_name}`
    });

    setMessage("Credit account saved.");
    setForm({
      customer_id: "",
      credit_limit: "",
      terms: "Due on receipt",
      account_status: "Active",
      notes: ""
    });
  };

  const getCustomerBalance = (customerId) => {
    return invoices
      .filter((invoice) => invoice.customer_id === customerId)
      .reduce(
        (sum, invoice) =>
          sum +
          Math.max(
            0,
            Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)
          ),
        0
      );
  };

  const rows = useMemo(
    () =>
      credits.map((credit) => ({
        ...credit,
        balance: getCustomerBalance(credit.customer_id),
        available: Number(credit.credit_limit || 0) - getCustomerBalance(credit.customer_id)
      })),
    [credits, invoices]
  );

  return (
    <div>
      <h2>Customer Credit Accounts</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Credit Accounts" value={credits.length} />
        <StatCard title="Outstanding" value={`$${rows.reduce((s, r) => s + r.balance, 0).toFixed(2)}`} />
        <StatCard title="Over Limit" value={rows.filter((r) => r.available < 0).length} />
      </div>

      <div style={panelStyle}>
        <h3>Add / Edit Credit Account</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))} style={inputStyle}>
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label>
            Credit Limit
            <input type="number" value={form.credit_limit} onChange={(e) => setForm((p) => ({ ...p, credit_limit: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Terms
            <input value={form.terms} onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.account_status} onChange={(e) => setForm((p) => ({ ...p, account_status: e.target.value }))} style={inputStyle}>
              <option>Active</option>
              <option>Hold</option>
              <option>Closed</option>
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={saveCreditAccount} disabled={!canEditEverything}>Save Credit Account</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Customer</th>
            <th>Terms</th>
            <th>Credit Limit</th>
            <th>Balance</th>
            <th>Available</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.account_status}</td>
              <td>{row.customer_name}</td>
              <td>{row.terms}</td>
              <td>${Number(row.credit_limit || 0).toFixed(2)}</td>
              <td>${row.balance.toFixed(2)}</td>
              <td style={{ color: row.available < 0 ? "red" : "green" }}>
                ${row.available.toFixed(2)}
              </td>
              <td>{row.notes || "-"}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No credit accounts.</td></tr>}
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CustomerCreditManager;
