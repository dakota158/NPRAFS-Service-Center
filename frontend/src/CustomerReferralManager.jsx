import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["New", "Reward Pending", "Reward Issued", "Closed", "Disqualified"];

function CustomerReferralManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    referring_customer_id: "",
    referring_customer_name: "",
    referred_customer_name: "",
    referred_customer_phone: "",
    referred_customer_email: "",
    referral_date: new Date().toISOString().slice(0, 10),
    reward_amount: "",
    status: "New",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, referralsResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_referrals_json").maybeSingle()
    ]);

    if (customersResult.error) {
      setMessage(customersResult.error.message);
      return;
    }

    setCustomers(customersResult.data || []);

    try {
      const parsed = JSON.parse(referralsResult.data?.setting_value || "[]");
      setReferrals(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReferrals([]);
    }
  };

  const saveReferrals = async (nextReferrals) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "customer_referrals_json",
        setting_value: JSON.stringify(nextReferrals, null, 2),
        description: "Customer referral tracking records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setReferrals(nextReferrals);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "referring_customer_id") {
        const customer = customers.find((item) => item.id === value);
        if (customer) next.referring_customer_name = customer.name || "";
      }
      return next;
    });
  };

  const addReferral = async () => {
    setMessage("");

    if (!form.referring_customer_name || !form.referred_customer_name) {
      setMessage("Referring and referred customer names are required.");
      return;
    }

    const referral = {
      id: `referral_${Date.now()}`,
      ...form,
      reward_amount: Number(form.reward_amount || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveReferrals([referral, ...referrals]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Customer Referral Created",
      table_name: "app_settings",
      record_id: referral.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${referral.referring_customer_name} referred ${referral.referred_customer_name}`
    });

    setMessage("Referral saved.");
    setForm({
      referring_customer_id: "",
      referring_customer_name: "",
      referred_customer_name: "",
      referred_customer_phone: "",
      referred_customer_email: "",
      referral_date: new Date().toISOString().slice(0, 10),
      reward_amount: "",
      status: "New",
      notes: ""
    });
  };

  const updateReferral = async (id, updates) => {
    const next = referrals.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveReferrals(next);
    if (saved) setMessage("Referral updated.");
  };

  const totals = useMemo(
    () => ({
      count: referrals.length,
      pending: referrals.filter((item) => item.status === "Reward Pending").length,
      rewards: referrals.reduce((sum, item) => sum + Number(item.reward_amount || 0), 0)
    }),
    [referrals]
  );

  return (
    <div>
      <h2>Customer Referral Tracking</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Referrals" value={totals.count} />
        <StatCard title="Pending Rewards" value={totals.pending} />
        <StatCard title="Reward Value" value={`$${totals.rewards.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Referral</h3>

        <div style={gridStyle}>
          <label>
            Referring Customer
            <select value={form.referring_customer_id} onChange={(e) => updateForm("referring_customer_id", e.target.value)} style={inputStyle}>
              <option value="">Manual entry</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label>
            Referring Name
            <input value={form.referring_customer_name} onChange={(e) => updateForm("referring_customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Referred Name
            <input value={form.referred_customer_name} onChange={(e) => updateForm("referred_customer_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Referred Phone
            <input value={form.referred_customer_phone} onChange={(e) => updateForm("referred_customer_phone", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Referred Email
            <input value={form.referred_customer_email} onChange={(e) => updateForm("referred_customer_email", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Date
            <input type="date" value={form.referral_date} onChange={(e) => updateForm("referral_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Reward Amount
            <input type="number" value={form.reward_amount} onChange={(e) => updateForm("reward_amount", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addReferral}>Save Referral</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Referring</th>
            <th>Referred</th>
            <th>Contact</th>
            <th>Date</th>
            <th>Reward</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {referrals.map((referral) => (
            <tr key={referral.id}>
              <td>
                <select value={referral.status} onChange={(e) => updateReferral(referral.id, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{referral.referring_customer_name}</td>
              <td>{referral.referred_customer_name}</td>
              <td>{referral.referred_customer_phone || "-"}<br /><small>{referral.referred_customer_email || ""}</small></td>
              <td>{referral.referral_date || "-"}</td>
              <td>${Number(referral.reward_amount || 0).toFixed(2)}</td>
              <td>{referral.notes || "-"}</td>
            </tr>
          ))}

          {referrals.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No referrals.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CustomerReferralManager;
