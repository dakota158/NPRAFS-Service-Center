import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function EndOfDayManager({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settingsItems, setSettingsItems] = useState({});
  const [message, setMessage] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [invoiceResult, paymentResult, orderResult, settingsResult] =
      await Promise.all([
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("invoice_payments").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase
          .from("app_settings")
          .select("*")
          .in("setting_key", ["customer_checkins_json", "quality_control_json", "follow_ups_json"])
      ]);

    if (invoiceResult.error || paymentResult.error || orderResult.error) {
      setMessage(invoiceResult.error?.message || paymentResult.error?.message || orderResult.error?.message);
      return;
    }

    setInvoices(invoiceResult.data || []);
    setPayments(paymentResult.data || []);
    setOrders(orderResult.data || []);

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

  const report = useMemo(() => {
    const dayInvoices = invoices.filter((invoice) =>
      String(invoice.created_at || invoice.invoice_date || "").startsWith(reportDate)
    );

    const dayPayments = payments.filter((payment) =>
      String(payment.payment_date || payment.created_at || "").startsWith(reportDate)
    );

    const dayOrders = orders.filter((order) =>
      String(order.created_at || "").startsWith(reportDate)
    );

    const checkIns = (settingsItems.customer_checkins_json || []).filter((item) =>
      String(item.checked_in_at || "").startsWith(reportDate)
    );

    const qc = (settingsItems.quality_control_json || []).filter((item) =>
      String(item.checked_at || "").startsWith(reportDate)
    );

    const followUps = (settingsItems.follow_ups_json || []).filter((item) =>
      String(item.completed_at || item.created_at || "").startsWith(reportDate)
    );

    return {
      invoiceCount: dayInvoices.length,
      revenue: dayInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0),
      payments: dayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      paymentCount: dayPayments.length,
      ordersCreated: dayOrders.length,
      checkIns: checkIns.length,
      qcCount: qc.length,
      qcPassed: qc.filter((item) => item.passed).length,
      followUps: followUps.length,
      readyJobs: invoices.filter((invoice) => invoice.status === "Ready").length,
      waitingParts: invoices.filter((invoice) => invoice.status === "Waiting Parts").length,
      unpaid: invoices.filter((invoice) => Number(invoice.grand_total || 0) > Number(invoice.amount_paid || 0)).length
    };
  }, [invoices, payments, orders, settingsItems, reportDate]);

  const exportReport = () => {
    const rows = [
      ["End Of Day Report", reportDate],
      ["Invoices Created", report.invoiceCount],
      ["Invoice Revenue", report.revenue],
      ["Payments Collected", report.payments],
      ["Payment Count", report.paymentCount],
      ["Orders Created", report.ordersCreated],
      ["Customer Check-Ins", report.checkIns],
      ["QC Checks", report.qcCount],
      ["QC Passed", report.qcPassed],
      ["Follow Ups Handled", report.followUps],
      ["Ready Jobs", report.readyJobs],
      ["Waiting Parts Jobs", report.waitingParts],
      ["Unpaid Documents", report.unpaid]
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `end-of-day-${reportDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>End Of Day Report</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Report Date
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={exportReport}>Export CSV</button>{" "}
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Invoices" value={report.invoiceCount} />
        <StatCard title="Revenue" value={`$${report.revenue.toFixed(2)}`} />
        <StatCard title="Payments" value={`$${report.payments.toFixed(2)}`} />
        <StatCard title="Payment Count" value={report.paymentCount} />
        <StatCard title="Orders Created" value={report.ordersCreated} />
        <StatCard title="Check-Ins" value={report.checkIns} />
        <StatCard title="QC Checks" value={report.qcCount} />
        <StatCard title="QC Passed" value={report.qcPassed} />
        <StatCard title="Follow Ups" value={report.followUps} />
        <StatCard title="Ready Jobs" value={report.readyJobs} />
        <StatCard title="Waiting Parts" value={report.waitingParts} />
        <StatCard title="Unpaid Docs" value={report.unpaid} />
      </div>

      <div style={panelStyle}>
        <h3>Closing Checklist</h3>
        <ul>
          <li>Review ready jobs and notify customers.</li>
          <li>Review unpaid invoices and payment notes.</li>
          <li>Confirm all received parts are updated.</li>
          <li>Confirm technician notes are complete.</li>
          <li>Run backup from Data Backup if needed.</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 220, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default EndOfDayManager;
