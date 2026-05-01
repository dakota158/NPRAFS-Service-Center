import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function ShopHealthManager() {
  const [data, setData] = useState({
    invoices: [],
    customers: [],
    vehicles: [],
    parts: [],
    orders: [],
    settings: [],
    audit: []
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    const [
      invoices,
      customers,
      vehicles,
      parts,
      orders,
      settings,
      audit
    ] = await Promise.all([
      supabase.from("invoices").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("customer_vehicles").select("*"),
      supabase.from("parts").select("*"),
      supabase.from("orders").select("*"),
      supabase.from("app_settings").select("*"),
      supabase.from("audit_logs").select("*").limit(500)
    ]);

    if (invoices.error) {
      setMessage(invoices.error.message);
      return;
    }

    setData({
      invoices: invoices.data || [],
      customers: customers.data || [],
      vehicles: vehicles.data || [],
      parts: parts.data || [],
      orders: orders.data || [],
      settings: settings.data || [],
      audit: audit.data || []
    });
  };

  const checks = useMemo(() => {
    const missingCustomerLinks = data.invoices.filter(
      (invoice) => !invoice.customer_id && invoice.customer_name
    ).length;

    const missingVehicleLinks = data.invoices.filter(
      (invoice) => !invoice.vehicle_id && invoice.vehicle_vin
    ).length;

    const lowStock = data.parts.filter((part) => Number(part.quantity || 0) <= 1).length;
    const unpaid = data.invoices.filter(
      (invoice) =>
        (invoice.document_status === "Invoice" || !invoice.document_status) &&
        Number(invoice.grand_total || 0) > Number(invoice.amount_paid || 0)
    ).length;

    const missingSettings = [
      "company_name",
      "tax_rate",
      "shop_fee_type",
      "invoice_disclaimer",
      "pdf_footer_text"
    ].filter(
      (key) => !data.settings.some((setting) => setting.setting_key === key)
    );

    const staleOrders = data.orders.filter(
      (order) => !order.received && order.date_ordered
    ).length;

    return [
      {
        name: "Invoices loaded",
        status: data.invoices.length > 0 ? "OK" : "Review",
        detail: `${data.invoices.length} invoice/document records`
      },
      {
        name: "Customer links",
        status: missingCustomerLinks === 0 ? "OK" : "Review",
        detail: `${missingCustomerLinks} invoice(s) have customer names but no customer_id`
      },
      {
        name: "Vehicle links",
        status: missingVehicleLinks === 0 ? "OK" : "Review",
        detail: `${missingVehicleLinks} invoice(s) have VINs but no vehicle_id`
      },
      {
        name: "Low stock",
        status: lowStock === 0 ? "OK" : "Warning",
        detail: `${lowStock} low-stock part(s)`
      },
      {
        name: "Unpaid invoices",
        status: unpaid === 0 ? "OK" : "Review",
        detail: `${unpaid} unpaid/partial invoice(s)`
      },
      {
        name: "Core settings",
        status: missingSettings.length === 0 ? "OK" : "Review",
        detail:
          missingSettings.length === 0
            ? "Core settings found"
            : `Missing: ${missingSettings.join(", ")}`
      },
      {
        name: "Open orders",
        status: staleOrders === 0 ? "OK" : "Review",
        detail: `${staleOrders} ordered but not received item(s)`
      },
      {
        name: "Audit logging",
        status: data.audit.length > 0 ? "OK" : "Review",
        detail: `${data.audit.length} audit log records loaded`
      }
    ];
  }, [data]);

  const score = Math.round(
    (checks.filter((check) => check.status === "OK").length / checks.length) * 100
  );

  return (
    <div>
      <h2>Shop Health Check</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadHealth} style={{ marginBottom: 12 }}>
        Refresh Health Check
      </button>

      <div style={panelStyle}>
        <h3>Health Score: {score}%</h3>
        <div style={barTrack}>
          <div style={{ ...barFill, width: `${score}%` }} />
        </div>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Detail</th>
          </tr>
        </thead>

        <tbody>
          {checks.map((check) => (
            <tr key={check.name}>
              <td>{check.name}</td>
              <td>
                <strong
                  style={{
                    color:
                      check.status === "OK"
                        ? "green"
                        : check.status === "Warning"
                        ? "#b45309"
                        : "red"
                  }}
                >
                  {check.status}
                </strong>
              </td>
              <td>{check.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const barTrack = { background: "#e5e7eb", borderRadius: 10, height: 20, overflow: "hidden" };
const barFill = { background: "#2563eb", height: 20, borderRadius: 10 };

export default ShopHealthManager;
