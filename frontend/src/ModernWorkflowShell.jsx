import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_FEATURES = [
  { key: "dashboard_home", label: "Home", group: "Core", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "customers", label: "Customers", group: "Core", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "vehicles", label: "Vehicles", group: "Core", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "estimates", label: "Estimates", group: "Workflow", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "repair_orders", label: "Repair Orders", group: "Workflow", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "invoices", label: "Invoices", group: "Workflow", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "job_dispatch", label: "Job Dispatch", group: "Workflow", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "stripe_terminal", label: "Payments", group: "Money", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor"] },
  { key: "ro_signatures", label: "Signatures", group: "Workflow", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Advisor", "Tech"] },
  { key: "inventory", label: "Inventory", group: "Inventory", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Parts"] },
  { key: "parts_shortages", label: "Parts Shortages", group: "Inventory", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager", "Parts", "Tech"] },
  { key: "reports", label: "Reports", group: "Management", defaultVisible: true, roles: ["Admin", "admin", "IT", "Manager"] },
  { key: "settings", label: "Settings", group: "Admin", defaultVisible: true, roles: ["Admin", "admin", "IT"] }
];

const DEFAULT_WORKFLOW_STEPS = [
  {
    key: "estimate",
    title: "1. Estimate",
    description: "Create or review estimate, parts, labor, and customer approval.",
    primaryAction: "Open Estimates",
    targetTab: "Invoice Manager"
  },
  {
    key: "repair_order",
    title: "2. Repair Order",
    description: "Convert approved estimate to RO, collect signature, assign technician.",
    primaryAction: "Open Repair Orders",
    targetTab: "Invoice Manager"
  },
  {
    key: "dispatch",
    title: "3. Dispatch",
    description: "Move the job through waiting, assigned, in progress, QC, and ready.",
    primaryAction: "Open Dispatch",
    targetTab: "Job Dispatch"
  },
  {
    key: "payment",
    title: "4. Payment",
    description: "Collect card, cash, check, or partial payments and mark the invoice paid.",
    primaryAction: "Take Payment",
    targetTab: "Stripe Terminal"
  }
];

function ModernWorkflowShell({ user, activeTab, setActiveTab, children }) {
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [quickStats, setQuickStats] = useState({
    openJobs: 0,
    estimates: 0,
    unpaid: 0,
    waitingParts: 0
  });

  useEffect(() => {
    loadSettings();
    loadQuickStats();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "modern_workflow_settings_json")
      .maybeSingle();

    try {
      const parsed = JSON.parse(data?.setting_value || "{}");
      setSettings(parsed);
    } catch {
      setSettings({});
    }
  };

  const loadQuickStats = async () => {
    const { data } = await supabase.from("invoices").select("*");

    const invoices = data || [];

    setQuickStats({
      openJobs: invoices.filter((item) => !["Completed", "Delivered", "Cancelled", "Voided"].includes(item.status)).length,
      estimates: invoices.filter((item) => item.document_status === "Estimate" || item.estimate_number).length,
      unpaid: invoices.filter((item) => item.payment_status !== "Paid" && Number(item.grand_total || 0) > Number(item.amount_paid || 0)).length,
      waitingParts: invoices.filter((item) => item.status === "Waiting Parts").length
    });
  };

  const role = user?.role || user?.user_metadata?.role || "User";
  const compactMode = settings?.layout?.compactMode ?? true;
  const showQuickStats = settings?.layout?.showQuickStats ?? true;
  const showWorkflow = settings?.layout?.showWorkflow ?? true;
  const brandName = settings?.branding?.appName || "Auto Shop Manager";

  const features = useMemo(() => {
    const configured = settings?.features || {};
    return DEFAULT_FEATURES.filter((feature) => {
      const custom = configured[feature.key];
      const visible = custom?.visible ?? feature.defaultVisible;
      const roles = custom?.roles || feature.roles;
      return visible && roles.includes(role);
    });
  }, [settings, role]);

  const filteredFeatures = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return features;

    return features.filter((feature) =>
      `${feature.label} ${feature.group}`.toLowerCase().includes(term)
    );
  }, [features, search]);

  const workflowSteps = settings?.workflowSteps?.length ? settings.workflowSteps : DEFAULT_WORKFLOW_STEPS;

  const goTo = (targetTab) => {
    if (typeof setActiveTab === "function" && targetTab) {
      setActiveTab(targetTab);
    }
  };

  return (
    <div style={shellStyle}>
      <div style={topbarStyle}>
        <div>
          <div style={eyebrowStyle}>Modern Workflow</div>
          <h1 style={titleStyle}>{brandName}</h1>
        </div>

        <div style={topbarRightStyle}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools..."
            style={searchStyle}
          />
          <button type="button" onClick={loadQuickStats} style={buttonStyle}>Refresh</button>
        </div>
      </div>

      {showQuickStats && (
        <div style={statGridStyle}>
          <StatCard label="Open Jobs" value={quickStats.openJobs} />
          <StatCard label="Estimates" value={quickStats.estimates} />
          <StatCard label="Unpaid" value={quickStats.unpaid} />
          <StatCard label="Waiting Parts" value={quickStats.waitingParts} />
        </div>
      )}

      {showWorkflow && (
        <div style={workflowGridStyle}>
          {workflowSteps.map((step) => (
            <div key={step.key} style={workflowCardStyle}>
              <h3 style={{ marginTop: 0 }}>{step.title}</h3>
              <p style={{ color: "#64748b" }}>{step.description}</p>
              <button type="button" onClick={() => goTo(step.targetTab)} style={buttonStyle}>
                {step.primaryAction}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={contentLayoutStyle}>
        <aside style={toolPanelStyle}>
          <h3 style={{ marginTop: 0 }}>Tools</h3>
          {Object.entries(groupBy(filteredFeatures, "group")).map(([group, groupFeatures]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={groupLabelStyle}>{group}</div>
              {groupFeatures.map((feature) => (
                <button
                  key={feature.key}
                  type="button"
                  onClick={() => goTo(feature.label)}
                  style={{
                    ...toolButtonStyle,
                    ...(activeTab === feature.label ? activeToolStyle : {})
                  }}
                >
                  {feature.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main style={{ ...mainStyle, padding: compactMode ? 16 : 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={statCardStyle}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
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

const shellStyle = { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" };
const topbarStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "18px 22px", background: "white", borderBottom: "1px solid #e2e8f0" };
const eyebrowStyle = { color: "#2563eb", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 };
const titleStyle = { margin: 0, fontSize: 26 };
const topbarRightStyle = { display: "flex", gap: 10, alignItems: "center" };
const searchStyle = { minWidth: 280, padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 12 };
const buttonStyle = { border: "1px solid #2563eb", background: "#2563eb", color: "white", borderRadius: 12, padding: "9px 12px", cursor: "pointer" };
const statGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, padding: "16px 22px" };
const statCardStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)" };
const workflowGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, padding: "0 22px 16px" };
const workflowCardStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 };
const contentLayoutStyle = { display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, padding: "0 22px 22px" };
const toolPanelStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, height: "fit-content", position: "sticky", top: 12 };
const groupLabelStyle = { fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginBottom: 6 };
const toolButtonStyle = { display: "block", width: "100%", textAlign: "left", border: "0", background: "transparent", padding: "9px 10px", borderRadius: 10, cursor: "pointer", color: "#334155" };
const activeToolStyle = { background: "#eff6ff", color: "#1d4ed8", fontWeight: 800 };
const mainStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, minHeight: 520, overflow: "auto" };

export default ModernWorkflowShell;
