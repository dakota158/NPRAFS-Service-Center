import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function canViewMoney(role) {
  return role === "Manager" || role === "IT" || role === "admin" || role === "Admin";
}

function AnalyticsManager({ user }) {
  const role = user?.role || "Tech";
  const showMoney = canViewMoney(role);

  const [stats, setStats] = useState({
    invoiceCount: 0,
    estimateCount: 0,
    repairOrderCount: 0,
    totalRevenue: 0,
    totalPaid: 0,
    balanceDue: 0,
    laborSubtotal: 0,
    partsSubtotal: 0,
    partsInStock: 0,
    lowStockCount: 0,
    openOrders: 0,
    suppliers: 0,
    customers: 0,
    vehicles: 0
  });

  const [topServices, setTopServices] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setMessage("");

    const [
      invoicesResult,
      partsResult,
      ordersResult,
      suppliersResult,
      customersResult,
      vehiclesResult
    ] = await Promise.all([
      supabase.from("invoices").select("*"),
      supabase.from("parts").select("*"),
      supabase.from("orders").select("*"),
      supabase.from("suppliers").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("customer_vehicles").select("*")
    ]);

    if (invoicesResult.error) {
      setMessage(invoicesResult.error.message);
      return;
    }

    const invoices = invoicesResult.data || [];
    const parts = partsResult.data || [];
    const orders = ordersResult.data || [];
    const suppliers = suppliersResult.data || [];
    const customers = customersResult.data || [];
    const vehicles = vehiclesResult.data || [];

    const serviceCounts = {};

    invoices.forEach((invoice) => {
      (invoice.labor_items || []).forEach((labor) => {
        const name = labor.description || labor.rate_name || "Labor";
        serviceCounts[name] = (serviceCounts[name] || 0) + 1;
      });
    });

    setTopServices(
      Object.entries(serviceCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    );

    setStats({
      invoiceCount: invoices.filter(
        (item) => item.document_status === "Invoice" || !item.document_status
      ).length,
      estimateCount: invoices.filter((item) => item.document_status === "Estimate")
        .length,
      repairOrderCount: invoices.filter(
        (item) => item.document_status === "Repair Order"
      ).length,
      totalRevenue: invoices.reduce(
        (sum, item) => sum + Number(item.grand_total || 0),
        0
      ),
      totalPaid: invoices.reduce(
        (sum, item) => sum + Number(item.amount_paid || 0),
        0
      ),
      balanceDue: invoices.reduce(
        (sum, item) =>
          sum +
          Number(
            item.balance_due ||
              Number(item.grand_total || 0) - Number(item.amount_paid || 0)
          ),
        0
      ),
      laborSubtotal: invoices.reduce(
        (sum, item) => sum + Number(item.labor_subtotal || 0),
        0
      ),
      partsSubtotal: invoices.reduce(
        (sum, item) => sum + Number(item.parts_subtotal || 0),
        0
      ),
      partsInStock: parts.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      ),
      lowStockCount: parts.filter((item) => Number(item.quantity || 0) <= 1).length,
      openOrders: orders.filter((item) => !item.received).length,
      suppliers: suppliers.length,
      customers: customers.length,
      vehicles: vehicles.length
    });
  };

  const maxMoney = Math.max(
    stats.totalRevenue,
    stats.laborSubtotal,
    stats.partsSubtotal,
    stats.balanceDue,
    1
  );

  return (
    <div>
      <h2>Analytics / Profit Dashboard</h2>

      {!showMoney && (
        <p style={{ color: "red" }}>
          Only Manager, IT, and Admin roles can view financial analytics.
        </p>
      )}

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAnalytics} style={{ marginBottom: 12 }}>
        Refresh Analytics
      </button>

      <div style={cardGrid}>
        <StatCard title="Invoices" value={stats.invoiceCount} />
        <StatCard title="Estimates" value={stats.estimateCount} />
        <StatCard title="Repair Orders" value={stats.repairOrderCount} />
        <StatCard title="Customers" value={stats.customers} />
        <StatCard title="Vehicles" value={stats.vehicles} />
        <StatCard title="Parts In Stock" value={stats.partsInStock} />
        <StatCard title="Low Stock Items" value={stats.lowStockCount} />
        <StatCard title="Open Orders" value={stats.openOrders} />
        <StatCard title="Suppliers" value={stats.suppliers} />

        {showMoney && (
          <>
            <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} />
            <StatCard title="Amount Paid" value={`$${stats.totalPaid.toFixed(2)}`} />
            <StatCard title="Balance Due" value={`$${stats.balanceDue.toFixed(2)}`} />
          </>
        )}
      </div>

      {showMoney && (
        <div style={panelStyle}>
          <h3>Revenue Breakdown</h3>
          <MoneyBar label="Revenue" value={stats.totalRevenue} maxValue={maxMoney} />
          <MoneyBar label="Labor" value={stats.laborSubtotal} maxValue={maxMoney} />
          <MoneyBar label="Parts" value={stats.partsSubtotal} maxValue={maxMoney} />
          <MoneyBar label="Balance Due" value={stats.balanceDue} maxValue={maxMoney} />
        </div>
      )}

      <div style={panelStyle}>
        <h3>Top Services</h3>

        {topServices.length === 0 && <p>No labor/service data yet.</p>}

        {topServices.map((service) => (
          <div key={service.name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{service.name}</strong>
              <span>{service.count}</span>
            </div>
            <div style={barTrack}>
              <div
                style={{
                  ...barFill,
                  width: `${Math.max(
                    (service.count / Math.max(topServices[0]?.count || 1, 1)) *
                      100,
                    4
                  )}%`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

function MoneyBar({ label, value, maxValue }) {
  const width = `${Math.max((Math.abs(value) / maxValue) * 100, 4)}%`;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{label}</strong>
        <span>${value.toFixed(2)}</span>
      </div>
      <div style={barTrack}>
        <div style={{ ...barFill, width }} />
      </div>
    </div>
  );
}

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 18
};

const statCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const barTrack = {
  background: "#e5e7eb",
  borderRadius: 10,
  height: 18,
  overflow: "hidden"
};

const barFill = {
  height: 18,
  borderRadius: 10,
  background: "#2563eb"
};

export default AnalyticsManager;
