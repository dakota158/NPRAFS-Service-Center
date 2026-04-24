import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function canViewMoney(role) {
  return (
    role === "Manager" ||
    role === "IT" ||
    role === "admin" ||
    role === "Admin"
  );
}

function DashboardHome({ user }) {
  const role = user?.role || "Tech";
  const showMoney = canViewMoney(role);

  const [stats, setStats] = useState({
    activeOrders: 0,
    orderedOrders: 0,
    pendingOrders: 0,
    partsInStock: 0,
    historyRecords: 0,
    suppliers: 0,
    totalPaid: 0,
    totalCharged: 0,
    totalProfit: 0
  });

  const [recentAuditLogs, setRecentAuditLogs] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("received", false);

    const { data: parts } = await supabase.from("parts").select("*");
    const { data: history } = await supabase.from("history").select("*");
    const { data: suppliers } = await supabase.from("suppliers").select("*");

    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);

    const activeOrders = orders?.length || 0;
    const orderedOrders = orders?.filter((order) => order.part_ordered).length || 0;
    const pendingOrders = orders?.filter((order) => !order.part_ordered).length || 0;

    const partsInStock =
      parts?.reduce((sum, part) => sum + Number(part.quantity || 0), 0) || 0;

    const totalPaid =
      history?.reduce(
        (sum, item) =>
          sum + Number(item.cost || 0) * Number(item.quantity || 0),
        0
      ) || 0;

    const totalCharged =
      history?.reduce(
        (sum, item) =>
          sum + Number(item.net || 0) * Number(item.quantity || 0),
        0
      ) || 0;

    setStats({
      activeOrders,
      orderedOrders,
      pendingOrders,
      partsInStock,
      historyRecords: history?.length || 0,
      suppliers: suppliers?.length || 0,
      totalPaid,
      totalCharged,
      totalProfit: totalCharged - totalPaid
    });

    setRecentAuditLogs(auditLogs || []);
  };

  const maxValue = Math.max(
    stats.activeOrders,
    stats.orderedOrders,
    stats.pendingOrders,
    stats.partsInStock,
    stats.historyRecords,
    stats.suppliers,
    1
  );

  return (
    <div>
      <h2>Dashboard Overview</h2>

      <div style={cardGrid}>
        <StatCard title="Active Orders" value={stats.activeOrders} />
        <StatCard title="Pending Order Requests" value={stats.pendingOrders} />
        <StatCard title="Marked Ordered" value={stats.orderedOrders} />
        <StatCard title="Parts In Stock" value={stats.partsInStock} />
        <StatCard title="History Records" value={stats.historyRecords} />
        <StatCard title="Suppliers" value={stats.suppliers} />

        {showMoney && (
          <>
            <StatCard title="What We Paid" value={`$${stats.totalPaid.toFixed(2)}`} />
            <StatCard title="What We Charged" value={`$${stats.totalCharged.toFixed(2)}`} />
            <StatCard title="Total Profit" value={`$${stats.totalProfit.toFixed(2)}`} />
          </>
        )}
      </div>

      <h3>Status Tracking</h3>

      <div style={chartBox}>
        <Bar label="Active Orders" value={stats.activeOrders} maxValue={maxValue} />
        <Bar label="Pending Order Requests" value={stats.pendingOrders} maxValue={maxValue} />
        <Bar label="Marked Ordered" value={stats.orderedOrders} maxValue={maxValue} />
        <Bar label="Parts In Stock" value={stats.partsInStock} maxValue={maxValue} />
        <Bar label="History Records" value={stats.historyRecords} maxValue={maxValue} />
        <Bar label="Suppliers" value={stats.suppliers} maxValue={maxValue} />
      </div>

      {showMoney && (
        <>
          <h3>Financial Tracking</h3>

          <div style={chartBox}>
            <MoneyBar
              label="What We Paid"
              value={stats.totalPaid}
              maxValue={Math.max(stats.totalPaid, stats.totalCharged, 1)}
            />
            <MoneyBar
              label="What We Charged"
              value={stats.totalCharged}
              maxValue={Math.max(stats.totalPaid, stats.totalCharged, 1)}
            />
            <MoneyBar
              label="Total Profit"
              value={stats.totalProfit}
              maxValue={Math.max(
                Math.abs(stats.totalProfit),
                stats.totalPaid,
                stats.totalCharged,
                1
              )}
            />
          </div>
        </>
      )}

      <h3>Recent Audit Log</h3>

      <table
        border="1"
        cellPadding="8"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {recentAuditLogs.map((log) => (
            <tr key={log.id}>
              <td>
                {log.created_at
                  ? new Date(log.created_at).toLocaleString()
                  : "-"}
              </td>
              <td>{log.user_email || "-"}</td>
              <td>{log.action || "-"}</td>
              <td>{log.details || "-"}</td>
            </tr>
          ))}

          {recentAuditLogs.length === 0 && (
            <tr>
              <td colSpan="4" style={{ textAlign: "center" }}>
                No audit log entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: "bold", marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
}

function Bar({ label, value, maxValue }) {
  const width = `${Math.max((value / maxValue) * 100, 4)}%`;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>

      <div style={barTrack}>
        <div style={{ ...barFill, width }} />
      </div>
    </div>
  );
}

function MoneyBar({ label, value, maxValue }) {
  const width = `${Math.max((Math.abs(value) / maxValue) * 100, 4)}%`;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{label}</strong>
        <span>${value.toFixed(2)}</span>
      </div>

      <div style={barTrack}>
        <div
          style={{
            ...barFill,
            width,
            background: value < 0 ? "#dc2626" : "#16a34a"
          }}
        />
      </div>
    </div>
  );
}

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  marginBottom: 24
};

const statCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 4px 14px rgba(15,23,42,0.08)"
};

const chartBox = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  marginBottom: 24
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

export default DashboardHome;