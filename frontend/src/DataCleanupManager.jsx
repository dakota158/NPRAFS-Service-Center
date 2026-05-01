import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function DataCleanupManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [parts, setParts] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, vehiclesResult, invoicesResult, partsResult] =
      await Promise.all([
        supabase.from("customers").select("*").order("name", { ascending: true }),
        supabase.from("customer_vehicles").select("*"),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("parts").select("*").order("part_number", { ascending: true })
      ]);

    if (customersResult.error || vehiclesResult.error || invoicesResult.error || partsResult.error) {
      setMessage(customersResult.error?.message || vehiclesResult.error?.message || invoicesResult.error?.message || partsResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setVehicles(vehiclesResult.data || []);
    setInvoices(invoicesResult.data || []);
    setParts(partsResult.data || []);
  };

  const duplicateCustomers = useMemo(() => {
    const groups = {};
    customers.forEach((customer) => {
      const key = `${String(customer.name || "").trim().toLowerCase()}|${String(customer.phone || "").replace(/\D/g, "")}`;
      if (!key.startsWith("|")) {
        groups[key] = groups[key] || [];
        groups[key].push(customer);
      }
    });
    return Object.values(groups).filter((group) => group.length > 1);
  }, [customers]);

  const duplicateParts = useMemo(() => {
    const groups = {};
    parts.forEach((part) => {
      const key = String(part.part_number || "").trim().toLowerCase();
      if (key) {
        groups[key] = groups[key] || [];
        groups[key].push(part);
      }
    });
    return Object.values(groups).filter((group) => group.length > 1);
  }, [parts]);

  const unlinkedInvoices = useMemo(
    () => invoices.filter((invoice) => !invoice.customer_id && invoice.customer_name),
    [invoices]
  );

  const unlinkedVehicles = useMemo(
    () => vehicles.filter((vehicle) => !vehicle.customer_id),
    [vehicles]
  );

  const emptyCustomers = useMemo(
    () => customers.filter((customer) => !customer.name && !customer.phone && !customer.email),
    [customers]
  );

  const logCleanupReview = async () => {
    await supabase.from("audit_logs").insert({
      action: "Data Cleanup Reviewed",
      table_name: "multiple",
      record_id: "cleanup",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Reviewed cleanup: ${duplicateCustomers.length} duplicate customer groups, ${duplicateParts.length} duplicate part groups`
    });

    setMessage("Cleanup review logged.");
  };

  const linkInvoiceToMatchingCustomer = async (invoice) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can change linked records.");
      return;
    }

    const match = customers.find(
      (customer) =>
        invoice.customer_name &&
        customer.name &&
        customer.name.trim().toLowerCase() === invoice.customer_name.trim().toLowerCase()
    );

    if (!match) {
      setMessage("No matching customer found by name.");
      return;
    }

    const { error } = await supabase
      .from("invoices")
      .update({ customer_id: match.id, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`Linked invoice to ${match.name}.`);
    loadAll();
  };

  return (
    <div>
      <h2>Data Cleanup</h2>

      {message && <p style={{ color: message.includes("Linked") || message.includes("logged") ? "green" : "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>Refresh</button>{" "}
      <button type="button" onClick={logCleanupReview} style={{ marginBottom: 12 }}>Log Review</button>

      <div style={cardGrid}>
        <StatCard title="Duplicate Customer Groups" value={duplicateCustomers.length} />
        <StatCard title="Duplicate Part Groups" value={duplicateParts.length} />
        <StatCard title="Unlinked Invoices" value={unlinkedInvoices.length} />
        <StatCard title="Unlinked Vehicles" value={unlinkedVehicles.length} />
        <StatCard title="Empty Customers" value={emptyCustomers.length} />
      </div>

      <div style={panelStyle}>
        <h3>Duplicate Customers</h3>
        {duplicateCustomers.map((group, index) => (
          <div key={index} style={issueBoxStyle}>
            {group.map((customer) => (
              <div key={customer.id}>
                <strong>{customer.name || "Unnamed"}</strong> | {customer.phone || "-"} | {customer.email || "-"}
              </div>
            ))}
          </div>
        ))}
        {duplicateCustomers.length === 0 && <p>No duplicate customer groups found.</p>}
      </div>

      <div style={panelStyle}>
        <h3>Duplicate Parts</h3>
        {duplicateParts.map((group, index) => (
          <div key={index} style={issueBoxStyle}>
            {group.map((part) => (
              <div key={part.id}>
                <strong>{part.part_number}</strong> | {part.name || "-"} | Qty {part.quantity || 0}
              </div>
            ))}
          </div>
        ))}
        {duplicateParts.length === 0 && <p>No duplicate part groups found.</p>}
      </div>

      <div style={panelStyle}>
        <h3>Unlinked Invoices With Customer Names</h3>
        <table border="1" cellPadding="8" style={tableStyle}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {unlinkedInvoices.slice(0, 100).map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number || invoice.repair_order_number || invoice.estimate_number || "-"}</td>
                <td>{invoice.customer_name || "-"}</td>
                <td>{invoice.customer_phone || "-"}</td>
                <td>${Number(invoice.grand_total || 0).toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => linkInvoiceToMatchingCustomer(invoice)}>
                    Link By Matching Name
                  </button>
                </td>
              </tr>
            ))}
            {unlinkedInvoices.length === 0 && <tr><td colSpan="5" style={{ textAlign: "center" }}>No unlinked invoices.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const issueBoxStyle = { background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 10, marginBottom: 8 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default DataCleanupManager;
