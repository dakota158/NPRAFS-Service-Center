import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function GoalsKpiManager({ user, canEditEverything }) {
  const [invoices, setInvoices] = useState([]);
  const [goals, setGoals] = useState({
    monthly_revenue: "25000",
    monthly_invoice_count: "50",
    monthly_labor_revenue: "10000",
    monthly_parts_revenue: "10000",
    max_open_jobs: "20",
    low_stock_limit: "5"
  });
  const [parts, setParts] = useState([]);
  const [message, setMessage] = useState("");
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, partsResult, goalsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
      supabase.from("parts").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "kpi_goals_json").maybeSingle()
    ]);

    if (invoiceResult.error || partsResult.error) {
      setMessage(invoiceResult.error?.message || partsResult.error?.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setParts(partsResult.data || []);

    try {
      const parsed = JSON.parse(goalsResult.data?.setting_value || "{}");
      setGoals((prev) => ({ ...prev, ...parsed }));
    } catch {}
  };

  const saveGoals = async () => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can save KPI goals.");
      return;
    }

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "kpi_goals_json",
        setting_value: JSON.stringify(goals, null, 2),
        description: "Shop KPI goals",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("KPI goals saved.");
  };

  const report = useMemo(() => {
    const monthInvoices = invoices.filter((invoice) =>
      monthFilter ? String(invoice.invoice_date || "").startsWith(monthFilter) : true
    );

    const openJobs = invoices.filter(
      (invoice) =>
        invoice.document_status === "Repair Order" &&
        !["Completed", "Delivered", "Cancelled"].includes(invoice.status)
    );

    return {
      revenue: monthInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.grand_total || 0),
        0
      ),
      invoiceCount: monthInvoices.length,
      laborRevenue: monthInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.labor_subtotal || 0),
        0
      ),
      partsRevenue: monthInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.parts_subtotal || 0),
        0
      ),
      openJobs: openJobs.length,
      lowStock: parts.filter((part) => Number(part.quantity || 0) <= 1).length
    };
  }, [invoices, parts, monthFilter]);

  const goalRows = [
    {
      key: "monthly_revenue",
      label: "Monthly Revenue",
      current: report.revenue,
      goal: Number(goals.monthly_revenue || 0),
      money: true
    },
    {
      key: "monthly_invoice_count",
      label: "Monthly Invoice Count",
      current: report.invoiceCount,
      goal: Number(goals.monthly_invoice_count || 0)
    },
    {
      key: "monthly_labor_revenue",
      label: "Monthly Labor Revenue",
      current: report.laborRevenue,
      goal: Number(goals.monthly_labor_revenue || 0),
      money: true
    },
    {
      key: "monthly_parts_revenue",
      label: "Monthly Parts Revenue",
      current: report.partsRevenue,
      goal: Number(goals.monthly_parts_revenue || 0),
      money: true
    },
    {
      key: "max_open_jobs",
      label: "Max Open Jobs",
      current: report.openJobs,
      goal: Number(goals.max_open_jobs || 0),
      inverse: true
    },
    {
      key: "low_stock_limit",
      label: "Low Stock Limit",
      current: report.lowStock,
      goal: Number(goals.low_stock_limit || 0),
      inverse: true
    }
  ];

  return (
    <div>
      <h2>KPI Goals</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <label>
          Month
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={gridStyle}>
        {goalRows.map((row) => (
          <div key={row.key} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{row.label}</h3>

            <label>
              Goal
              <input
                type="number"
                value={goals[row.key]}
                onChange={(e) =>
                  setGoals((prev) => ({
                    ...prev,
                    [row.key]: e.target.value
                  }))
                }
                disabled={!canEditEverything}
                style={inputStyle}
              />
            </label>

            <p>
              Current:{" "}
              <strong>
                {row.money ? `$${row.current.toFixed(2)}` : row.current}
              </strong>
            </p>

            <ProgressBar
              current={row.current}
              goal={row.goal}
              inverse={row.inverse}
            />
          </div>
        ))}
      </div>

      <button type="button" onClick={saveGoals} disabled={!canEditEverything}>
        Save KPI Goals
      </button>
    </div>
  );
}

function ProgressBar({ current, goal, inverse }) {
  const safeGoal = Math.max(Number(goal || 0), 1);
  const percent = inverse
    ? Math.max(0, 100 - (Number(current || 0) / safeGoal) * 100)
    : Math.min(100, (Number(current || 0) / safeGoal) * 100);

  return (
    <div style={barTrack}>
      <div
        style={{
          ...barFill,
          width: `${Math.max(percent, 4)}%`
        }}
      />
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12
};

const barTrack = {
  background: "#e5e7eb",
  borderRadius: 10,
  height: 18,
  overflow: "hidden"
};

const barFill = {
  background: "#2563eb",
  height: 18,
  borderRadius: 10
};

export default GoalsKpiManager;
