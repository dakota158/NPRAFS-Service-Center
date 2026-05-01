import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function WarrantyExpirationAlertManager() {
  const [documents, setDocuments] = useState([]);
  const [claims, setClaims] = useState([]);
  const [message, setMessage] = useState("");
  const [daysAhead, setDaysAhead] = useState("60");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, claimsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "warranty_claim_workflow_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(claimsResult.data?.setting_value || "[]");
      setClaims(Array.isArray(parsed) ? parsed : []);
    } catch {
      setClaims([]);
    }
  };

  const rows = useMemo(() => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + Number(daysAhead || 60));

    return documents
      .map((doc) => {
        const warrantyDays = Number(doc.warranty_days || doc.parts_warranty_days || doc.labor_warranty_days || 0);
        if (!warrantyDays) return null;

        const startDate = doc.invoice_date || doc.created_at;
        if (!startDate) return null;

        const expiration = new Date(startDate);
        expiration.setDate(expiration.getDate() + warrantyDays);

        const daysRemaining = Math.ceil((expiration.getTime() - now.getTime()) / 1000 / 60 / 60 / 24);
        const relatedClaims = claims.filter(
          (claim) =>
            claim.invoice_id === doc.id ||
            claim.document_number === doc.invoice_number ||
            claim.document_number === doc.repair_order_number
        );

        return {
          ...doc,
          warrantyDays,
          expiration,
          daysRemaining,
          relatedClaims
        };
      })
      .filter(Boolean)
      .filter((row) => row.expiration <= limit || row.daysRemaining < 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [documents, claims, daysAhead]);

  const copyAlert = async (row) => {
    const text = `Warranty Alert
Customer: ${row.customer_name || "-"}
Document: ${row.invoice_number || row.repair_order_number || row.estimate_number || "-"}
Vehicle: ${[row.vehicle_year, row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ")}
Warranty expires: ${row.expiration.toLocaleDateString()}
Days remaining: ${row.daysRemaining}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Warranty alert copied.");
    } catch {
      setMessage("Could not copy alert.");
    }
  };

  return (
    <div>
      <h2>Warranty Expiration Alerts</h2>

      {message && <p style={{ color: message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Alert Window Days
          <input type="number" value={daysAhead} onChange={(e) => setDaysAhead(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Alerts" value={rows.length} />
        <StatCard title="Expired" value={rows.filter((row) => row.daysRemaining < 0).length} />
        <StatCard title="With Claims" value={rows.filter((row) => row.relatedClaims.length > 0).length} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Warranty Days</th>
            <th>Expiration</th>
            <th>Claims</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ color: row.daysRemaining < 0 ? "red" : row.daysRemaining <= 14 ? "#b45309" : "green" }}>
                {row.daysRemaining < 0 ? "Expired" : `${row.daysRemaining} days`}
              </td>
              <td>{row.invoice_number || row.repair_order_number || row.estimate_number || "-"}</td>
              <td>{row.customer_name || "-"}</td>
              <td>{[row.vehicle_year, row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ") || "-"}</td>
              <td>{row.warrantyDays}</td>
              <td>{row.expiration.toLocaleDateString()}</td>
              <td>{row.relatedClaims.length}</td>
              <td><button type="button" onClick={() => copyAlert(row)}>Copy Alert</button></td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No warranty alerts.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 200, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default WarrantyExpirationAlertManager;
