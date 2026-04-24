import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function SuppliersManager({ user, canEditEverything }) {
  const role = user?.role || "Tech";

  const canManageSuppliers =
    role === "Manager" || role === "IT" || role === "admin" || role === "Admin";

  const canViewCredentials = canManageSuppliers;

  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");

  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showCredentialsPopup, setShowCredentialsPopup] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    contact_name: "",
    phone: "",
    website: "",
    discount_rate: "",
    signup_date: ""
  });

  const [credentialsForm, setCredentialsForm] = useState({
    login_username: "",
    login_password: ""
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuppliers(data || []);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateCredentialsForm = (field, value) => {
    setCredentialsForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      address: "",
      contact_name: "",
      phone: "",
      website: "",
      discount_rate: "",
      signup_date: ""
    });
  };

  const resetCredentialsForm = () => {
    setCredentialsForm({
      login_username: "",
      login_password: ""
    });
  };

  const logAudit = async (action, details, recordId = "") => {
    await supabase.from("audit_logs").insert({
      action,
      table_name: "suppliers",
      record_id: recordId,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details
    });
  };

  const openAddPopup = () => {
    setMessage("");
    resetForm();
    setShowAddPopup(true);
  };

  const closeAddPopup = () => {
    setShowAddPopup(false);
    resetForm();
  };

  const addSupplier = async () => {
    setMessage("");

    if (!canManageSuppliers) {
      setMessage("Only Manager, IT, and Admin accounts can add suppliers.");
      return;
    }

    if (
      !form.name ||
      !form.address ||
      !form.contact_name ||
      !form.phone ||
      !form.discount_rate ||
      !form.signup_date
    ) {
      setMessage(
        "Supplier name, address, main contact name and number, discount, and signup date are required."
      );
      return;
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: form.name,
        address: form.address,
        contact_name: form.contact_name,
        phone: form.phone,
        website: form.website,
        discount_rate: form.discount_rate,
        signup_date: form.signup_date,
        login_username: "",
        login_password: ""
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    await logAudit(
      "Supplier Created",
      `Created supplier ${form.name}`,
      data.id
    );

    closeAddPopup();
    loadSuppliers();

    if (form.website.trim()) {
      setNewSupplierId(data.id);
      resetCredentialsForm();
      setShowCredentialsPopup(true);
    }
  };

  const saveCredentials = async () => {
    setMessage("");

    if (!canManageSuppliers) {
      setMessage("Only Manager, IT, and Admin accounts can save supplier credentials.");
      return;
    }

    if (!newSupplierId) {
      setMessage("Supplier ID missing.");
      return;
    }

    const { error } = await supabase
      .from("suppliers")
      .update({
        login_username: credentialsForm.login_username,
        login_password: credentialsForm.login_password
      })
      .eq("id", newSupplierId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await logAudit(
      "Supplier Credentials Saved",
      "Saved supplier website login credentials",
      newSupplierId
    );

    setShowCredentialsPopup(false);
    setNewSupplierId(null);
    resetCredentialsForm();
    loadSuppliers();
  };

  const skipCredentials = () => {
    setShowCredentialsPopup(false);
    setNewSupplierId(null);
    resetCredentialsForm();
  };

  const deleteSupplier = async (supplier) => {
    if (!canManageSuppliers) {
      setMessage("Only Manager, IT, and Admin accounts can delete suppliers.");
      return;
    }

    const confirmed = window.confirm(`Delete supplier ${supplier.name}?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplier.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await logAudit(
      "Supplier Deleted",
      `Deleted supplier ${supplier.name}`,
      supplier.id
    );

    loadSuppliers();
  };

  return (
    <div>
      <h2>Suppliers / Vendors</h2>

      {!canManageSuppliers && (
        <p style={{ color: "red" }}>
          Only Manager, IT, and Admin accounts can manage suppliers.
        </p>
      )}

      {canManageSuppliers && (
        <button type="button" onClick={openAddPopup}>
          Add Supplier
        </button>
      )}

      {message && <p style={{ color: "red" }}>{message}</p>}

      <hr />

      <table
        border="1"
        cellPadding="8"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th>Supplier Name</th>
            <th>Address</th>
            <th>Main Contact</th>
            <th>Contact Number</th>
            <th>Parts Website</th>
            <th>Discount</th>
            <th>Signup Date</th>
            {canViewCredentials && <th>Website Login</th>}
            {canManageSuppliers && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name || "-"}</td>
              <td>{supplier.address || "-"}</td>
              <td>{supplier.contact_name || "-"}</td>
              <td>{supplier.phone || "-"}</td>
              <td>
                {supplier.website ? (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Website
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td>{supplier.discount_rate || "-"}</td>
              <td>{supplier.signup_date || "-"}</td>

              {canViewCredentials && (
                <td>
                  {supplier.website ? (
                    <div>
                      <div>
                        <strong>Username:</strong>{" "}
                        {supplier.login_username || "-"}
                      </div>
                      <div>
                        <strong>Password:</strong>{" "}
                        {supplier.login_password || "-"}
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              )}

              {canManageSuppliers && (
                <td>
                  <button
                    type="button"
                    onClick={() => deleteSupplier(supplier)}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}

          {suppliers.length === 0 && (
            <tr>
              <td
                colSpan={
                  canViewCredentials && canManageSuppliers
                    ? 9
                    : canViewCredentials || canManageSuppliers
                    ? 8
                    : 7
                }
                style={{ textAlign: "center" }}
              >
                No suppliers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddPopup && (
        <div style={popupStyle}>
          <div style={boxStyle}>
            <h3>Add Supplier</h3>

            <input
              placeholder="Supplier Name"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Address"
              value={form.address}
              onChange={(e) => updateForm("address", e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Main Contact Name"
              value={form.contact_name}
              onChange={(e) => updateForm("contact_name", e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Main Contact Number"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Website for Parts Ordering"
              value={form.website}
              onChange={(e) => updateForm("website", e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Our Discount"
              value={form.discount_rate}
              onChange={(e) => updateForm("discount_rate", e.target.value)}
              style={inputStyle}
            />

            <label>
              Signup Date
              <input
                type="date"
                value={form.signup_date}
                onChange={(e) => updateForm("signup_date", e.target.value)}
                style={inputStyle}
              />
            </label>

            <button type="button" onClick={addSupplier}>
              Save Supplier
            </button>

            <button
              type="button"
              onClick={closeAddPopup}
              style={{ marginLeft: 8 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCredentialsPopup && (
        <div style={popupStyle}>
          <div style={boxStyle}>
            <h3>Supplier Website Login</h3>

            <p>
              This supplier has a parts-ordering website. Enter the main login
              credentials.
            </p>

            <input
              placeholder="Website Username / Email"
              value={credentialsForm.login_username}
              onChange={(e) =>
                updateCredentialsForm("login_username", e.target.value)
              }
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Website Password"
              value={credentialsForm.login_password}
              onChange={(e) =>
                updateCredentialsForm("login_password", e.target.value)
              }
              style={inputStyle}
            />

            <button type="button" onClick={saveCredentials}>
              Save Credentials
            </button>

            <button
              type="button"
              onClick={skipCredentials}
              style={{ marginLeft: 8 }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const popupStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const boxStyle = {
  background: "white",
  padding: 20,
  width: 480,
  maxHeight: "90vh",
  overflowY: "auto",
  borderRadius: 12
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: 10,
  marginBottom: 8,
  boxSizing: "border-box"
};

export default SuppliersManager;