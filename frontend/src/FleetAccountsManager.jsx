import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function FleetAccountsManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    account_name: "",
    contact_name: "",
    phone: "",
    email: "",
    billing_terms: "Due on receipt",
    po_required: false,
    discount_percent: "0",
    notes: "",
    customer_ids: []
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customersResult, vehiclesResult, invoicesResult, settingsResult] =
      await Promise.all([
        supabase.from("customers").select("*").order("name", { ascending: true }),
        supabase.from("customer_vehicles").select("*"),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("app_settings").select("*").eq("setting_key", "fleet_accounts_json").maybeSingle()
      ]);

    if (customersResult.error || vehiclesResult.error || invoicesResult.error) {
      setMessage(customersResult.error?.message || vehiclesResult.error?.message || invoicesResult.error?.message);
      return;
    }

    setCustomers(customersResult.data || []);
    setVehicles(vehiclesResult.data || []);
    setInvoices(invoicesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setFleets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFleets([]);
    }
  };

  const saveFleets = async (nextFleets) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "fleet_accounts_json",
        setting_value: JSON.stringify(nextFleets, null, 2),
        description: "Fleet/commercial account records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setFleets(nextFleets);
    return true;
  };

  const toggleCustomer = (customerId) => {
    setForm((prev) => {
      const ids = prev.customer_ids.includes(customerId)
        ? prev.customer_ids.filter((id) => id !== customerId)
        : [...prev.customer_ids, customerId];

      return { ...prev, customer_ids: ids };
    });
  };

  const createFleet = async () => {
    setMessage("");

    if (!form.account_name) {
      setMessage("Fleet account name is required.");
      return;
    }

    const fleet = {
      id: `fleet_${Date.now()}`,
      ...form,
      discount_percent: Number(form.discount_percent || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveFleets([fleet, ...fleets]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Fleet Account Created",
      table_name: "app_settings",
      record_id: fleet.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created fleet account ${fleet.account_name}`
    });

    setMessage("Fleet account saved.");
    setForm({
      account_name: "",
      contact_name: "",
      phone: "",
      email: "",
      billing_terms: "Due on receipt",
      po_required: false,
      discount_percent: "0",
      notes: "",
      customer_ids: []
    });
  };

  const getFleetStats = (fleet) => {
    const customerIds = fleet.customer_ids || [];
    const fleetVehicles = vehicles.filter((vehicle) => customerIds.includes(vehicle.customer_id));
    const fleetInvoices = invoices.filter((invoice) => customerIds.includes(invoice.customer_id));
    const total = fleetInvoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
    const balance = fleetInvoices.reduce(
      (sum, invoice) =>
        sum + Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)),
      0
    );

    return { vehicles: fleetVehicles.length, invoices: fleetInvoices.length, total, balance };
  };

  const fleetTotal = useMemo(
    () => fleets.reduce((sum, fleet) => sum + getFleetStats(fleet).total, 0),
    [fleets, invoices]
  );

  return (
    <div>
      <h2>Fleet / Commercial Accounts</h2>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Fleet Accounts" value={fleets.length} />
        <StatCard title="Fleet Revenue" value={`$${fleetTotal.toFixed(2)}`} />
        <StatCard title="Customers Linked" value={fleets.reduce((sum, fleet) => sum + (fleet.customer_ids?.length || 0), 0)} />
      </div>

      <div style={panelStyle}>
        <h3>Create Fleet Account</h3>

        <div style={gridStyle}>
          <label>
            Account Name
            <input value={form.account_name} onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Contact Name
            <input value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Email
            <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Billing Terms
            <input value={form.billing_terms} onChange={(e) => setForm((p) => ({ ...p, billing_terms: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Discount %
            <input type="number" value={form.discount_percent} onChange={(e) => setForm((p) => ({ ...p, discount_percent: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={form.po_required} onChange={(e) => setForm((p) => ({ ...p, po_required: e.target.checked }))} /> PO required
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <h4>Link Customers</h4>
        <div style={customerListStyle}>
          {customers.map((customer) => (
            <label key={customer.id} style={customerPillStyle}>
              <input type="checkbox" checked={form.customer_ids.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} /> {customer.name}
            </label>
          ))}
        </div>

        <button type="button" onClick={createFleet}>Save Fleet Account</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Account</th>
            <th>Contact</th>
            <th>Terms</th>
            <th>Customers</th>
            <th>Vehicles</th>
            <th>Invoices</th>
            <th>Total</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {fleets.map((fleet) => {
            const stats = getFleetStats(fleet);
            return (
              <tr key={fleet.id}>
                <td><strong>{fleet.account_name}</strong><br /><small>{fleet.notes}</small></td>
                <td>{fleet.contact_name || "-"}<br /><small>{fleet.phone || fleet.email || ""}</small></td>
                <td>{fleet.billing_terms}<br /><small>{fleet.po_required ? "PO Required" : "No PO required"} | {fleet.discount_percent}% discount</small></td>
                <td>{fleet.customer_ids?.length || 0}</td>
                <td>{stats.vehicles}</td>
                <td>{stats.invoices}</td>
                <td>${stats.total.toFixed(2)}</td>
                <td>${stats.balance.toFixed(2)}</td>
              </tr>
            );
          })}
          {fleets.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No fleet accounts.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const customerListStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 12 };
const customerPillStyle = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f8fafc" };

export default FleetAccountsManager;
