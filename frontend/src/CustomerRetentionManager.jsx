import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CustomerRetentionManager() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [inactiveDays, setInactiveDays] = useState("180");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, invoicesResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("invoice_date", { ascending: false })
    ]);

    if (customersResult.error || invoicesResult.error) {
      setMessage(customersResult.error?.message || invoicesResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setInvoices(invoicesResult.data || []);
  };

  const rows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(inactiveDays || 180));

    return customers.map((customer) => {
      const customerInvoices = invoices.filter(
        (invoice) =>
          invoice.customer_id === customer.id ||
          (invoice.customer_name && customer.name && invoice.customer_name.toLowerCase() === customer.name.toLowerCase())
      );

      const sorted = [...customerInvoices].sort((a, b) => String(b.invoice_date || b.created_at).localeCompare(String(a.invoice_date || a.created_at)));
      const lastInvoice = sorted[0];
      const lastDate = lastInvoice?.invoice_date || lastInvoice?.created_at || "";
      const lastDateObj = lastDate ? new Date(lastDate) : null;
      const inactive = !lastDateObj || lastDateObj < cutoff;
      const revenue = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);

      return {
        customer,
        visits: customerInvoices.length,
        revenue,
        lastDate,
        inactive,
        averageTicket: customerInvoices.length ? revenue / customerInvoices.length : 0
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [customers, invoices, inactiveDays]);

  const inactiveRows = rows.filter((row) => row.inactive);
  const repeatRows = rows.filter((row) => row.visits > 1);

  const copyWinback = async (row) => {
    const text = `Hello ${row.customer.name || ""},

We wanted to check in and see if your vehicle is due for any maintenance or repairs. It has been a while since your last visit, and we would be happy to help you schedule service.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Win-back message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  const exportCsv = () => {
    const csvRows = [
      ["Customer", "Phone", "Email", "Visits", "Revenue", "Average Ticket", "Last Visit", "Inactive"],
      ...rows.map((row) => [
        row.customer.name || "",
        row.customer.phone || "",
        row.customer.email || "",
        row.visits,
        row.revenue.toFixed(2),
        row.averageTicket.toFixed(2),
        row.lastDate || "",
        row.inactive ? "Yes" : "No"
      ])
    ];

    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `customer-retention-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Customer Retention</h2>

      {message && <p style={{ color: message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Customers" value={customers.length} />
        <StatCard title="Repeat Customers" value={repeatRows.length} />
        <StatCard title="Inactive" value={inactiveRows.length} />
        <StatCard title="Revenue" value={`$${rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)}`} />
      </div>

      <div style={panelStyle}>
        <label>
          Inactive After Days
          <input type="number" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>{" "}
        <button type="button" onClick={exportCsv}>Export CSV</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Contact</th>
            <th>Visits</th>
            <th>Revenue</th>
            <th>Average Ticket</th>
            <th>Last Visit</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.customer.id}>
              <td>{row.customer.name || "-"}</td>
              <td>{row.customer.phone || "-"}<br /><small>{row.customer.email || ""}</small></td>
              <td>{row.visits}</td>
              <td>${row.revenue.toFixed(2)}</td>
              <td>${row.averageTicket.toFixed(2)}</td>
              <td>{row.lastDate ? new Date(row.lastDate).toLocaleDateString() : "-"}</td>
              <td style={{ color: row.inactive ? "red" : "green" }}>{row.inactive ? "Inactive" : "Active"}</td>
              <td>{row.inactive && <button type="button" onClick={() => copyWinback(row)}>Copy Win-Back</button>}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No customers found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 220, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CustomerRetentionManager;
