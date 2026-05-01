import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const ROLES = ["Admin", "admin", "IT", "Manager", "Advisor", "Tech", "Parts", "User"];

const DEFAULT_SETTINGS = {
  branding: {
    appName: "Auto Shop Manager",
    accentColor: "#2563eb",
    showShopLogo: true,
    logoUrl: "",
    homeGreeting: "Good work starts with a clear workflow."
  },
  layout: {
    modernModeEnabled: false,
    compactMode: true,
    showQuickStats: true,
    showWorkflow: true,
    showSearch: true,
    hideAdvancedByDefault: true,
    showLegacySidebar: true,
    defaultStartTab: "Home"
  },
  invoiceFlow: {
    enforceEstimateToROToInvoice: true,
    requireCustomerApprovalBeforeRO: true,
    requireSignatureBeforeWork: false,
    lockAfterSignature: true,
    lockAfterPayment: true,
    autoDeductInventoryOnFinalize: true,
    showPartsNestedUnderLabor: true,
    showInternalCostToManagersOnly: true
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

const FEATURE_GROUPS = [
  {
    group: "Core",
    items: [
      ["dashboard_home", "Home"],
      ["customers", "Customers"],
      ["vehicles", "Vehicles"],
      ["history", "History"],
      ["search", "Global Search"]
    ]
  },
  {
    group: "Workflow",
    items: [
      ["estimates", "Estimates"],
      ["repair_orders", "Repair Orders"],
      ["invoices", "Invoices"],
      ["job_dispatch", "Job Dispatch"],
      ["priority_scoring", "Priority Scoring"],
      ["ro_signatures", "RO Signatures"],
      ["customer_approvals", "Customer Approvals"],
      ["deferred_work", "Deferred Work"],
      ["promise_times", "Promise Times"]
    ]
  },
  {
    group: "Inventory",
    items: [
      ["inventory", "Inventory"],
      ["parts_orders", "Parts Orders"],
      ["parts_stock", "Parts Stock"],
      ["parts_history", "Parts History"],
      ["parts_shortages", "Parts Shortage Board"],
      ["core_ledger", "Core Ledger"],
      ["parts_aging", "Parts Aging"],
      ["cycle_counts", "Cycle Counts"]
    ]
  },
  {
    group: "Money",
    items: [
      ["stripe_terminal", "Stripe Terminal"],
      ["stripe_refunds", "Stripe Refunds"],
      ["cash_closeout", "Cash Closeout"],
      ["customer_deposits", "Customer Deposits"],
      ["vendor_matching", "Vendor Invoice Matching"],
      ["job_profitability", "Job Profitability"]
    ]
  },
  {
    group: "Communication",
    items: [
      ["sms_messaging", "SMS Messaging"],
      ["communication_log", "Communication Log"],
      ["estimate_followup", "Estimate Follow-Up"],
      ["service_reminders", "Service Reminders"],
      ["customer_referrals", "Customer Referrals"],
      ["no_show_tracking", "No-Show Tracking"]
    ]
  },
  {
    group: "Management",
    items: [
      ["reports", "Reports"],
      ["kpi_snapshot", "KPI Snapshot"],
      ["shop_goals", "Shop Goals"],
      ["advisor_performance", "Advisor Performance"],
      ["tech_quality", "Tech Quality Scores"],
      ["manager_notes", "Manager Notes"]
    ]
  },
  {
    group: "Integrations",
    items: [
      ["motor_integration", "MOTOR Integration"],
      ["twilio_integration", "Twilio SMS"],
      ["stripe_integration", "Stripe"],
      ["pdf_designer", "PDF Designer"]
    ]
  }
];

function WorkflowCustomizationManager({ user, canEditEverything }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("Layout");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "modern_workflow_settings_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "{}");
      setSettings(mergeDeep(DEFAULT_SETTINGS, parsed));
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const saveSettings = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can save workflow customization.");
      return;
    }

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "modern_workflow_settings_json",
        setting_value: JSON.stringify(settings, null, 2),
        description: "Modern UI, workflow, feature visibility, labels, and customization settings",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Workflow Customization Saved",
      table_name: "app_settings",
      record_id: "modern_workflow_settings_json",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: "Modern workflow customization settings updated"
    });

    setMessage("Workflow customization saved.");
  };

  const updateNested = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value
      }
    }));
  };

  const updateFeature = (featureKey, updates) => {
    setSettings((prev) => ({
      ...prev,
      features: {
        ...(prev.features || {}),
        [featureKey]: {
          visible: true,
          roles: ROLES,
          ...((prev.features || {})[featureKey] || {}),
          ...updates
        }
      }
    }));
  };

  const toggleFeatureRole = (featureKey, role) => {
    const currentFeature = settings.features?.[featureKey] || { visible: true, roles: ROLES };
    const currentRoles = currentFeature.roles || ROLES;
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((item) => item !== role)
      : [...currentRoles, role];

    updateFeature(featureKey, { roles: nextRoles });
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setMessage("Defaults loaded. Click Save to apply them.");
  };

  const visibleCount = useMemo(() => {
    return FEATURE_GROUPS.flatMap((group) => group.items).filter(([key]) => {
      return settings.features?.[key]?.visible ?? true;
    }).length;
  }, [settings]);

  return (
    <div>
      <h2>Workflow Customization</h2>
      <p>
        Use this screen to simplify the app for employees while keeping all advanced tools available for owners/admins.
      </p>

      {message && <p style={{ color: message.includes("saved") || message.includes("Defaults") ? "green" : "red" }}>{message}</p>}

      <div style={buttonRowStyle}>
        {["Layout", "Workflow", "Labels", "Features", "Roles"].map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            style={activeSection === section ? activeButtonStyle : buttonStyle}
          >
            {section}
          </button>
        ))}
      </div>

      <div style={cardGridStyle}>
        <StatCard label="Visible Features" value={visibleCount} />
        <StatCard label="Modern Mode" value={settings.layout.modernModeEnabled ? "On" : "Off"} />
        <StatCard label="Inventory Auto-Deduct" value={settings.invoiceFlow.autoDeductInventoryOnFinalize ? "On" : "Off"} />
        <StatCard label="Invoice Locking" value={settings.invoiceFlow.lockAfterPayment || settings.invoiceFlow.lockAfterSignature ? "On" : "Off"} />
      </div>

      {activeSection === "Layout" && (
        <div style={panelStyle}>
          <h3>Modern Layout</h3>

          <div style={gridStyle}>
            <Checkbox label="Enable modern workflow mode" checked={settings.layout.modernModeEnabled} onChange={(value) => updateNested("layout", "modernModeEnabled", value)} />
            <Checkbox label="Compact mode" checked={settings.layout.compactMode} onChange={(value) => updateNested("layout", "compactMode", value)} />
            <Checkbox label="Show quick stats" checked={settings.layout.showQuickStats} onChange={(value) => updateNested("layout", "showQuickStats", value)} />
            <Checkbox label="Show workflow cards" checked={settings.layout.showWorkflow} onChange={(value) => updateNested("layout", "showWorkflow", value)} />
            <Checkbox label="Show search" checked={settings.layout.showSearch} onChange={(value) => updateNested("layout", "showSearch", value)} />
            <Checkbox label="Hide advanced tools by default" checked={settings.layout.hideAdvancedByDefault} onChange={(value) => updateNested("layout", "hideAdvancedByDefault", value)} />
            <Checkbox label="Show legacy sidebar" checked={settings.layout.showLegacySidebar} onChange={(value) => updateNested("layout", "showLegacySidebar", value)} />
          </div>

          <div style={gridStyle}>
            <label>
              App Name
              <input value={settings.branding.appName} onChange={(e) => updateNested("branding", "appName", e.target.value)} style={inputStyle} />
            </label>

            <label>
              Accent Color
              <input type="color" value={settings.branding.accentColor} onChange={(e) => updateNested("branding", "accentColor", e.target.value)} style={inputStyle} />
            </label>

            <label>
              Logo URL
              <input value={settings.branding.logoUrl} onChange={(e) => updateNested("branding", "logoUrl", e.target.value)} style={inputStyle} />
            </label>

            <label>
              Default Start Tab
              <input value={settings.layout.defaultStartTab} onChange={(e) => updateNested("layout", "defaultStartTab", e.target.value)} style={inputStyle} />
            </label>
          </div>

          <label>
            Home Greeting
            <textarea value={settings.branding.homeGreeting} onChange={(e) => updateNested("branding", "homeGreeting", e.target.value)} style={textareaStyle} />
          </label>
        </div>
      )}

      {activeSection === "Workflow" && (
        <div style={panelStyle}>
          <h3>Estimate → RO → Invoice Flow</h3>

          <div style={gridStyle}>
            <Checkbox label="Force Estimate → RO → Invoice flow" checked={settings.invoiceFlow.enforceEstimateToROToInvoice} onChange={(value) => updateNested("invoiceFlow", "enforceEstimateToROToInvoice", value)} />
            <Checkbox label="Require customer approval before RO" checked={settings.invoiceFlow.requireCustomerApprovalBeforeRO} onChange={(value) => updateNested("invoiceFlow", "requireCustomerApprovalBeforeRO", value)} />
            <Checkbox label="Require signature before work" checked={settings.invoiceFlow.requireSignatureBeforeWork} onChange={(value) => updateNested("invoiceFlow", "requireSignatureBeforeWork", value)} />
            <Checkbox label="Lock after signature" checked={settings.invoiceFlow.lockAfterSignature} onChange={(value) => updateNested("invoiceFlow", "lockAfterSignature", value)} />
            <Checkbox label="Lock after payment" checked={settings.invoiceFlow.lockAfterPayment} onChange={(value) => updateNested("invoiceFlow", "lockAfterPayment", value)} />
            <Checkbox label="Auto-deduct inventory on finalize" checked={settings.invoiceFlow.autoDeductInventoryOnFinalize} onChange={(value) => updateNested("invoiceFlow", "autoDeductInventoryOnFinalize", value)} />
            <Checkbox label="Show parts nested under labor" checked={settings.invoiceFlow.showPartsNestedUnderLabor} onChange={(value) => updateNested("invoiceFlow", "showPartsNestedUnderLabor", value)} />
            <Checkbox label="Show internal costs to managers only" checked={settings.invoiceFlow.showInternalCostToManagersOnly} onChange={(value) => updateNested("invoiceFlow", "showInternalCostToManagersOnly", value)} />
          </div>
        </div>
      )}

      {activeSection === "Labels" && (
        <div style={panelStyle}>
          <h3>Custom Labels</h3>
          <p>Rename common terms to match how your shop talks.</p>

          <div style={gridStyle}>
            {Object.entries(settings.fieldLabels).map(([key, value]) => (
              <label key={key}>
                {toTitle(key)}
                <input value={value} onChange={(e) => updateNested("fieldLabels", key, e.target.value)} style={inputStyle} />
              </label>
            ))}
          </div>
        </div>
      )}

      {activeSection === "Features" && (
        <div style={panelStyle}>
          <h3>Feature Visibility</h3>
          <p>Hide anything your shop does not use yet. Admin/IT can bring it back later.</p>

          {FEATURE_GROUPS.map((group) => (
            <div key={group.group} style={featureGroupStyle}>
              <h4>{group.group}</h4>
              <div style={featureGridStyle}>
                {group.items.map(([key, label]) => {
                  const feature = settings.features?.[key] || { visible: true, roles: ROLES };
                  return (
                    <label key={key} style={featureToggleStyle}>
                      <input
                        type="checkbox"
                        checked={feature.visible ?? true}
                        onChange={(e) => updateFeature(key, { visible: e.target.checked })}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === "Roles" && (
        <div style={panelStyle}>
          <h3>Role Access</h3>
          <p>Select which roles can see each feature.</p>

          {FEATURE_GROUPS.map((group) => (
            <div key={group.group} style={featureGroupStyle}>
              <h4>{group.group}</h4>
              {group.items.map(([key, label]) => {
                const feature = settings.features?.[key] || { visible: true, roles: ROLES };
                const roles = feature.roles || ROLES;

                return (
                  <div key={key} style={roleRowStyle}>
                    <strong style={{ minWidth: 190 }}>{label}</strong>
                    <div style={roleCheckboxGridStyle}>
                      {ROLES.map((role) => (
                        <label key={role}>
                          <input
                            type="checkbox"
                            checked={roles.includes(role)}
                            onChange={() => toggleFeatureRole(key, role)}
                          />
                          {role}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div style={stickyActionsStyle}>
        <button type="button" onClick={saveSettings} disabled={!canEditEverything} style={primaryButtonStyle}>
          Save Customization
        </button>
        <button type="button" onClick={loadSettings} style={buttonStyle}>Reload</button>
        <button type="button" onClick={resetDefaults} style={dangerButtonStyle}>Reset Defaults</button>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={checkboxStyle}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={statCardStyle}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function mergeDeep(target, source) {
  const output = { ...target };
  Object.keys(source || {}).forEach((key) => {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      output[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
}

function toTitle(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

const buttonRowStyle = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 };
const buttonStyle = { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 10, padding: "9px 12px", cursor: "pointer" };
const activeButtonStyle = { ...buttonStyle, background: "#2563eb", borderColor: "#2563eb", color: "white" };
const primaryButtonStyle = { ...activeButtonStyle, fontWeight: 800 };
const dangerButtonStyle = { ...buttonStyle, borderColor: "#ef4444", color: "#b91c1c" };
const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 };
const statCardStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 16, marginBottom: 18 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 12 };
const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 80 };
const checkboxStyle = { display: "flex", gap: 8, alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 };
const featureGroupStyle = { borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 12 };
const featureGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 };
const featureToggleStyle = { display: "flex", gap: 8, alignItems: "center", padding: 8, border: "1px solid #e2e8f0", borderRadius: 10 };
const roleRowStyle = { display: "grid", gridTemplateColumns: "190px 1fr", gap: 12, alignItems: "start", borderBottom: "1px solid #f1f5f9", padding: "10px 0" };
const roleCheckboxGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: 8 };
const stickyActionsStyle = { display: "flex", gap: 10, position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #e5e7eb", padding: 12 };

export default WorkflowCustomizationManager;
