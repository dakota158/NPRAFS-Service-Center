import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_PERMISSIONS = {
  dashboard: ["Tech", "Manager", "IT", "Admin", "admin"],
  invoices_create: ["Tech", "Manager", "IT", "Admin", "admin"],
  invoices_edit: ["Manager", "IT", "Admin", "admin"],
  invoices_void: ["Manager", "IT", "Admin", "admin"],
  inventory_edit: ["Manager", "IT", "Admin", "admin"],
  settings_edit: ["IT", "Admin", "admin"],
  users_manage: ["Admin", "admin"],
  reports_view_money: ["Manager", "IT", "Admin", "admin"],
  audit_view: ["Manager", "IT", "Admin", "admin"],
  expenses_manage: ["Manager", "IT", "Admin", "admin"]
};

const ROLES = ["Tech", "Manager", "IT", "Admin", "admin"];

function PermissionsMatrixManager({ user, canEditEverything }) {
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "permissions_matrix_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "{}");
      setPermissions({ ...DEFAULT_PERMISSIONS, ...parsed });
    } catch {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const savePermissions = async (nextPermissions) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "permissions_matrix_json",
        setting_value: JSON.stringify(nextPermissions, null, 2),
        description: "Role permission matrix",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Permissions Matrix Updated",
      table_name: "app_settings",
      record_id: "permissions_matrix_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: "Updated role permission matrix"
    });

    setPermissions(nextPermissions);
    setMessage("Permissions saved.");
  };

  const toggleRole = (permissionKey, role) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can edit permissions.");
      return;
    }

    const currentRoles = permissions[permissionKey] || [];
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((item) => item !== role)
      : [...currentRoles, role];

    setPermissions((prev) => ({
      ...prev,
      [permissionKey]: nextRoles
    }));
  };

  return (
    <div>
      <h2>Permissions Matrix</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <p>
        This saves a role matrix in settings. Existing screens still use their current role checks,
        but this gives you a professional admin reference and a future-ready single source for permissions.
      </p>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Permission</th>
            {ROLES.map((role) => (
              <th key={role}>{role}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Object.keys(permissions).map((permissionKey) => (
            <tr key={permissionKey}>
              <td>
                <strong>{permissionKey.replaceAll("_", " ")}</strong>
              </td>

              {ROLES.map((role) => (
                <td key={role} style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={(permissions[permissionKey] || []).includes(role)}
                    onChange={() => toggleRole(permissionKey, role)}
                    disabled={!canEditEverything}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => savePermissions(permissions)}
        style={{ marginTop: 12 }}
        disabled={!canEditEverything}
      >
        Save Permissions
      </button>
    </div>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default PermissionsMatrixManager;
