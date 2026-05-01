import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CustomersManager({ user, canEditEverything }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [customerResult, vehicleResult, invoiceResult] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("customer_vehicles").select("*"),
      supabase.from("invoices").select("*").order("created_at", { ascending: false })
    ]);

    if (customerResult.error) {
      setMessage(customerResult.error.message);
      return;
    }

    setCustomers(customerResult.data || []);
    setVehicles(vehicleResult.data || []);
    setInvoices(invoiceResult.data || []);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const addCustomer = async () => {
    setMessage("");

    if (!form.name) {
      setMessage("Customer name is required.");
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        notes: form.notes,
        created_by: user?.id || null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Customer Created",
      table_name: "customers",
      record_id: data.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created customer ${form.name}`
    });

    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: ""
    });

    setMessage("Customer saved.");
    loadAll();
  };

  const updateCustomer = async (customer, field, value) => {
    const { error } = await supabase
      .from("customers")
      .update({
        [field]: value,
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    loadAll();
  };

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.notes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [customers, search]);

  const getCustomerVehicles = (customerId) =>
    vehicles.filter((vehicle) => vehicle.customer_id === customerId);

  const getCustomerInvoices = (customer) =>
    invoices.filter(
      (invoice) =>
        invoice.customer_id === customer.id ||
        (customer.name &&
          invoice.customer_name &&
          customer.name.toLowerCase() === invoice.customer_name.toLowerCase())
    );

  const getCustomerTotal = (customer) =>
    getCustomerInvoices(customer).reduce(
      (sum, invoice) => sum + Number(invoice.grand_total || 0),
      0
    );

  return (
    <div>
      <h2>Customers</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Add Customer</h3>

        <div style={gridStyle}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Email
            <input
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Address
            <input
              value={form.address}
              onChange={(e) => updateForm("address", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={addCustomer}>
          Add Customer
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customers..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Contact</th>
            <th>Vehicles</th>
            <th>Invoice Count</th>
            <th>Total Spent</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {filteredCustomers.map((customer) => {
            const customerVehicles = getCustomerVehicles(customer.id);
            const customerInvoices = getCustomerInvoices(customer);

            return (
              <tr key={customer.id}>
                <td>
                  <input
                    value={customer.name || ""}
                    onChange={(e) =>
                      updateCustomer(customer, "name", e.target.value)
                    }
                    disabled={!canEditEverything}
                    style={inputStyle}
                  />
                </td>
                <td>
                  <input
                    value={customer.phone || ""}
                    onChange={(e) =>
                      updateCustomer(customer, "phone", e.target.value)
                    }
                    disabled={!canEditEverything}
                    placeholder="Phone"
                    style={inputStyle}
                  />
                  <input
                    value={customer.email || ""}
                    onChange={(e) =>
                      updateCustomer(customer, "email", e.target.value)
                    }
                    disabled={!canEditEverything}
                    placeholder="Email"
                    style={inputStyle}
                  />
                </td>
                <td>
                  {customerVehicles.length > 0
                    ? customerVehicles.map((vehicle) => (
                        <div key={vehicle.id}>
                          {[vehicle.year, vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ") || "Vehicle"}
                          {vehicle.vin ? ` - ${vehicle.vin}` : ""}
                        </div>
                      ))
                    : "-"}
                </td>
                <td>{customerInvoices.length}</td>
                <td>${getCustomerTotal(customer).toFixed(2)}</td>
                <td>
                  <textarea
                    value={customer.notes || ""}
                    onChange={(e) =>
                      updateCustomer(customer, "notes", e.target.value)
                    }
                    disabled={!canEditEverything}
                    style={{ ...textareaStyle, minHeight: 60 }}
                  />
                </td>
              </tr>
            );
          })}

          {filteredCustomers.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No customers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 80,
  marginBottom: 12
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default CustomersManager;
