import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const GOAL_TYPES = ["Revenue", "Car Count", "Average Ticket", "Gross Estimate", "Customer Satisfaction", "Custom"];

function ShopGoalTrackingManager({ user, canEditEverything }) {
  const [goals, setGoals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [satisfaction, setSatisfaction] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    goal_name: "",
    goal_type: "Revenue",
    target_value: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [goalsResult, invoicesResult, satResult] = await Promise.all([
      supabase.from("app_settings").select("*").eq("setting_key", "shop_goals_json").maybeSingle(),
      supabase.from("invoices").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "customer_satisfaction_json").maybeSingle()
    ]);

    if (invoicesResult.error) {
      setMessage(invoicesResult.error.message);
      return;
    }

    setInvoices(invoicesResult.data || []);

    try {
      const parsed = JSON.parse(goalsResult.data?.setting_value || "[]");
      setGoals(Array.isArray(parsed) ? parsed : []);
    } catch {
      setGoals([]);
    }

    try {
      const parsedSat = JSON.parse(satResult.data?.setting_value || "[]");
      setSatisfaction(Array.isArray(parsedSat) ? parsedSat : []);
    } catch {
      setSatisfaction([]);
    }
  };

  const saveGoals = async (nextGoals) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "shop_goals_json",
        setting_value: JSON.stringify(nextGoals, null, 2),
        description: "Shop goal tracking records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setGoals(nextGoals);
    return true;
  };

  const addGoal = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add shop goals.");
      return;
    }

    if (!form.goal_name || !form.target_value) {
      setMessage("Goal name and target are required.");
      return;
    }

    const goal = {
      id: `goal_${Date.now()}`,
      ...form,
      target_value: Number(form.target_value || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveGoals([goal, ...goals]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Shop Goal Created",
      table_name: "app_settings",
      record_id: goal.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${goal.goal_name}: ${goal.target_value}`
    });

    setMessage("Goal saved.");
    setForm({
      goal_name: "",
      goal_type: "Revenue",
      target_value: "",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      notes: ""
    });
  };

  const getGoalActual = (goal) => {
    const start = goal.start_date ? new Date(goal.start_date) : null;
    const end = goal.end_date ? new Date(goal.end_date) : null;

    const filteredInvoices = invoices.filter((invoice) => {
      const date = new Date(invoice.invoice_date || invoice.created_at || "");
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });

    if (goal.goal_type === "Revenue") {
      return filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
    }

    if (goal.goal_type === "Car Count") {
      return filteredInvoices.length;
    }

    if (goal.goal_type === "Average Ticket") {
      const total = filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
      return filteredInvoices.length ? total / filteredInvoices.length : 0;
    }

    if (goal.goal_type === "Gross Estimate") {
      return filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0) - Number(invoice.parts_cost || 0), 0);
    }

    if (goal.goal_type === "Customer Satisfaction") {
      const filteredSat = satisfaction.filter((item) => {
        const date = new Date(item.created_at || "");
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });

      return filteredSat.length ? filteredSat.reduce((sum, item) => sum + Number(item.rating || 0), 0) / filteredSat.length : 0;
    }

    return Number(goal.actual_value || 0);
  };

  const rows = useMemo(
    () =>
      goals.map((goal) => {
        const actual = getGoalActual(goal);
        const progress = Number(goal.target_value || 0) > 0 ? (actual / Number(goal.target_value || 0)) * 100 : 0;

        return {
          ...goal,
          actual,
          progress
        };
      }),
    [goals, invoices, satisfaction]
  );

  return (
    <div>
      <h2>Shop Goal Tracking</h2>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Add Goal</h3>

        <div style={gridStyle}>
          <label>
            Goal Name
            <input value={form.goal_name} onChange={(e) => setForm((p) => ({ ...p, goal_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Goal Type
            <select value={form.goal_type} onChange={(e) => setForm((p) => ({ ...p, goal_type: e.target.value }))} style={inputStyle}>
              {GOAL_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          <label>
            Target Value
            <input type="number" value={form.target_value} onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Start Date
            <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            End Date
            <input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addGoal} disabled={!canEditEverything}>Save Goal</button>
      </div>

      <div style={goalGrid}>
        {rows.map((goal) => (
          <div key={goal.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{goal.goal_name}</h3>
            <p><strong>{goal.goal_type}</strong> | {goal.start_date || "-"} to {goal.end_date || "-"}</p>
            <p>Target: {goal.target_value}</p>
            <p>Actual: {goal.actual.toFixed(goal.goal_type === "Customer Satisfaction" ? 1 : 2)}</p>
            <div style={barTrack}>
              <div style={{ ...barFill, width: `${Math.min(goal.progress, 100)}%` }} />
            </div>
            <p>{goal.progress.toFixed(1)}% complete</p>
            <p>{goal.notes || ""}</p>
          </div>
        ))}

        {rows.length === 0 && <p>No goals created.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const goalGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 };
const barTrack = { background: "#e5e7eb", height: 18, borderRadius: 999, overflow: "hidden" };
const barFill = { background: "#2563eb", height: 18, borderRadius: 999 };

export default ShopGoalTrackingManager;
