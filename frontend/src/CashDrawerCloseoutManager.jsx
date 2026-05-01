import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CashDrawerCloseoutManager({ user, canEditEverything }) {
  const [payments, setPayments] = useState([]);
  const [closeouts, setCloseouts] = useState([]);
  const [message, setMessage] = useState("");
  const [closeoutDate, setCloseoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    counted_cash: "",
    counted_checks: "",
    card_batch_total: "",
    adjustments: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [paymentsResult, closeoutsResult] = await Promise.all([
      supabase.from("invoice_payments").select("*, invoices(invoice_number, repair_order_number, customer_name)").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "cash_drawer_closeouts_json").maybeSingle()
    ]);

    if (paymentsResult.error) {
      setMessage(paymentsResult.error.message);
      return;
    }

    setPayments(paymentsResult.data || []);

    try {
      const parsed = JSON.parse(closeoutsResult.data?.setting_value || "[]");
      setCloseouts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCloseouts([]);
    }
  };

  const saveCloseouts = async (nextCloseouts) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "cash_drawer_closeouts_json",
        setting_value: JSON.stringify(nextCloseouts, null, 2),
        description: "Daily cash drawer closeout records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setCloseouts(nextCloseouts);
    return true;
  };

  const dailyPayments = useMemo(
    () =>
      payments.filter((payment) =>
        String(payment.payment_date || payment.created_at || "").startsWith(closeoutDate)
      ),
    [payments, closeoutDate]
  );

  const expected = useMemo(() => {
    const totals = { Cash: 0, Check: 0, Card: 0, Other: 0 };

    dailyPayments.forEach((payment) => {
      const method = String(payment.payment_method || "Other").toLowerCase();
      if (method.includes("cash")) totals.Cash += Number(payment.amount || 0);
      else if (method.includes("check")) totals.Check += Number(payment.amount || 0);
      else if (method.includes("card") || method.includes("credit") || method.includes("debit")) totals.Card += Number(payment.amount || 0);
      else totals.Other += Number(payment.amount || 0);
    });

    return totals;
  }, [dailyPayments]);

  const variance = useMemo(() => {
    const countedCash = Number(form.counted_cash || 0);
    const countedChecks = Number(form.counted_checks || 0);
    const cardBatch = Number(form.card_batch_total || 0);
    const adjustments = Number(form.adjustments || 0);
    const expectedTotal = expected.Cash + expected.Check + expected.Card + expected.Other;
    const countedTotal = countedCash + countedChecks + cardBatch + adjustments + expected.Other;

    return {
      expectedTotal,
      countedTotal,
      variance: countedTotal - expectedTotal
    };
  }, [form, expected]);

  const saveCloseout = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save closeouts.");
      return;
    }

    const record = {
      id: `closeout_${Date.now()}`,
      closeout_date: closeoutDate,
      expected_cash: expected.Cash,
      expected_checks: expected.Check,
      expected_card: expected.Card,
      expected_other: expected.Other,
      counted_cash: Number(form.counted_cash || 0),
      counted_checks: Number(form.counted_checks || 0),
      card_batch_total: Number(form.card_batch_total || 0),
      adjustments: Number(form.adjustments || 0),
      expected_total: variance.expectedTotal,
      counted_total: variance.countedTotal,
      variance: variance.variance,
      payment_count: dailyPayments.length,
      notes: form.notes,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveCloseouts([record, ...closeouts]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Cash Drawer Closeout Saved",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${record.closeout_date} variance $${record.variance.toFixed(2)}`
    });

    setMessage("Closeout saved.");
    setForm({
      counted_cash: "",
      counted_checks: "",
      card_batch_total: "",
      adjustments: "",
      notes: ""
    });
  };

  return (
    <div>
      <h2>Cash Drawer Closeout</h2>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Closeout Date
          <input type="date" value={closeoutDate} onChange={(e) => setCloseoutDate(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Payments" value={dailyPayments.length} />
        <StatCard title="Expected Cash" value={`$${expected.Cash.toFixed(2)}`} />
        <StatCard title="Expected Checks" value={`$${expected.Check.toFixed(2)}`} />
        <StatCard title="Expected Card" value={`$${expected.Card.toFixed(2)}`} />
        <StatCard title="Expected Total" value={`$${variance.expectedTotal.toFixed(2)}`} />
        <StatCard title="Variance" value={`$${variance.variance.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Count Drawer</h3>

        <div style={gridStyle}>
          <label>
            Counted Cash
            <input type="number" value={form.counted_cash} onChange={(e) => setForm((p) => ({ ...p, counted_cash: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Counted Checks
            <input type="number" value={form.counted_checks} onChange={(e) => setForm((p) => ({ ...p, counted_checks: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Card Batch Total
            <input type="number" value={form.card_batch_total} onChange={(e) => setForm((p) => ({ ...p, card_batch_total: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Adjustments
            <input type="number" value={form.adjustments} onChange={(e) => setForm((p) => ({ ...p, adjustments: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={saveCloseout} disabled={!canEditEverything}>Save Closeout</button>
      </div>

      <h3>Closeout History</h3>
      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Payments</th>
            <th>Expected</th>
            <th>Counted</th>
            <th>Variance</th>
            <th>User</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {closeouts.map((item) => (
            <tr key={item.id}>
              <td>{item.closeout_date}</td>
              <td>{item.payment_count}</td>
              <td>${Number(item.expected_total || 0).toFixed(2)}</td>
              <td>${Number(item.counted_total || 0).toFixed(2)}</td>
              <td style={{ color: Math.abs(Number(item.variance || 0)) > 0.01 ? "red" : "green" }}>${Number(item.variance || 0).toFixed(2)}</td>
              <td>{item.created_by_email || "-"}</td>
              <td>{item.notes || "-"}</td>
            </tr>
          ))}
          {closeouts.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No closeouts.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 70 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CashDrawerCloseoutManager;
