import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function normalizeRole(role) {
  if (role === "admin" || role === "Admin") return "admin";
  if (role === "IT" || role === "I.T.") return "IT";
  if (role === "Manager") return "Manager";
  return "Tech";
}

function UserManagement({ user }) {
  const role = normalizeRole(user?.role || "Tech");

  const isAdmin = role === "admin";
  const isIT = role === "IT";
  const isManager = role === "Manager";

  const canCreateUsers = isAdmin || isIT || isManager;
  const canEditRoles = isAdmin || isIT;

  const [profiles, setProfiles] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    password: "",
    userType: "Tech"
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    role: "Tech"
  });

  const getAllowedRoles = () => {
    if (isAdmin) return ["Tech", "Manager", "IT", "admin"];
    if (isIT) return ["Tech", "Manager", "IT"];
    if (isManager) return ["Tech"];
    return [];
  };

  const allowedRoles = getAllowedRoles();

  const canDeleteProfile = (profile) => {
    const targetRole = normalizeRole(profile?.role);

    if (!profile?.id) return false;
    if (profile.id === user?.id) return false;

    if (isAdmin) return true;

    if (isIT) {
      return targetRole === "IT" || targetRole === "Manager" || targetRole === "Tech";
    }

    if (isManager) {
      return targetRole === "Tech";
    }

    return false;
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      setProfiles(data || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => {
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const updateEditForm = (field, value) => {
    setEditForm((prev) => {
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const createUser = async () => {
    setMessage("");

    if (!canCreateUsers) {
      setMessage("You are not allowed to create users");
      return;
    }

    if (
      !form.name ||
      !form.email ||
      !form.phone ||
      !form.position ||
      !form.password
    ) {
      setMessage("Name, email, phone, position, and password are required");
      return;
    }

    if (!allowedRoles.includes(form.userType)) {
      setMessage("You are not allowed to create that user type");
      return;
    }

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        name: form.name,
        email: form.email,
        phone: form.phone,
        position: form.position,
        password: form.password,
        role: form.userType
      }
    });

    if (error || data?.error) {
      setMessage(data?.error || error?.message || "Could not create user");
      return;
    }

    setForm({
      name: "",
      email: "",
      phone: "",
      position: "",
      password: "",
      userType: "Tech"
    });

    setMessage(`${form.userType} user created`);
    loadProfiles();
  };

  const deleteUser = async (profile) => {
    setMessage("");

    if (!canDeleteProfile(profile)) {
      setMessage("You are not allowed to delete that user type.");
      return;
    }

    if (profile.id === user?.id) {
      setMessage("You cannot delete your own account while logged in.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${profile.name || profile.email}?`
    );

    if (!confirmed) return;

    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: {
        userId: profile.id,
        requesterId: user.id
      }
    });

    if (error || data?.error) {
      setMessage(data?.error || error?.message || "Could not delete user");
      return;
    }

    setMessage("User deleted");
    loadProfiles();
  };

  const startEdit = (profile) => {
    if (!canEditRoles) return;

    setEditingId(profile.id);
    setEditForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      position: profile.position || "",
      role: normalizeRole(profile.role || "Tech")
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: "",
      email: "",
      phone: "",
      position: "",
      role: "Tech"
    });
  };

  const saveEdit = async (profile) => {
    setMessage("");

    const currentProfileRole = normalizeRole(profile.role);
    const newRole = normalizeRole(editForm.role);

    if (!canEditRoles) {
      setMessage("You are not allowed to edit users");
      return;
    }

    if (currentProfileRole === "admin" && !isAdmin) {
      setMessage("Only admin accounts can remove or change admin roles");
      return;
    }

    if (newRole === "admin" && !isAdmin) {
      setMessage("Only admin accounts can add admin roles");
      return;
    }

    if (!allowedRoles.includes(newRole)) {
      setMessage("You are not allowed to assign that role");
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          position: editForm.position,
          role: newRole
        })
        .eq("id", profile.id);

      if (error) {
        setMessage(error.message);
        return;
      }

      cancelEdit();
      loadProfiles();
      setMessage("User updated");
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const filteredProfiles = profiles.filter((profile) => {
    const text = search.toLowerCase();

    return [
      profile.name,
      profile.email,
      profile.phone,
      profile.position,
      profile.role
    ]
      .join(" ")
      .toLowerCase()
      .includes(text);
  });

  return (
    <div>
      <h2>User Management</h2>

      {isAdmin && (
        <p>Admin can create, edit, and delete Tech, Manager, I.T., and Admin users.</p>
      )}

      {isIT && (
        <p>I.T. can create and delete Tech, Manager, and I.T. users. I.T. cannot add, edit, or delete Admin users.</p>
      )}

      {isManager && (
        <p>Managers can create and delete Tech users only.</p>
      )}

      {canCreateUsers && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: 12,
            maxWidth: 650,
            marginBottom: 20,
            position: "relative",
            zIndex: 5,
            background: "rgba(255, 255, 255, 0.95)"
          }}
        >
          <h3>Create User</h3>

          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => updateForm("name", e.target.value)}
            style={inputStyle}
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => updateForm("email", e.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => updateForm("phone", e.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Position"
            value={form.position}
            onChange={(e) => updateForm("position", e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Temporary Password"
            value={form.password}
            onChange={(e) => updateForm("password", e.target.value)}
            style={inputStyle}
          />

          <select
            value={form.userType}
            onChange={(e) => updateForm("userType", e.target.value)}
            style={inputStyle}
          >
            {allowedRoles.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleOption === "IT" ? "I.T." : roleOption}
              </option>
            ))}
          </select>

          <button type="button" onClick={createUser}>
            Create User
          </button>
        </div>
      )}

      {message && <p style={{ color: "red" }}>{message}</p>}

      <h3>Users</h3>

      <input
        type="text"
        placeholder="Search users"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, maxWidth: 500 }}
      />

      <table
        border="1"
        cellPadding="8"
        style={{
          borderCollapse: "collapse",
          width: "100%",
          background: "rgba(255, 255, 255, 0.95)"
        }}
      >
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>User Type</th>
            <th>Phone</th>
            <th>Position</th>
            {(canEditRoles || canCreateUsers) && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {filteredProfiles.map((profile) => (
            <tr key={profile.id}>
              {editingId === profile.id ? (
                <>
                  <td>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => updateEditForm("name", e.target.value)}
                      style={smallInputStyle}
                    />
                  </td>

                  <td>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => updateEditForm("email", e.target.value)}
                      style={smallInputStyle}
                    />
                  </td>

                  <td>
                    <select
                      value={editForm.role}
                      onChange={(e) => updateEditForm("role", e.target.value)}
                      style={smallInputStyle}
                    >
                      {allowedRoles.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption === "IT" ? "I.T." : roleOption}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => updateEditForm("phone", e.target.value)}
                      style={smallInputStyle}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={editForm.position}
                      onChange={(e) =>
                        updateEditForm("position", e.target.value)
                      }
                      style={smallInputStyle}
                    />
                  </td>

                  <td>
                    <button type="button" onClick={() => saveEdit(profile)}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{ marginLeft: 6 }}
                    >
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{profile.name || "-"}</td>
                  <td>{profile.email || "-"}</td>
                  <td>{profile.role || "-"}</td>
                  <td>{profile.phone || "-"}</td>
                  <td>{profile.position || "-"}</td>

                  {(canEditRoles || canCreateUsers) && (
                    <td>
                      {canEditRoles && (
                        <button type="button" onClick={() => startEdit(profile)}>
                          Edit
                        </button>
                      )}

                      {canDeleteProfile(profile) && (
                        <button
                          type="button"
                          onClick={() => deleteUser(profile)}
                          style={{
                            marginLeft: 6,
                            background: "red",
                            color: "white"
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}

          {filteredProfiles.length === 0 && (
            <tr>
              <td
                colSpan={canEditRoles || canCreateUsers ? 6 : 5}
                style={{ textAlign: "center" }}
              >
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = {
  padding: 8,
  display: "block",
  width: "100%",
  marginBottom: 8,
  boxSizing: "border-box",
  background: "#fff",
  color: "#000",
  border: "1px solid #999",
  position: "relative",
  zIndex: 10,
  pointerEvents: "auto"
};

const smallInputStyle = {
  padding: 6,
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  color: "#000",
  border: "1px solid #999"
};

export default UserManagement;