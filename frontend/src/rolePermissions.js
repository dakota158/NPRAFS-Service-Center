import { supabase } from "./supabaseClient";

// --- ADDED START ---
// Phase 29: shared role permission helpers.
// These are settings-based and do not require schema changes beyond app_settings.

export const ROLE_PERMISSION_ACTIONS = [
  "view",
  "edit",
  "create",
  "delete",
  "print",
  "export",
  "approve",
  "void",
  "refund",
  "settings"
];

export const DEFAULT_ROLES = [
  "Admin",
  "admin",
  "IT",
  "Manager",
  "Advisor",
  "Tech",
  "Parts",
  "User"
];

export const DEFAULT_PAGE_PERMISSIONS = [
  { key: "dashboard_home", label: "Home", group: "Core", tabs: ["Home", "Dashboard"] },
  { key: "customers", label: "Customers", group: "Core", tabs: ["Customers"] },
  { key: "vehicles", label: "Vehicles", group: "Core", tabs: ["Vehicles", "Customer Vehicles"] },
  { key: "invoice_manager", label: "Invoices / Estimates / ROs", group: "Workflow", tabs: ["Invoice Manager", "Invoices", "Estimates", "Repair Orders"] },
  { key: "jobs_work_orders", label: "Jobs / Work Orders", group: "Workflow", tabs: ["Jobs / Work Orders"] },
  { key: "job_dispatch", label: "Job Dispatch", group: "Workflow", tabs: ["Job Dispatch"] },
  { key: "priority_scoring", label: "Priority Scoring", group: "Workflow", tabs: ["Priority Scoring"] },
  { key: "customer_approvals", label: "Customer Approvals", group: "Workflow", tabs: ["Customer Approvals"] },
  { key: "ro_signatures", label: "RO Signatures", group: "Workflow", tabs: ["RO Signatures"] },
  { key: "deferred_work", label: "Deferred Work", group: "Workflow", tabs: ["Deferred Work"] },
  { key: "inventory_orders", label: "Inventory Orders", group: "Inventory", tabs: ["Inventory Orders", "Parts Orders"] },
  { key: "inventory_stock", label: "Inventory Stock", group: "Inventory", tabs: ["Inventory Stock", "Parts Stock"] },
  { key: "inventory_history", label: "Inventory History", group: "Inventory", tabs: ["Inventory History", "Parts History"] },
  { key: "parts_shortage", label: "Parts Shortages", group: "Inventory", tabs: ["Parts Shortage Board"] },
  { key: "core_ledger", label: "Core Charge Ledger", group: "Inventory", tabs: ["Core Charge Ledger"] },
  { key: "parts_aging", label: "Parts Aging", group: "Inventory", tabs: ["Parts Aging"] },
  { key: "cycle_counts", label: "Cycle Counts", group: "Inventory", tabs: ["Cycle Counts"] },
  { key: "payments", label: "Payments", group: "Money", tabs: ["Payments", "Stripe Terminal"] },
  { key: "refunds", label: "Refunds", group: "Money", tabs: ["Stripe Refunds", "Refunds Adjustments"] },
  { key: "cash_closeout", label: "Cash Closeout", group: "Money", tabs: ["Cash Closeout"] },
  { key: "customer_deposits", label: "Customer Deposits", group: "Money", tabs: ["Customer Deposits"] },
  { key: "vendor_matching", label: "Vendor Matching", group: "Money", tabs: ["Vendor Invoice Matching"] },
  { key: "job_profitability", label: "Job Profitability", group: "Money", tabs: ["Job Profitability"] },
  { key: "sms_messaging", label: "SMS Messaging", group: "Communication", tabs: ["SMS Messaging"] },
  { key: "communications", label: "Communications", group: "Communication", tabs: ["Communications", "Communication Log"] },
  { key: "followups", label: "Follow-Ups", group: "Communication", tabs: ["Follow Ups", "Estimate Follow-Up"] },
  { key: "service_reminders", label: "Service Reminders", group: "Communication", tabs: ["Service Reminders"] },
  { key: "referrals", label: "Customer Referrals", group: "Communication", tabs: ["Customer Referrals"] },
  { key: "no_show", label: "No-Show Tracking", group: "Communication", tabs: ["No Show Tracking"] },
  { key: "technicians", label: "Technicians", group: "Shop Floor", tabs: ["Technicians"] },
  { key: "time_clock", label: "Time Clock", group: "Shop Floor", tabs: ["Time Clock"] },
  { key: "inspections", label: "Inspections", group: "Shop Floor", tabs: ["Inspections", "Inspection Templates"] },
  { key: "quality_control", label: "Quality Control", group: "Shop Floor", tabs: ["Quality Control"] },
  { key: "comebacks", label: "Comebacks", group: "Shop Floor", tabs: ["Comebacks"] },
  { key: "tech_handoffs", label: "Tech Handoffs", group: "Shop Floor", tabs: ["Tech Handoffs"] },
  { key: "tech_quality", label: "Tech Quality", group: "Shop Floor", tabs: ["Tech Quality Scores", "Technician Efficiency", "Technician Workload"] },
  { key: "bay_management", label: "Bay Management", group: "Shop Floor", tabs: ["Bay Management"] },
  { key: "equipment", label: "Equipment Maintenance", group: "Shop Floor", tabs: ["Equipment Maintenance"] },
  { key: "kpi_snapshot", label: "KPI Snapshot", group: "Reports", tabs: ["KPI Snapshot"] },
  { key: "shop_goals", label: "Shop Goals", group: "Reports", tabs: ["Shop Goals", "KPI Goals"] },
  { key: "advisor_performance", label: "Advisor Performance", group: "Reports", tabs: ["Advisor Performance"] },
  { key: "customer_satisfaction", label: "Customer Satisfaction", group: "Reports", tabs: ["Customer Satisfaction"] },
  { key: "analytics", label: "Analytics", group: "Reports", tabs: ["Analytics", "Business Review", "Shop Health"] },
  { key: "audit_logs", label: "Audit Logs", group: "Admin", tabs: ["Audit Logs"] },
  { key: "settings", label: "Settings", group: "Admin", tabs: ["Settings", "Workflow Customization", "Future Layout", "Collapsible Sections", "Role Permissions"] },
  { key: "pdf_designer", label: "PDF Designer", group: "Admin", tabs: ["PDF Layout Designer"] },
  { key: "motor", label: "MOTOR Integration", group: "Admin", tabs: ["Motor Integration"] }
];

export function getUserRole(user) {
  return (
    user?.role ||
    user?.profile?.role ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    "User"
  );
}

export function buildDefaultPermissions() {
  const permissions = {};

  DEFAULT_PAGE_PERMISSIONS.forEach((page) => {
    permissions[page.key] = {};

    DEFAULT_ROLES.forEach((role) => {
      const isAdmin = role === "Admin" || role === "admin" || role === "IT";
      const isManager = role === "Manager";
      const isAdvisor = role === "Advisor";
      const isTech = role === "Tech";
      const isParts = role === "Parts";

      let canView = isAdmin || isManager;
      let canEdit = isAdmin || isManager;

      if (["customers", "vehicles", "invoice_manager", "customer_approvals", "ro_signatures", "sms_messaging", "communications", "followups", "service_reminders", "referrals", "no_show"].includes(page.key)) {
        canView = canView || isAdvisor;
        canEdit = canEdit || isAdvisor;
      }

      if (["jobs_work_orders", "job_dispatch", "ro_signatures", "inspections", "quality_control", "comebacks", "tech_handoffs", "bay_management", "equipment"].includes(page.key)) {
        canView = canView || isTech;
        canEdit = canEdit || isTech;
      }

      if (["inventory_orders", "inventory_stock", "inventory_history", "parts_shortage", "core_ledger", "parts_aging", "cycle_counts"].includes(page.key)) {
        canView = canView || isParts || isTech;
        canEdit = canEdit || isParts;
      }

      if (page.group === "Admin") {
        canView = isAdmin;
        canEdit = isAdmin;
      }

      if (page.group === "Money" || page.group === "Reports") {
        canView = isAdmin || isManager;
        canEdit = isAdmin || isManager;
      }

      permissions[page.key][role] = {
        view: canView,
        edit: canEdit,
        create: canEdit,
        delete: isAdmin,
        print: canView,
        export: isAdmin || isManager,
        approve: isAdmin || isManager || isAdvisor,
        void: isAdmin || isManager,
        refund: isAdmin || isManager,
        settings: isAdmin
      };
    });
  });

  return permissions;
}

export function buildDefaultSectionPermissions() {
  return {
    invoice_manager: {
      customer_info: { label: "Customer Info", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor"], true, true) },
      vehicle_info: { label: "Vehicle Info", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor", "Tech"], true, true) },
      labor_items: { label: "Labor Items", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor", "Tech"], true, true) },
      parts_items: { label: "Parts Items", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor", "Tech", "Parts"], true, true) },
      internal_costs: { label: "Internal Costs / Margins", roles: roleMap(["Admin", "admin", "IT", "Manager"], true, true) },
      totals: { label: "Totals", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor"], true, false) },
      payments: { label: "Payments", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor"], true, true) },
      signatures: { label: "Signatures", roles: roleMap(["Admin", "admin", "IT", "Manager", "Advisor", "Tech"], true, true) }
    },
    inventory_stock: {
      stock_levels: { label: "Stock Levels", roles: roleMap(["Admin", "admin", "IT", "Manager", "Parts", "Tech"], true, false) },
      costs: { label: "Costs", roles: roleMap(["Admin", "admin", "IT", "Manager", "Parts"], true, true) },
      locations: { label: "Locations", roles: roleMap(["Admin", "admin", "IT", "Manager", "Parts", "Tech"], true, true) },
      adjustments: { label: "Adjustments", roles: roleMap(["Admin", "admin", "IT", "Manager", "Parts"], true, true) }
    },
    reports: {
      revenue: { label: "Revenue", roles: roleMap(["Admin", "admin", "IT", "Manager"], true, false) },
      profit: { label: "Profit / Margins", roles: roleMap(["Admin", "admin", "IT", "Manager"], true, false) },
      technician: { label: "Technician Reports", roles: roleMap(["Admin", "admin", "IT", "Manager"], true, false) },
      exports: { label: "Exports", roles: roleMap(["Admin", "admin", "IT"], true, true) }
    }
  };
}

function roleMap(roles, view, edit) {
  const map = {};

  DEFAULT_ROLES.forEach((role) => {
    map[role] = {
      view: roles.includes(role) && view,
      edit: roles.includes(role) && edit
    };
  });

  return map;
}

export async function loadRolePermissionSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("setting_key", "role_permissions_json")
    .maybeSingle();

  if (error) throw error;

  const defaults = {
    enabled: true,
    hideBlockedNav: true,
    disableBlockedButtons: true,
    showBlockedMessage: true,
    roles: DEFAULT_ROLES,
    pages: DEFAULT_PAGE_PERMISSIONS,
    permissions: buildDefaultPermissions(),
    sections: buildDefaultSectionPermissions()
  };

  try {
    const parsed = JSON.parse(data?.setting_value || "{}");
    const parsedPages = Array.isArray(parsed.pages) && parsed.pages.length > 0
      ? parsed.pages
      : defaults.pages;

    const parsedRoles = Array.isArray(parsed.roles) && parsed.roles.length > 0
      ? parsed.roles
      : defaults.roles;

    const parsedPermissions =
      parsed.permissions && Object.keys(parsed.permissions).length > 0
        ? parsed.permissions
        : defaults.permissions;

    const parsedSections =
      parsed.sections && Object.keys(parsed.sections).length > 0
        ? parsed.sections
        : defaults.sections;

    return {
      ...defaults,
      ...parsed,
      roles: parsedRoles,
      pages: parsedPages,
      permissions: {
        ...defaults.permissions,
        ...parsedPermissions
      },
      sections: {
        ...defaults.sections,
        ...parsedSections
      }
    };
  } catch {
    return defaults;
  }
}

export function findPageForTab(settings, activeTab) {
  const tab = String(activeTab || "").toLowerCase();

  return (settings.pages || DEFAULT_PAGE_PERMISSIONS).find((page) =>
    (page.tabs || []).some((candidate) => String(candidate).toLowerCase() === tab) ||
    String(page.label || "").toLowerCase() === tab
  );
}

export function hasPagePermission(settings, user, activeTab, action = "view") {
  if (!settings?.enabled) return true;

  const role = getUserRole(user);
  const page = findPageForTab(settings, activeTab);

  if (!page) return true;

  const rule = settings.permissions?.[page.key]?.[role];

  if (!rule) return false;

  return Boolean(rule[action]);
}

export function hasSectionPermission(settings, user, pageKey, sectionKey, action = "view") {
  if (!settings?.enabled) return true;

  const role = getUserRole(user);
  const section = settings.sections?.[pageKey]?.[sectionKey];

  if (!section) return true;

  return Boolean(section.roles?.[role]?.[action]);
}
// --- ADDED END ---
