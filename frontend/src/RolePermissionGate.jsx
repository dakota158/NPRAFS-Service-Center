import { useEffect, useState } from "react";
import { getUserRole, hasPagePermission, loadRolePermissionSettings, findPageForTab } from "./rolePermissions";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 29: lightweight runtime permission gate.
// This blocks/hides pages by role based on settings.
// It is intentionally conservative and does not delete data or rewrite page logic.

function RolePermissionGate({ user, activeTab, canEditEverything }) {
  const [settings, setSettings] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedPage, setBlockedPage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!settings?.enabled) {
      setBlocked(false);
      return;
    }

    const allowed = hasPagePermission(settings, user, activeTab, "view");
    const page = findPageForTab(settings, activeTab);

    setBlocked(!allowed);
    setBlockedPage(page || null);

    applyActionPermissions(settings, user, activeTab);
  }, [settings, user, activeTab]);

  const loadSettings = async () => {
    try {
      const loaded = await loadRolePermissionSettings();
      setSettings(loaded);
    } catch {
      setSettings(null);
    }
  };

  const applyActionPermissions = (loadedSettings, currentUser, currentTab) => {
    if (!loadedSettings?.enabled) return;

    const canEdit = hasPagePermission(loadedSettings, currentUser, currentTab, "edit");
    const canCreate = hasPagePermission(loadedSettings, currentUser, currentTab, "create");
    const canDelete = hasPagePermission(loadedSettings, currentUser, currentTab, "delete");
    const canPrint = hasPagePermission(loadedSettings, currentUser, currentTab, "print");
    const canExport = hasPagePermission(loadedSettings, currentUser, currentTab, "export");
    const canApprove = hasPagePermission(loadedSettings, currentUser, currentTab, "approve");
    const canRefund = hasPagePermission(loadedSettings, currentUser, currentTab, "refund");

    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.forEach((button) => {
      if (button.closest(".sidebar, .dashboard-sidebar, .future-operations-nav, .role-permission-toolbar")) return;
      if (button.dataset.permissionGateManaged === "false") return;

      const label = String(button.textContent || "").toLowerCase();

      let allowed = true;

      if (["save", "update", "edit"].some((word) => label.includes(word))) allowed = canEdit;
      if (["add", "create", "new"].some((word) => label.includes(word))) allowed = canCreate;
      if (["delete", "remove", "trash"].some((word) => label.includes(word))) allowed = canDelete;
      if (label.includes("print")) allowed = canPrint;
      if (label.includes("export") || label.includes("csv")) allowed = canExport;
      if (label.includes("approve")) allowed = canApprove;
      if (label.includes("refund")) allowed = canRefund;

      if (!allowed && loadedSettings.disableBlockedButtons) {
        button.disabled = true;
        button.title = "Your role does not have permission for this action.";
        button.classList.add("permission-disabled-button");
      }
    });
  };

  if (!settings?.enabled || !blocked || canEditEverything) {
    return null;
  }

  const role = getUserRole(user);

  return (
    <div className="permission-block-overlay">
      <div className="permission-block-card">
        <h2>Access Restricted</h2>
        <p>
          Your role <strong>{role}</strong> does not have permission to view{" "}
          <strong>{blockedPage?.label || activeTab}</strong>.
        </p>
        <p>Please contact an Admin or IT user if you need access.</p>
      </div>
    </div>
  );
}

export default RolePermissionGate;
// --- ADDED END ---
