import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function NotificationCenterManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settingsItems, setSettingsItems] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, partsResult, ordersResult, settingsResult] =
      await Promise.all([
        supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
        supabase.from("parts").select("*").order("quantity", { ascending: true }),
        supabase.from("orders").select("*").eq("received", false),
        supabase
          .from("app_settings")
          .select("*")
          .in("setting_key", ["follow_ups_json", "appointments_json"])
      ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setParts(partsResult.data || []);
    setOrders(ordersResult.data || []);

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

  const notifications = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const list = [];

    jobs.forEach((job) => {
      if (job.status === "Ready") {
        list.push({
          type: "Job Ready",
          severity: "High",
          message: `${job.customer_name || "Customer"} vehicle is ready`,
          detail: job.repair_order_number || job.invoice_number || ""
        });
      }

      const balance =
        Number(job.balance_due || 0) ||
        Math.max(0, Number(job.grand_total || 0) - Number(job.amount_paid || 0));

      if ((job.document_status === "Invoice" || !job.document_status) && balance > 0) {
        list.push({
          type: "Balance Due",
          severity: "Medium",
          message: `${job.customer_name || "Customer"} owes $${balance.toFixed(2)}`,
          detail: job.invoice_number || job.repair_order_number || ""
        });
      }
    });

    parts
      .filter((part) => Number(part.quantity || 0) <= 1)
      .forEach((part) => {
        list.push({
          type: "Low Stock",
          severity: Number(part.quantity || 0) <= 0 ? "High" : "Medium",
          message: `${part.part_number || part.name || "Part"} low stock`,
          detail: `Qty: ${part.quantity}`
        });
      });

    orders.forEach((order) => {
      if (!order.part_ordered) {
        list.push({
          type: "Order Pending",
          severity: "Medium",
          message: `${order.part_number} needs to be ordered`,
          detail: order.repair_order_number || ""
        });
      }
    });

    (settingsItems.follow_ups_json || []).forEach((follow) => {
      if (!follow.completed && follow.due_date && follow.due_date <= today) {
        list.push({
          type: "Follow Up Due",
          severity: follow.due_date < today ? "High" : "Medium",
          message: follow.note || "Follow up due",
          detail: `${follow.customer_name || ""} ${follow.due_date}`
        });
      }
    });

    (settingsItems.appointments_json || []).forEach((appointment) => {
      if (appointment.appointment_date === today) {
        list.push({
          type: "Appointment Today",
          severity: "Low",
          message: `${appointment.customer_name || "Customer"} appointment today`,
          detail: `${appointment.appointment_time || ""} ${appointment.reason || ""}`
        });
      }
    });

    return list;
  }, [jobs, parts, orders, settingsItems]);

  return (
    <div>
      <h2>Notification Center</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh Notifications
      </button>

      <div style={cardGrid}>
        <StatCard
          title="High"
          value={notifications.filter((n) => n.severity === "High").length}
        />
        <StatCard
          title="Medium"
          value={notifications.filter((n) => n.severity === "Medium").length}
        />
        <StatCard
          title="Low"
          value={notifications.filter((n) => n.severity === "Low").length}
        />
        <StatCard title="Total" value={notifications.length} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Message</th>
            <th>Detail</th>
          </tr>
        </thead>

        <tbody>
          {notifications.map((notification, index) => (
            <tr key={`${notification.type}-${index}`}>
              <td>
                <strong
                  style={{
                    color:
                      notification.severity === "High"
                        ? "red"
                        : notification.severity === "Medium"
                        ? "#b45309"
                        : "#2563eb"
                  }}
                >
                  {notification.severity}
                </strong>
              </td>
              <td>{notification.type}</td>
              <td>{notification.message}</td>
              <td>{notification.detail}</td>
            </tr>
          ))}

          {notifications.length === 0 && (
            <tr>
              <td colSpan="4" style={{ textAlign: "center" }}>
                No notifications right now.
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
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginBottom: 18
};

const statCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default NotificationCenterManager;
