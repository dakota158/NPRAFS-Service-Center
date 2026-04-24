import { useEffect, useState } from "react";

function UserManagement({ user }) {
  const role = user?.role || "Tech";

  const canCreateAnyUser = role === "IT" || role === "admin";
  const canCreateTechOnly = role === "Manager";
  const canManageAllUsers = role === "IT" || role === "admin";

  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    username: "",
    password: "",
    userType: "Tech"
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    username: "",
    password: "",
    userType: "Tech"
  });

  const loadUsers = async () => {
    try {
      const res = await fetch("http://localhost:5000/users");
      const data = await res.json();

      if (data.success) {
        setUsers(data.users || []);
      } else {
        setMessage(data.message || "Could not load users");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not connect to backend");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateEditForm = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const createUser = async () => {
    setMessage("");

    const roleToCreate = canCreateAnyUser ? form.userType : "Tech";

    if (
      !form.name ||
      !form.email ||
      !form.phone ||
      !form.position ||
      !form.username ||
      !form.password
    ) {
      setMessage(
        "Name, email, phone number, position, username, and password are required"
      );
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          position: form.position,
          username: form.username,
          password: form.password,
          role: roleToCreate,
          createdByRole: role
        })
      });

      const data = await res.json();

      if (data.success) {
        setForm({
          name: "",
          email: "",
          phone: "",
          position: "",
          username: "",
          password: "",
          userType: "Tech"
        });

        setMessage(`${roleToCreate} user created`);
        loadUsers();
      } else {
        setMessage(data.message || "Could not create user");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not create user");
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      position: item.position || "",
      username: item.username || "",
      password: "",
      userType: item.role || "Tech"
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: "",
      email: "",
      phone: "",
      position: "",
      username: "",
      password: "",
      userType: "Tech"
    });
  };

  const saveEdit = async (id) => {
    if (!canManageAllUsers) return;

    setMessage("");

    if (
      !editForm.name ||
      !editForm.email ||
      !editForm.phone ||
      !editForm.position ||
      !editForm.username
    ) {
      setMessage("Name, email, phone number, position, and username are required");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          position: editForm.position,
          username: editForm.username,
          password: editForm.password,
          role: editForm.userType,
          updatedByRole: role
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessage("User updated");
        cancelEdit();
        loadUsers();
      } else {
        setMessage(data.message || "Could not update user");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not update user");
    }
  };

  return (
    <div>
      <h2>User Management</h2>

      {canCreateAnyUser && (
        <p>Admin / I.T. can create and edit Tech, Manager, I.T., and Admin users.</p>
      )}

      {canCreateTechOnly && (
        <p>Managers can create Tech users only.</p>
      )}

      <div
        style={{
          border: "1px solid #ccc",
          padding: 12,
          maxWidth: 600,
          marginBottom: 20
        }}
      >
        <h3>Add User</h3>

        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => updateForm("email", e.target.value)}
          style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
        />

        <input
          placeholder="Phone Number"
          value={form.phone}
          onChange={(e) => updateForm("phone", e.target.value)}
          style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
        />

        <input
          placeholder="Position"
          value={form.position}
          onChange={(e) => updateForm("position", e.target.value)}
          style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
        />

        <input
          placeholder="Login Username"
          value={form.username}
          onChange={(e) => updateForm("username", e.target.value)}
          style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
        />

        <input
          type="password"
          placeholder="Login Password"
          value={form.password}
          onChange={(e) => updateForm("password", e.target.value)}
          style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
        />

        {canCreateAnyUser ? (
          <select
            value={form.userType}
            onChange={(e) => updateForm("userType", e.target.value)}
            style={{ padding: 8, display: "block", width: "100%", marginBottom: 8 }}
          >
            <option value="Tech">Tech</option>
            <option value="Manager">Manager</option>
            <option value="IT">I.T.</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <p>User Type: Tech</p>
        )}

        <button onClick={createUser}>Create User</button>

        {message && <p>{message}</p>}
      </div>

      <h3>Users</h3>

      <table
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>User Type</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Position</th>
            {canManageAllUsers && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {users.map((item) => (
            <tr key={item.id}>
              {editingId === item.id ? (
                <>
                  <td>
                    <input
                      value={editForm.name}
                      onChange={(e) => updateEditForm("name", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      value={editForm.username}
                      onChange={(e) => updateEditForm("username", e.target.value)}
                    />
                  </td>

                  <td>
                    <select
                      value={editForm.userType}
                      onChange={(e) => updateEditForm("userType", e.target.value)}
                    >
                      <option value="Tech">Tech</option>
                      <option value="Manager">Manager</option>
                      <option value="IT">I.T.</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td>
                    <input
                      value={editForm.email}
                      onChange={(e) => updateEditForm("email", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      value={editForm.phone}
                      onChange={(e) => updateEditForm("phone", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      value={editForm.position}
                      onChange={(e) => updateEditForm("position", e.target.value)}
                    />

                    <input
                      type="password"
                      placeholder="New password optional"
                      value={editForm.password}
                      onChange={(e) => updateEditForm("password", e.target.value)}
                      style={{ display: "block", marginTop: 6 }}
                    />
                  </td>

                  <td>
                    <button onClick={() => saveEdit(item.id)}>Save</button>
                    <button onClick={cancelEdit} style={{ marginLeft: 6 }}>
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{item.name || "-"}</td>
                  <td>{item.username || "-"}</td>
                  <td>{item.role || "-"}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.position || "-"}</td>

                  {canManageAllUsers && (
                    <td>
                      <button onClick={() => startEdit(item)}>Edit Login</button>
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}

          {users.length === 0 && (
            <tr>
              <td colSpan={canManageAllUsers ? 7 : 6} style={{ textAlign: "center" }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default UserManagement;