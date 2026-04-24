import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function DashboardHome() {
  const [stats, setStats] = useState({
    activeOrders: 0,
    orderedNotReceived: 0,
    partsWaiting: 0,
    historyCount: 0,
    totalProfit: 0,
    monthlyProfit: 0
  });

  const [alerts, setAlerts] = useState([]);
  const [message, setMessage] = useState("");

  const loadStats = async () => {
    try {
      const ordersResult = await supabase.from("orders").select("*");
      const partsResult = await supabase.from("parts").select("*");
      const historyResult = await supabase.from("history").select("*");

      if (ordersResult.error) {
        setMessage(ordersResult.error.message);
        return;
      }

      if (partsResult.error) {
        setMessage(partsResult.error.message);
        return;
      }

      if (historyResult.error) {
        setMessage(historyResult.error.message);
        return;
      }

      const orders = ordersResult.data || [];
      const parts = partsResult.data || [];
      const history = historyResult.data || [];

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const activeOrders = orders.filter((order) => !order.received).length;

      const orderedNotReceived = orders.filter(
        (order) => order.part_ordered && !order.received
      ).length;

      const totalProfit = history.reduce((sum, item) => {
        return sum + Number(item.profit || 0);
      }, 0);

      const monthlyProfit = history.reduce((sum, item) => {
        if (!item.used_date) return sum;

        const usedDate = new Date(item.used_date);

        if (
          usedDate.getMonth() === currentMonth &&
          usedDate.getFullYear() === currentYear
        ) {
          return sum + Number(item.profit || 0);
        }

        return sum;
      }, 0);

      const alertList = [];

      orders.forEach((order) => {
        if (order.part_ordered && !order.received) {
          alertList.push(
            `Ordered part not received: ${
              order.part_number || "Unknown"
            } / RO ${order.repair_order_number || "-"}`
          );
        }
      });

      parts.forEach((part) => {
        alertList.push(
          `Part waiting to be used: ${part.part_number || "Unknown"} / RO ${
            part.repair_order_number || "-"
          }`
        );
      });

      setStats({
        activeOrders,
        orderedNotReceived,
        partsWaiting: parts.length,
        historyCount: history.length,
        totalProfit,
        monthlyProfit
      });

      setAlerts(alertList.slice(0, 10));
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20
        }}
      >
        <StatCard title="Active Orders" value={stats.activeOrders} />
        <StatCard title="Ordered Not Received" value={stats.orderedNotReceived} />
        <StatCard title="Parts Waiting" value={stats.partsWaiting} />
        <StatCard title="Used Parts History" value={stats.historyCount} />
        <StatCard title="Total Profit" value={`$${stats.totalProfit.toFixed(2)}`} />
        <StatCard
          title="Monthly Profit"
          value={`$${stats.monthlyProfit.toFixed(2)}`}
        />
      </div>

      <h3>Notifications</h3>

      {alerts.length === 0 ? (
        <p>No active alerts.</p>
      ) : (
        <ul>
          {alerts.map((alert, index) => (
            <li key={index}>{alert}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: 14,
        minWidth: 180
      }}
    >
      <strong>{title}</strong>
      <div style={{ fontSize: 24, marginTop: 8 }}>{value}</div>
    </div>
  );
}

export default DashboardHome;