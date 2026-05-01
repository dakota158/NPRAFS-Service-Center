import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function ExportManager({ user }) {
  const [message, setMessage] = useState("");
  const [counts, setCounts] = useState({
    invoices: 0,
    payments: 0,
    customers: 0,
    vehicles: 0,
    parts: 0,
    orders: 0
  });

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const [invoices, payments, customers, vehicles, parts, orders] =
      await Promise.all([
        supabase.from("invoices").select("id"),
        supabase.from("invoice_payments").select("id"),
        supabase.from("customers").select("id"),
        supabase.from("customer_vehicles").select("id"),
        supabase.from("parts").select("id"),
        supabase.from("orders").select("id")
      ]);

    setCounts({
      invoices: invoices.data?.length || 0,
      payments: payments.data?.length || 0,
      customers: customers.data?.length || 0,
      vehicles: vehicles.data?.length || 0,
      parts: parts.data?.length || 0,
      orders: orders.data?.length || 0
    });
  };

  const downloadCsv = (filename, rows) => {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportInvoices = async () => {
    setMessage("");

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = [
      [
        "Number",
        "Type",
        "Status",
        "Payment Status",
        "Customer",
        "Phone",
        "Email",
        "Vehicle",
        "VIN",
        "Date",
        "Labor",
        "Parts",
        "Shop Fee",
        "Tax",
        "Total",
        "Paid",
        "Balance"
      ],
      ...(data || []).map((invoice) => [
        invoice.invoice_number || invoice.repair_order_number || invoice.estimate_number || "",
        invoice.document_status || "Invoice",
        invoice.status || "",
        invoice.payment_status || "",
        invoice.customer_name || "",
        invoice.customer_phone || "",
        invoice.customer_email || "",
        [invoice.vehicle_year, invoice.vehicle_make, invoice.vehicle_model]
          .filter(Boolean)
          .join(" "),
        invoice.vehicle_vin || "",
        invoice.invoice_date || "",
        invoice.labor_subtotal || 0,
        invoice.parts_subtotal || 0,
        invoice.shop_fee || 0,
        invoice.tax_total || 0,
        invoice.grand_total || 0,
        invoice.amount_paid || 0,
        invoice.balance_due ||
          Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0)
      ])
    ];

    downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    setMessage("Invoice CSV exported.");
  };

  const exportCustomers = async () => {
    setMessage("");

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = [
      ["Name", "Phone", "Email", "Address", "Notes", "Created"],
      ...(data || []).map((customer) => [
        customer.name || "",
        customer.phone || "",
        customer.email || "",
        customer.address || "",
        customer.notes || "",
        customer.created_at || ""
      ])
    ];

    downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    setMessage("Customer CSV exported.");
  };

  const exportInventory = async () => {
    setMessage("");

    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .order("part_number", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = [
      ["Part #", "Description", "Quantity", "RO #", "Date Received", "Created"],
      ...(data || []).map((part) => [
        part.part_number || "",
        part.name || "",
        part.quantity || 0,
        part.repair_order_number || "",
        part.date_received || "",
        part.created_at || ""
      ])
    ];

    downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    setMessage("Inventory CSV exported.");
  };

  const exportQuickBooksFriendly = async () => {
    setMessage("");

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = [
      [
        "Customer",
        "Invoice No",
        "Invoice Date",
        "Due Date",
        "Item",
        "Description",
        "Qty",
        "Rate",
        "Amount",
        "Tax Amount"
      ]
    ];

    (data || []).forEach((invoice) => {
      rows.push([
        invoice.customer_name || "",
        invoice.invoice_number || invoice.repair_order_number || "",
        invoice.invoice_date || "",
        invoice.due_date || "",
        "Labor",
        "Labor subtotal",
        1,
        invoice.labor_subtotal || 0,
        invoice.labor_subtotal || 0,
        ""
      ]);

      rows.push([
        invoice.customer_name || "",
        invoice.invoice_number || invoice.repair_order_number || "",
        invoice.invoice_date || "",
        invoice.due_date || "",
        "Parts",
        "Parts subtotal",
        1,
        invoice.parts_subtotal || 0,
        invoice.parts_subtotal || 0,
        ""
      ]);

      if (Number(invoice.shop_fee || 0) > 0) {
        rows.push([
          invoice.customer_name || "",
          invoice.invoice_number || invoice.repair_order_number || "",
          invoice.invoice_date || "",
          invoice.due_date || "",
          "Shop Supplies",
          "Shop supplies",
          1,
          invoice.shop_fee || 0,
          invoice.shop_fee || 0,
          ""
        ]);
      }

      if (Number(invoice.tax_total || 0) > 0) {
        rows.push([
          invoice.customer_name || "",
          invoice.invoice_number || invoice.repair_order_number || "",
          invoice.invoice_date || "",
          invoice.due_date || "",
          "Sales Tax",
          "Sales Tax",
          1,
          invoice.tax_total || 0,
          invoice.tax_total || 0,
          invoice.tax_total || 0
        ]);
      }
    });

    downloadCsv(
      `quickbooks-friendly-${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    );
    setMessage("QuickBooks-friendly CSV exported.");
  };

  return (
    <div>
      <h2>Exports / Integrations</h2>

      {message && (
        <p style={{ color: message.includes("exported") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Invoices" value={counts.invoices} />
        <StatCard title="Payments" value={counts.payments} />
        <StatCard title="Customers" value={counts.customers} />
        <StatCard title="Vehicles" value={counts.vehicles} />
        <StatCard title="Parts" value={counts.parts} />
        <StatCard title="Orders" value={counts.orders} />
      </div>

      <div style={panelStyle}>
        <h3>CSV Exports</h3>

        <button type="button" onClick={exportInvoices}>
          Export Invoices CSV
        </button>{" "}
        <button type="button" onClick={exportCustomers}>
          Export Customers CSV
        </button>{" "}
        <button type="button" onClick={exportInventory}>
          Export Inventory CSV
        </button>{" "}
        <button type="button" onClick={exportQuickBooksFriendly}>
          Export QuickBooks-Friendly CSV
        </button>
      </div>

      <div style={panelStyle}>
        <h3>Integration Notes</h3>
        <p>
          This adds clean CSV export files that can be imported into accounting
          software or used for backup/reporting. Direct QuickBooks/Stripe API
          integration can be added later when API keys and account setup are ready.
        </p>
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

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

export default ExportManager;
