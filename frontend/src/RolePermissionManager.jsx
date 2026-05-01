import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  DEFAULT_PAGE_PERMISSIONS,
  DEFAULT_ROLES,
  ROLE_PERMISSION_ACTIONS,
  buildDefaultPermissions,
  buildDefaultSectionPermissions,
  loadRolePermissionSettings
} from "./rolePermissions";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 29: role/page/section permission manager.
// Lets Admin/IT choose what each role can view/edit/create/delete/export/print/approve.

const ACTION_LABELS = {
  view: "View",
  edit: "Edit",
  create: "Create",
  delete: "Delete",
  print: "Print",
  export: "Export",
  approve: "Approve",
  void: "Void",
  refund: "Refund",
  settings: "Settings"
};

function RolePermissionManager({ user, canEditEverything }) {
  const [settings, setSettings] = useState({
    enabled: true,
    hideBlockedNav: true,
    disableBlockedButtons: true,
    showBlockedMessage: true,
    roles: DEFAULT_ROLES,
    pages: DEFAULT_PAGE_PERMISSIONS,
    permissions: buildDefaultPermissions(),
    sections: buildDefaultSectionPermissions()
  });
  const [activeRole, setActiveRole] = useState("Manager");
  const [activeGroup, setActiveGroup] = useState("Workflow");
  const [activeMode, setActiveMode] = useState("Pages");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loaded = await loadRolePermissionSettings();
      setSettings(loaded);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const saveSettings = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save role permissions.");
      return;
    }

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "role_permissions_json",
        setting_value: JSON.stringify(settings, null, 2),
        description: "Role-based page, section, and action permissions",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Role Permissions Saved",
      table_name: "app_settings",
      record_id: "role_permissions_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Permissions updated by ${user?.email || "unknown"}`
    });

    setMessage("Role permissions saved.");
  };

  const groups = useMemo(() => {
    return Array.from(new Set((settings.pages || []).map((page) => page.group))).sort();
  }, [settings.pages]);

  const visiblePages = useMemo(() => {
    return (settings.pages || []).filter((page) => page.group === activeGroup);
  }, [settings.pages, activeGroup]);

  const setSetting = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updatePermission = (pageKey, role, action, value) => {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...(prev.permissions || {}),
        [pageKey]: {
          ...((prev.permissions || {})[pageKey] || {}),
          [role]: {
            ...(((prev.permissions || {})[pageKey] || {})[role] || {}),
            [action]: value
          }
        }
      }
    }));
  };

  const updateAllActionsForPageRole = (pageKey, role, value) => {
    setSettings((prev) => {
      const nextRoleRule = {};
      ROLE_PERMISSION_ACTIONS.forEach((action) => {
        nextRoleRule[action] = value;
      });

      return {
        ...prev,
        permissions: {
          ...(prev.permissions || {}),
          [pageKey]: {
            ...((prev.permissions || {})[pageKey] || {}),
            [role]: nextRoleRule
          }
        }
      };
    });
  };

  const updateRoleForGroup = (role, value) => {
    setSettings((prev) => {
      const nextPermissions = { ...(prev.permissions || {}) };

      visiblePages.forEach((page) => {
        const nextRoleRule = {};
        ROLE_PERMISSION_ACTIONS.forEach((action) => {
          nextRoleRule[action] = value;
        });

        nextPermissions[page.key] = {
          ...(nextPermissions[page.key] || {}),
          [role]: nextRoleRule
        };
      });

      return {
        ...prev,
        permissions: nextPermissions
      };
    });
  };

  const updateSectionPermission = (pageKey, sectionKey, role, action, value) => {
    setSettings((prev) => ({
      ...prev,
      sections: {
        ...(prev.sections || {}),
        [pageKey]: {
          ...((prev.sections || {})[pageKey] || {}),
          [sectionKey]: {
            ...(((prev.sections || {})[pageKey] || {})[sectionKey] || {}),
            roles: {
              ...((((prev.sections || {})[pageKey] || {})[sectionKey] || {}).roles || {}),
              [role]: {
                ...(((((prev.sections || {})[pageKey] || {})[sectionKey] || {}).roles || {})[role] || {}),
                [action]: value
              }
            }
          }
        }
      }
    }));
  };

  const resetDefaults = () => {
    setSettings({
      enabled: true,
      hideBlockedNav: true,
      disableBlockedButtons: true,
      showBlockedMessage: true,
      roles: DEFAULT_ROLES,
      pages: DEFAULT_PAGE_PERMISSIONS,
      permissions: buildDefaultPermissions(),
      sections: buildDefaultSectionPermissions()
    });
    setMessage("Default permissions loaded. Click Save to apply.");
  };

  const activeRoleAllowedCount = useMemo(() => {
    return (settings.pages || []).filter((page) => settings.permissions?.[page.key]?.[activeRole]?.view).length;
  }, [settings, activeRole]);

  return (
    <div>
      <h2>Role Permissions</h2>
      <p>
        Choose exactly what each role can see and edit. This controls pages, sections, and actions.
      </p>

      {message && <p style={{ color: message.includes("saved") || message.includes("Default") ? "green" : "red" }}>{message}</p>}

      <div className="future-kpi-grid">
        <Kpi label="Permission System" value={settings.enabled ? "On" : "Off"} />
        <Kpi label="Active Role" value={activeRole} />
        <Kpi label="Pages Visible" value={activeRoleAllowedCount} />
        <Kpi label="Page Groups" value={groups.length} />
      </div>

      <div className="role-permission-toolbar">
        <button type="button" className={activeMode === "Pages" ? "active" : ""} onClick={() => setActiveMode("Pages")}>Pages</button>
        <button type="button" className={activeMode === "Sections" ? "active" : ""} onClick={() => setActiveMode("Sections")}>Sections</button>
        <button type="button" className={activeMode === "Options" ? "active" : ""} onClick={() => setActiveMode("Options")}>Options</button>
      </div>

      {activeMode === "Options" && (
        <div style={panelStyle}>
          <h3>Permission Behavior</h3>
          <div className="future-form-grid">
            <Checkbox label="Enable role permissions" checked={settings.enabled} onChange={(value) => setSetting("enabled", value)} />
            <Checkbox label="Hide blocked navigation/buttons" checked={settings.hideBlockedNav} onChange={(value) => setSetting("hideBlockedNav", value)} />
            <Checkbox label="Disable blocked buttons" checked={settings.disableBlockedButtons} onChange={(value) => setSetting("disableBlockedButtons", value)} />
            <Checkbox label="Show blocked page message" checked={settings.showBlockedMessage} onChange={(value) => setSetting("showBlockedMessage", value)} />
          </div>
        </div>
      )}

      {(activeMode === "Pages" || activeMode === "Sections") && (
        <div style={panelStyle}>
          <div className="future-form-grid">
            <label>
              Role
              <select value={activeRole} onChange={(event) => setActiveRole(event.target.value)}>
                {(settings.roles || DEFAULT_ROLES).map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>

            <label>
              Page Group
              <select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)}>
                {groups.map((group) => <option key={group}>{group}</option>)}
              </select>
            </label>
          </div>

          {activeMode === "Pages" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button type="button" onClick={() => updateRoleForGroup(activeRole, true)}>Allow All In Group</button>
                <button type="button" onClick={() => updateRoleForGroup(activeRole, false)}>Block All In Group</button>
              </div>

              <div className="role-permission-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Tabs Covered</th>
                      {ROLE_PERMISSION_ACTIONS.map((action) => (
                        <th key={action}>{ACTION_LABELS[action]}</th>
                      ))}
                      <th>All</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visiblePages.map((page) => {
                      const rule = settings.permissions?.[page.key]?.[activeRole] || {};

                      return (
                        <tr key={page.key}>
                          <td>
                            <strong>{page.label}</strong>
                            <br />
                            <small>{page.key}</small>
                          </td>
                          <td>
                            <small>{(page.tabs || []).join(", ")}</small>
                          </td>

                          {ROLE_PERMISSION_ACTIONS.map((action) => (
                            <td key={action} style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={Boolean(rule[action])}
                                onChange={(event) => updatePermission(page.key, activeRole, action, event.target.checked)}
                              />
                            </td>
                          ))}

                          <td>
                            <button type="button" onClick={() => updateAllActionsForPageRole(page.key, activeRole, true)}>Allow</button>{" "}
                            <button type="button" onClick={() => updateAllActionsForPageRole(page.key, activeRole, false)}>Block</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeMode === "Sections" && (
            <div>
              <h3>Section Permissions</h3>
              <p>
                Section permissions are for detailed control inside important pages. More sections can be added later as individual screens are converted.
              </p>

              {Object.entries(settings.sections || {}).map(([pageKey, sections]) => (
                <div key={pageKey} className="role-section-card">
                  <h4>{pageKey}</h4>

                  <table>
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>View</th>
                        <th>Edit</th>
                      </tr>
                    </thead>

                    <tbody>
                      {Object.entries(sections || {}).map(([sectionKey, section]) => {
                        const roleRule = section.roles?.[activeRole] || {};

                        return (
                          <tr key={sectionKey}>
                            <td>
                              <strong>{section.label || sectionKey}</strong>
                              <br />
                              <small>{sectionKey}</small>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={Boolean(roleRule.view)}
                                onChange={(event) => updateSectionPermission(pageKey, sectionKey, activeRole, "view", event.target.checked)}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={Boolean(roleRule.edit)}
                                onChange={(event) => updateSectionPermission(pageKey, sectionKey, activeRole, "edit", event.target.checked)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="future-action-strip">
        <button type="button" onClick={saveSettings} disabled={!canEditEverything}>Save Permissions</button>
        <button type="button" onClick={loadSettings}>Reload</button>
        <button type="button" onClick={resetDefaults}>Reset Defaults</button>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={checkboxStyle}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="future-kpi">
      <div className="future-kpi-label">{label}</div>
      <div className="future-kpi-value">{value}</div>
    </div>
  );
}

const panelStyle = { border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, marginTop: 16, background: "white" };
const checkboxStyle = { display: "flex", gap: 8, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" };

export default RolePermissionManager;
// --- ADDED END ---
