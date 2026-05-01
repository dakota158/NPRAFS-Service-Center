import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

// --- ADDED START ---
// Phase 26C: safe modern command center.
// This is intentionally a normal page, not a full Dashboard wrapper, so it cannot break login/startup.
// It reads the same modern_workflow_settings_json settings created in Workflow Customization.

const DEFAULT_SETTINGS = {
  branding: {
    appName: "Auto Shop Manager",
    accentColor: "#2563eb",
    homeGreeting: "Good work starts with a clear workflow."
  },
  layout: {
    modernModeEnabled: false,
    compactMode: true,
    showQuickStats: true,
    showWorkflow: true,
    showSearch: true,
    hideAdvancedByDefault: true
  },
  fieldLabels: {
    estimateLabel: "Estimate",
    repairOrderLabel: "Repair Order",
    invoiceLabel: "Invoice",
    customerLabel: "Customer",
    technicianLabel: "Technician",
    advisorLabel: "Service Advisor",
    partsLabel: "Parts",
    laborLabel: "Labor"
  },
  features: {}
};

const COMMANDS = [
  { key: "estimate", label: "Create Estimate", description: "Start a customer quote.", tab: "Invoice Manager", group: "Front Counter", roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "repair_order", label: "Open Repair Orders", description: "See work that is approved and ready.", tab: "Invoice Manager", group: "Front Counter", roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "dispatch", label: "Job Dispatch", description: "Assign jobs and move them through the shop.", tab: "Job Dispatch", group: "Shop Floor", roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "payment", label: "Take Payment", description: "Use Stripe Terminal or record payments.", tab: "Stripe Terminal", group: "Money", roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "signature", label: "Get Signature", description: "Capture repair order authorization.", tab: "RO Signatures", group: "Front Counter", roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "customers", label: "Customers", description: "Find customer records.", tab: "Customers", group: "Core", roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "inventory", label: "Inventory", description: "Check stock, orders, and history.", tab: "Inventory", group: "Parts", roles: ["Admin", "admin", "IT", "Manager", "Parts"] },
  { key: "shortage", label: "Parts Shortage Board", description: "See jobs waiting on parts.", tab: "Parts Shortage Board", group: "Parts", roles: ["Admin", "admin", "IT", "Manager", "Parts", "Tech"] },
  { key: "approval", label: "Customer Approvals", description: "Track approvals before work starts.", tab: "Customer Approvals", group: "Front Counter", roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "deferred", label: "Deferred Work", description: "Follow up on declined or future work.", tab: "Deferred Work", group: "Revenue", roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "sms", label: "SMS Messaging", description: "Text customers updates and reminders.", tab: "SMS Messaging", group: "Communication", roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "kpi", label: "KPI Snapshot", description: "Owner dashboard for performance.", tab: "KPI Snapshot", group: "Management", roles: ["Admin", "admin", "IT", "Manager"] }
];

const WORKFLOW = [
  { title: "1. Estimate", body: "Build the estimate, add labor/parts, and send for customer approval.", tab: "Invoice Manager" },
  { title: "2. Repair Order", body: "Convert approved estimate to RO and capture authorization.", tab: "RO Signatures" },
  { title: "3. Dispatch", body: "Assign the technician and keep the job moving.", tab: "Job Dispatch" },
  { title: "4. Payment", body: "Collect payment and finalize the invoice.", tab: "Stripe Terminal" }
];

function ModernWorkflowShellSafe({ user, setActiveTab, selectOperationsTab, settings: incomingSettings, modernModeEnabled }) {
  const [settings, setSettings] = useState(mergeSettings(DEFAULT_SETTINGS, incomingSettings || {}));
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({
    openJobs: 0,
    estimates: 0,
    unpaid: 0,
    waitingParts: 0,
    approvals: 0,
    deferredValue: 0
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSettings(mergeSettings(DEFAULT_SETTINGS, incomingSettings || {}));
  }, [incomingSettings]);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "modern_workflow_settings_json")
        .maybeSingle();

      const parsed = data?.setting_value ? JSON.parse(data.setting_value) : {};
      setSettings(mergeSettings(DEFAULT_SETTINGS, parsed));
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const loadStats = async () => {
    try {
      const [invoiceResult, approvalResult, deferredResult] = await Promise.all([
        supabase.from("invoices").select("*"),
        supabase.from("app_settings").select("*").eq("setting_key", "customer_approvals_json").maybeSingle(),
        supabase.from("app_settings").select("*").eq("setting_key", "deferred_work_json").maybeSingle()
      ]);

      const invoices = invoiceResult.data || [];

      let approvals = [];
      let deferred = [];

      try {
        approvals = JSON.parse(approvalResult.data?.setting_value || "[]");
      } catch {
        approvals = [];
      }

      try {
        deferred = JSON.parse(deferredResult.data?.setting_value || "[]");
      } catch {
        deferred = [];
      }

      setStats({
        openJobs: invoices.filter((item) => !["Completed", "Delivered", "Cancelled", "Voided"].includes(item.status)).length,
        estimates: invoices.filter((item) => item.document_status === "Estimate" || item.estimate_number).length,
        unpaid: invoices.filter((item) => Number(item.grand_total || 0) > Number(item.amount_paid || 0)).length,
        waitingParts: invoices.filter((item) => item.status === "Waiting Parts").length,
        approvals: approvals.filter((item) => item.status === "Pending").length,
        deferredValue: deferred
          .filter((item) => !["Completed", "Declined"].includes(item.status))
          .reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0)
      });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const role = user?.role || user?.user_metadata?.role || "User";
  const accentColor = settings.branding?.accentColor || "#2563eb";

  const visibleCommands = useMemo(() => {
    const term = search.trim().toLowerCase();

    return COMMANDS.filter((command) => {
      const feature = settings.features?.[command.key];
      const visible = feature?.visible ?? true;
      const roles = feature?.roles || command.roles;
      const roleAllowed = roles.includes(role) || roles.includes("User");
      const matchesSearch = !term || `${command.label} ${command.description} ${command.group}`.toLowerCase().includes(term);

      return visible && roleAllowed && matchesSearch;
    });
  }, [settings, search, role]);

  const goTo = (tab) => {
    if (typeof selectOperationsTab === "function") {
      selectOperationsTab(tab);
      return;
    }

    if (typeof setActiveTab === "function") {
      setActiveTab(tab);
    }
  };

  return (
    <div style={shellStyle}>
      <div style={heroStyle}>
        <div>
          <div style={{ ...eyebrowStyle, color: accentColor }}>Modern Command Center</div>
          <h1 style={titleStyle}>{settings.branding?.appName || "Auto Shop Manager"}</h1>
          <p style={subtitleStyle}>{settings.branding?.homeGreeting || "Good work starts with a clear workflow."}</p>
        </div>

        <div style={heroActionsStyle}>
          <button type="button" onClick={loadStats} style={{ ...primaryButtonStyle, background: accentColor, borderColor: accentColor }}>
            Refresh
          </button>
          <button type="button" onClick={() => goTo("Workflow Customization")} style={secondaryButtonStyle}>
            Customize
          </button>
        </div>
      </div>

      {!modernModeEnabled && (
        <div style={noticeStyle}>
          Modern mode is currently OFF. This page is safe to use as a preview. Turn it on in Workflow Settings when ready.
        </div>
      )}

      {message && <p style={{ color: "red" }}>{message}</p>}

      {settings.layout?.showQuickStats !== false && (
        <div style={statGridStyle}>
          <StatCard title="Open Jobs" value={stats.openJobs} />
          <StatCard title={settings.fieldLabels?.estimateLabel || "Estimates"} value={stats.estimates} />
          <StatCard title="Unpaid" value={stats.unpaid} />
          <StatCard title="Waiting Parts" value={stats.waitingParts} />
          <StatCard title="Pending Approvals" value={stats.approvals} />
          <StatCard title="Deferred Value" value={`$${stats.deferredValue.toFixed(2)}`} />
        </div>
      )}

      {settings.layout?.showWorkflow !== false && (
        <div style={workflowGridStyle}>
          {WORKFLOW.map((step) => (
            <div key={step.title} style={workflowCardStyle}>
              <h3 style={{ marginTop: 0 }}>{step.title}</h3>
              <p style={{ color: "#64748b" }}>{step.body}</p>
              <button type="button" onClick={() => goTo(step.tab)} style={{ ...smallButtonStyle, borderColor: accentColor, color: accentColor }}>
                Open
              </button>
            </div>
          ))}
        </div>
      )}

      {settings.layout?.showSearch !== false && (
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search actions, tools, workflows..."
          style={searchStyle}
        />
      )}

      <div style={commandGroupGridStyle}>
        {Object.entries(groupBy(visibleCommands, "group")).map(([group, commands]) => (
          <div key={group} style={commandGroupStyle}>
            <h3 style={{ marginTop: 0 }}>{group}</h3>

            {commands.map((command) => (
              <button
                type="button"
                key={command.key}
                onClick={() => goTo(command.tab)}
                style={commandButtonStyle}
              >
                <strong>{command.label}</strong>
                <span>{command.description}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCardStyle}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const group = item[key] || "Other";
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
}

function mergeSettings(defaults, incoming) {
  const output = { ...defaults };

  Object.keys(incoming || {}).forEach((key) => {
    if (incoming[key] && typeof incoming[key] === "object" && !Array.isArray(incoming[key])) {
      output[key] = mergeSettings(defaults[key] || {}, incoming[key]);
    } else {
      output[key] = incoming[key];
    }
  });

  return output;
}

const shellStyle = { display: "grid", gap: 16 };
const heroStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", background: "linear-gradient(135deg, #eff6ff, #ffffff)", border: "1px solid #dbeafe", borderRadius: 18, padding: 18 };
const eyebrowStyle = { fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 };
const titleStyle = { margin: "4px 0", fontSize: 30 };
const subtitleStyle = { color: "#64748b", margin: 0 };
const heroActionsStyle = { display: "flex", gap: 8, flexWrap: "wrap" };
const primaryButtonStyle = { border: "1px solid #2563eb", color: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" };
const secondaryButtonStyle = { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 12, padding: "10px 14px", cursor: "pointer" };
const noticeStyle = { background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 12, padding: 12, color: "#92400e" };
const statGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };
const statCardStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)" };
const workflowGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 };
const workflowCardStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14 };
const smallButtonStyle = { background: "white", border: "1px solid #2563eb", borderRadius: 10, padding: "8px 10px", cursor: "pointer" };
const searchStyle = { width: "100%", padding: 12, boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 14 };
const commandGroupGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const commandGroupStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14 };
const commandButtonStyle = { display: "grid", gap: 4, width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 8, cursor: "pointer", color: "#0f172a" };

export default ModernWorkflowShellSafe;
// --- ADDED END ---
