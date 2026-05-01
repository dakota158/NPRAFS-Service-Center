import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function EstimateConversionManager() {
  const [documents, setDocuments] = useState([]);
  const [lostSales, setLostSales] = useState([]);
  const [message, setMessage] = useState("");
  const [daysWindow, setDaysWindow] = useState("90");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, lostResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "lost_sales_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(lostResult.data?.setting_value || "[]");
      setLostSales(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLostSales([]);
    }
  };

  const report = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysWindow || 90));

    const docs = documents.filter((doc) => {
      const created = doc.created_at ? new Date(doc.created_at) : null;
      return !created || created >= cutoff;
    });

    const estimates = docs.filter((doc) => doc.document_status === "Estimate" || doc.estimate_number);
    const converted = estimates.filter((estimate) => {
      const number = estimate.estimate_number || estimate.invoice_number || estimate.repair_order_number;
      return docs.some((doc) => doc.id !== estimate.id && number && (doc.repair_order_number === number || doc.invoice_number === number));
    });

    const invoicedFromSameNumber = docs.filter((doc) => doc.document_status === "Invoice" || doc.invoice_number);
    const lost = lostSales.filter((item) => {
      const created = item.created_at ? new Date(item.created_at) : null;
      return !created || created >= cutoff;
    });

    const estimateValue = estimates.reduce((sum, doc) => sum + Number(doc.grand_total || 0), 0);
    const convertedValue = converted.reduce((sum, doc) => sum + Number(doc.grand_total || 0), 0);
    const invoiceValue = invoicedFromSameNumber.reduce((sum, doc) => sum + Number(doc.grand_total || 0), 0);

    return {
      estimates,
      converted,
      lost,
      estimateValue,
      convertedValue,
      invoiceValue,
      conversionRate: estimates.length ? Math.round((converted.length / estimates.length) * 100) : 0,
      valueConversionRate: estimateValue ? Math.round((convertedValue / estimateValue) * 100) : 0
    };
  }, [documents, lostSales, daysWindow]);

  return (
    <div>
      <h2>Estimate Conversion Tracking</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Lookback Days
          <input type="number" value={daysWindow} onChange={(e) => setDaysWindow(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Estimates" value={report.estimates.length} />
        <StatCard title="Converted" value={report.converted.length} />
        <StatCard title="Conversion Rate" value={`${report.conversionRate}%`} />
        <StatCard title="Estimate Value" value={`$${report.estimateValue.toFixed(2)}`} />
        <StatCard title="Converted Value" value={`$${report.convertedValue.toFixed(2)}`} />
        <StatCard title="Lost Sales" value={report.lost.length} />
      </div>

      <div style={panelStyle}>
        <h3>Recent Estimates</h3>
        <table border="1" cellPadding="8" style={tableStyle}>
          <thead>
            <tr>
              <th>Estimate</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {report.estimates.slice(0, 100).map((doc) => {
              const number = doc.estimate_number || doc.invoice_number || doc.repair_order_number;
              const converted = report.converted.some((item) => item.id === doc.id);
              return (
                <tr key={doc.id}>
                  <td>{number || "-"}</td>
                  <td>{doc.customer_name || "-"}</td>
                  <td>${Number(doc.grand_total || 0).toFixed(2)}</td>
                  <td style={{ color: converted ? "green" : "red" }}>{converted ? "Converted" : doc.status || "Open"}</td>
                  <td>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "-"}</td>
                </tr>
              );
            })}

            {report.estimates.length === 0 && <tr><td colSpan="5" style={{ textAlign: "center" }}>No estimates found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 180, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default EstimateConversionManager;
