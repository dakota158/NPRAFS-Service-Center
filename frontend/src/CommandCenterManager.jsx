import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CommandCenterManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settingsItems, setSettingsItems] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, partsResult, ordersResult, paymentsResult, settingsResult] =
      await Promise.all([
        supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
        supabase.from("parts").select("*").order("quantity", { ascending: true }),
        supabase.from("orders").select("*").eq("received", false),
        supabase.from("invoice_payments").select("*").order("created_at", { ascending: false }),
        supabase
          .from("app_settings")
          .select("*")
          .in("setting_key", ["follow_ups_json", "appointments_json", "time_clock_entries_json"])
      ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setParts(partsResult.data || []);
    setOrders(ordersResult.data || []);
    setPayments(paymentsResult.data || []);

    const loaded = {};
    (settingsResult.data || []).forEach((item) => {
      try {
        loaded[item.setting_key] = JSON.parse(item.setting_value || "[]");
      } catch {
        loaded[item.setting_key] = [];
      }
    });
    setSettingsItems(loaded);
  };

  const today = new Date().toISOString().slice(0, 10);

  const metrics = useMemo(() => {
    const openJobs = jobs.filter(
      (job) =>
        job.document_status === "Repair Order" &&
        !["Completed", "Delivered", "Cancelled"].includes(job.status)
    );

    const readyJobs = jobs.filter((job) => job.status === "Ready");
    const waitingParts = jobs.filter((job) => job.status === "Waiting Parts");
    const unpaidInvoices = jobs.filter((job) => {
      const paid = Number(job.amount_paid || 0);
      const total = Number(job.grand_total || 0);
      return (job.document_status === "Invoice" || !job.document_status) && total > paid;
    });

    const appointments = settingsItems.appointments_json || [];
    const followUps = settingsItems.follow_ups_json || [];
    const timeEntries = settingsItems.time_clock_entries_json || [];

    return {
      openJobs: openJobs.length,
      readyJobs: readyJobs.length,
      waitingParts: waitingParts.length,
      lowStock: parts.filter((part) => Number(part.quantity || 0) <= 1).length,
      openOrders: orders.length,
      unpaidInvoices: unpaidInvoices.length,
      balanceDue: unpaidInvoices.reduce(
        (sum, invoice) =>
          sum +
          Math.max(
            0,
            Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)
          ),
        0
      ),
      appointmentsToday: appointments.filter((appt) => appt.appointment_date === today).length,
      overdueFollowUps: followUps.filter(
        (item) => !item.completed && item.due_date && item.due_date < today
      ).length,
      clockedIn: timeEntries.filter((entry) => !entry.clock_out).length
    };
  }, [jobs, parts, orders, settingsItems, today]);

  const alerts = useMemo(() => {
    const list = [];

    if (metrics.waitingParts) list.push(`${metrics.waitingParts} job(s) waiting on parts`);
    if (metrics.lowStock) list.push(`${metrics.lowStock} low-stock inventory item(s)`);
    if (metrics.unpaidInvoices) list.push(`${metrics.unpaidInvoices} unpaid invoice(s)`);
    if (metrics.overdueFollowUps) list.push(`${metrics.overdueFollowUps} overdue follow-up(s)`);
    if (metrics.readyJobs) list.push(`${metrics.readyJobs} job(s) ready for customer`);

    return list;
  }, [metrics]);

  return (
    <div>
      <h2>Command Center</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh Command Center
      </button>

      <div style={cardGrid}>
        <StatCard title="Open Jobs" value={metrics.openJobs} />
        <StatCard title="Ready Jobs" value={metrics.readyJobs} />
        <StatCard title="Waiting Parts" value={metrics.waitingParts} />
        <StatCard title="Low Stock" value={metrics.lowStock} />
        <StatCard title="Open Orders" value={metrics.openOrders} />
        <StatCard title="Appointments Today" value={metrics.appointmentsToday} />
        <StatCard title="Clocked In" value={metrics.clockedIn} />
        <StatCard title="Overdue Follow Ups" value={metrics.overdueFollowUps} />
        <StatCard title="Balance Due" value={`$${metrics.balanceDue.toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <h3>Priority Alerts</h3>
        {alerts.length === 0 ? (
          <p>No priority alerts right now.</p>
        ) : (
          <ul>
            {alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={panelStyle}>
        <h3>Recent Active Jobs</h3>
        <table border="1" cellPadding="8" style={tableStyle}>
          <thead>
            <tr>
              <th>RO / Invoice</th>
              <th>Status</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Total</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {jobs.slice(0, 12).map((job) => (
              <tr key={job.id}>
                <td>{job.repair_order_number || job.invoice_number || job.estimate_number || "-"}</td>
                <td>{job.status || job.document_status || "-"}</td>
                <td>{job.customer_name || "-"}</td>
                <td>{[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ") || "-"}</td>
                <td>${Number(job.grand_total || 0).toFixed(2)}</td>
                <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div>
    </div>
  );
}

const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default CommandCenterManager;
