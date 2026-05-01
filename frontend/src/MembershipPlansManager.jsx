import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PLAN_STATUSES = ["Active", "Paused", "Cancelled", "Expired"];

function MembershipPlansManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    plan_name: "Maintenance Club",
    monthly_fee: "",
    discount_percent: "10",
    included_services: "Priority scheduling\nMulti-point inspection\nDiscounted labor",
    start_date: new Date().toISOString().slice(0, 10),
    renewal_date: "",
    status: "Active",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, settingsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "membership_plans_json").maybeSingle()
    ]);

    if (customersResult.error) {
      setMessage(customersResult.error.message);
      return;
    }

    setCustomers(customersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setMemberships(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMemberships([]);
    }
  };

  const saveMemberships = async (nextMemberships) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "membership_plans_json",
        setting_value: JSON.stringify(nextMemberships, null, 2),
        description: "Customer membership/service plan records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setMemberships(nextMemberships);
    return true;
  };

  const addMembership = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add membership plans.");
      return;
    }

    if (!form.customer_id || !form.plan_name) {
      setMessage("Customer and plan name are required.");
      return;
    }

    const customer = customers.find((item) => item.id === form.customer_id);

    const membership = {
      id: `membership_${Date.now()}`,
      ...form,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
      customer_email: customer?.email || "",
      monthly_fee: Number(form.monthly_fee || 0),
      discount_percent: Number(form.discount_percent || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveMemberships([membership, ...memberships]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Membership Plan Created",
      table_name: "app_settings",
      record_id: membership.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${membership.customer_name} - ${membership.plan_name}`
    });

    setMessage("Membership saved.");
    setForm({
      customer_id: "",
      plan_name: "Maintenance Club",
      monthly_fee: "",
      discount_percent: "10",
      included_services: "Priority scheduling\nMulti-point inspection\nDiscounted labor",
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: "",
      status: "Active",
      notes: ""
    });
  };

  const updateMembership = async (id, updates) => {
    const next = memberships.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveMemberships(next);
    if (saved) setMessage("Membership updated.");
  };

  const monthlyRecurring = useMemo(
    () =>
      memberships
        .filter((item) => item.status === "Active")
        .reduce((sum, item) => sum + Number(item.monthly_fee || 0), 0),
    [memberships]
  );

  const copyMembershipMessage = async (membership) => {
    const text = `Hello ${membership.customer_name || ""},

Your ${membership.plan_name} membership includes:
${membership.included_services || ""}

Discount: ${membership.discount_percent || 0}%
Monthly Fee: $${Number(membership.monthly_fee || 0).toFixed(2)}

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Membership message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  return (
    <div>
      <h2>Customer Membership Plans</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("updated") || message.includes("copied") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Active Plans" value={memberships.filter((item) => item.status === "Active").length} />
        <StatCard title="Monthly Recurring" value={`$${monthlyRecurring.toFixed(2)}`} />
        <StatCard title="Yearly Recurring" value={`$${(monthlyRecurring * 12).toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Membership</h3>

        <div style={gridStyle}>
          <label>
            Customer
            <select value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))} style={inputStyle}>
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label>
            Plan Name
            <input value={form.plan_name} onChange={(e) => setForm((p) => ({ ...p, plan_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Monthly Fee
            <input type="number" value={form.monthly_fee} onChange={(e) => setForm((p) => ({ ...p, monthly_fee: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Discount %
            <input type="number" value={form.discount_percent} onChange={(e) => setForm((p) => ({ ...p, discount_percent: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Start Date
            <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Renewal Date
            <input type="date" value={form.renewal_date} onChange={(e) => setForm((p) => ({ ...p, renewal_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {PLAN_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Included Services
          <textarea value={form.included_services} onChange={(e) => setForm((p) => ({ ...p, included_services: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addMembership} disabled={!canEditEverything}>Save Membership</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Customer</th>
            <th>Plan</th>
            <th>Fee</th>
            <th>Discount</th>
            <th>Renewal</th>
            <th>Services</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {memberships.map((membership) => (
            <tr key={membership.id}>
              <td>
                <select value={membership.status} onChange={(e) => updateMembership(membership.id, { status: e.target.value })} style={inputStyle}>
                  {PLAN_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{membership.customer_name}<br /><small>{membership.customer_phone || membership.customer_email || ""}</small></td>
              <td>{membership.plan_name}</td>
              <td>${Number(membership.monthly_fee || 0).toFixed(2)}</td>
              <td>{Number(membership.discount_percent || 0).toFixed(2)}%</td>
              <td>{membership.renewal_date || "-"}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{membership.included_services}</td>
              <td><button type="button" onClick={() => copyMembershipMessage(membership)}>Copy Message</button></td>
            </tr>
          ))}

          {memberships.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No memberships.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 75, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default MembershipPlansManager;
