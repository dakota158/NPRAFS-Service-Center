import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const FREQUENCIES = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const STATUSES = ["Active", "Paused", "Cancelled"];

function SubscriptionExpenseManager({ user, canEditEverything }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    vendor: "",
    description: "",
    category: "Software",
    amount: "",
    frequency: "Monthly",
    next_due_date: "",
    payment_method: "",
    status: "Active",
    notes: ""
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "subscription_expenses_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setSubscriptions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSubscriptions([]);
    }
  };

  const saveSubscriptions = async (nextSubscriptions) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "subscription_expenses_json",
        setting_value: JSON.stringify(nextSubscriptions, null, 2),
        description: "Recurring subscription and fixed expense records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setSubscriptions(nextSubscriptions);
    return true;
  };

  const addSubscription = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add subscriptions.");
      return;
    }

    if (!form.vendor || !form.amount) {
      setMessage("Vendor and amount are required.");
      return;
    }

    const subscription = {
      id: `subscription_${Date.now()}`,
      ...form,
      amount: Number(form.amount || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveSubscriptions([subscription, ...subscriptions]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Subscription Expense Created",
      table_name: "app_settings",
      record_id: subscription.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${subscription.vendor} ${subscription.frequency} $${subscription.amount}`
    });

    setMessage("Subscription saved.");
    setForm({
      vendor: "",
      description: "",
      category: "Software",
      amount: "",
      frequency: "Monthly",
      next_due_date: "",
      payment_method: "",
      status: "Active",
      notes: ""
    });
  };

  const updateSubscription = async (id, updates) => {
    const nextSubscriptions = subscriptions.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveSubscriptions(nextSubscriptions);
    if (saved) setMessage("Subscription updated.");
  };

  const monthlyCost = useMemo(() => {
    return subscriptions
      .filter((item) => item.status === "Active")
      .reduce((sum, item) => {
        const amount = Number(item.amount || 0);
        if (item.frequency === "Weekly") return sum + amount * 4.333;
        if (item.frequency === "Quarterly") return sum + amount / 3;
        if (item.frequency === "Yearly") return sum + amount / 12;
        return sum + amount;
      }, 0);
  }, [subscriptions]);

  const dueSoon = useMemo(() => {
    const today = new Date();
    const soon = new Date();
    soon.setDate(today.getDate() + 14);

    return subscriptions.filter((item) => {
      if (item.status !== "Active" || !item.next_due_date) return false;
      const dueDate = new Date(item.next_due_date);
      return dueDate <= soon;
    });
  }, [subscriptions]);

  return (
    <div>
      <h2>Recurring Subscriptions / Fixed Expenses</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Active" value={subscriptions.filter((item) => item.status === "Active").length} />
        <StatCard title="Monthly Cost" value={`$${monthlyCost.toFixed(2)}`} />
        <StatCard title="Yearly Cost" value={`$${(monthlyCost * 12).toFixed(2)}`} />
        <StatCard title="Due Soon" value={dueSoon.length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Subscription</h3>

        <div style={gridStyle}>
          <label>
            Vendor
            <input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Description
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Amount
            <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Frequency
            <select value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))} style={inputStyle}>
              {FREQUENCIES.map((frequency) => <option key={frequency}>{frequency}</option>)}
            </select>
          </label>

          <label>
            Next Due
            <input type="date" value={form.next_due_date} onChange={(e) => setForm((p) => ({ ...p, next_due_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Payment Method
            <input value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addSubscription} disabled={!canEditEverything}>
          Save Subscription
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Vendor</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Frequency</th>
            <th>Next Due</th>
            <th>Method</th>
          </tr>
        </thead>

        <tbody>
          {subscriptions.map((item) => (
            <tr key={item.id}>
              <td>
                <select value={item.status} onChange={(e) => updateSubscription(item.id, { status: e.target.value })} style={inputStyle} disabled={!canEditEverything}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{item.vendor}</td>
              <td>{item.description || "-"}</td>
              <td>{item.category || "-"}</td>
              <td>${Number(item.amount || 0).toFixed(2)}</td>
              <td>{item.frequency}</td>
              <td>{item.next_due_date || "-"}</td>
              <td>{item.payment_method || "-"}</td>
            </tr>
          ))}

          {subscriptions.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No subscriptions.</td></tr>}
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default SubscriptionExpenseManager;
