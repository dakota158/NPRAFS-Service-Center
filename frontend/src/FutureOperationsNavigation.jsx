import { useMemo, useState } from "react";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 27C: categorized Operations navigation.
// Replaces the huge flat Operations list with clean grouped sections.
// Inventory-style nested categories are used where helpful.

const OPERATION_GROUPS = [
  {
    key: "workflow",
    label: "Workflow",
    icon: "⚡",
    defaultOpen: true,
    items: [
      { label: "Jobs / Work Orders", tab: "Jobs / Work Orders" },
      { label: "Job Dispatch", tab: "Job Dispatch" },
      { label: "Priority Scoring", tab: "Priority Scoring" },
      { label: "Promise Times", tab: "Promise Times" },
      { label: "Task Board", tab: "Task Board" },
      { label: "Turnaround SLA", tab: "Turnaround SLA" }
    ]
  },
  {
    key: "front_counter",
    label: "Front Counter",
    icon: "👥",
    defaultOpen: true,
    items: [
      { label: "Appointments", tab: "Appointments" },
      { label: "Waitlist", tab: "Appointment Waitlist" },
      { label: "Customer Check-In", tab: "Customer Check-In" },
      { label: "Approvals", tab: "Customer Approvals" },
      { label: "Authorization", tab: "Authorization" },
      { label: "RO Signatures", tab: "RO Signatures" },
      { label: "Policy Ack.", tab: "Policy Acknowledgements" },
      { label: "No-Shows", tab: "No Show Tracking" }
    ]
  },
  {
    key: "communication",
    label: "Communication",
    icon: "💬",
    defaultOpen: false,
    items: [
      { label: "Communications", tab: "Communications" },
      { label: "Communication Log", tab: "Communication Log" },
      { label: "SMS Messaging", tab: "SMS Messaging" },
      { label: "Follow Ups", tab: "Follow Ups" },
      { label: "Estimate Follow-Up", tab: "Estimate Follow-Up" },
      { label: "Message Templates", tab: "Message Templates" },
      { label: "Service Reminders", tab: "Service Reminders" },
      { label: "Referrals", tab: "Customer Referrals" },
      { label: "Retention", tab: "Customer Retention" }
    ]
  },
  {
    key: "inventory_parts",
    label: "Parts Tools",
    icon: "📦",
    defaultOpen: true,
    items: [
      { label: "Purchase Planning", tab: "Purchase Planning" },
      { label: "Receiving Audit", tab: "Receiving Audit" },
      { label: "Parts Returns", tab: "Parts Returns" },
      { label: "Quote Comparison", tab: "Quote Comparison" },
      { label: "Parts Reservations", tab: "Parts Reservations" },
      { label: "Parts Locations", tab: "Parts Locations" },
      { label: "Shortage Board", tab: "Parts Shortage Board" },
      { label: "Core Ledger", tab: "Core Charge Ledger" },
      { label: "Parts Aging", tab: "Parts Aging", management: true },
      { label: "Cycle Counts", tab: "Cycle Counts", management: true },
      { label: "Inventory Value", tab: "Inventory Valuation", management: true },
      { label: "Barcode Labels", tab: "Barcode Labels" },
      { label: "Supplier Follow-Ups", tab: "Supplier Follow-Ups" },
      { label: "Vendor Scorecards", tab: "Vendor Scorecards", management: true }
    ]
  },
  {
    key: "tech_shop",
    label: "Tech + Shop Floor",
    icon: "🔧",
    defaultOpen: false,
    items: [
      { label: "Technicians", tab: "Technicians" },
      { label: "Time Clock", tab: "Time Clock" },
      { label: "Inspections", tab: "Inspections" },
      { label: "Inspection Templates", tab: "Inspection Templates" },
      { label: "Quality Control", tab: "Quality Control" },
      { label: "Comebacks", tab: "Comebacks" },
      { label: "Tech Handoffs", tab: "Tech Handoffs" },
      { label: "Tech Workload", tab: "Technician Workload", management: true },
      { label: "Tech Quality", tab: "Tech Quality Scores", management: true },
      { label: "Tech Efficiency", tab: "Technician Efficiency", management: true },
      { label: "Tech Certs", tab: "Tech Certifications" },
      { label: "Tech Templates", tab: "Tech Note Templates" },
      { label: "Bay Management", tab: "Bay Management" },
      { label: "Tool Checkout", tab: "Tool Checkout" },
      { label: "Equipment Maint.", tab: "Equipment Maintenance" },
      { label: "Training Records", tab: "Training Records" },
      { label: "Safety Incidents", tab: "Safety Incidents" }
    ]
  },
  {
    key: "money",
    label: "Money",
    icon: "💳",
    defaultOpen: false,
    items: [
      { label: "Payments", tab: "Payments" },
      { label: "Stripe Terminal", tab: "Stripe Terminal", management: true },
      { label: "Stripe Refunds", tab: "Stripe Refunds", management: true },
      { label: "Refunds/Adjustments", tab: "Refunds Adjustments", management: true },
      { label: "Payment Recon.", tab: "Payment Reconciliation", management: true },
      { label: "Customer Credit", tab: "Customer Credit", management: true },
      { label: "Customer Deposits", tab: "Customer Deposits", management: true },
      { label: "Cash Closeout", tab: "Cash Closeout", management: true },
      { label: "Expenses", tab: "Expenses" },
      { label: "Profit Reports", tab: "Profit Reports", management: true },
      { label: "Job Profitability", tab: "Job Profitability", management: true },
      { label: "Vendor Matching", tab: "Vendor Invoice Matching", management: true }
    ]
  },
  {
    key: "sales_growth",
    label: "Sales + Growth",
    icon: "📈",
    defaultOpen: false,
    items: [
      { label: "Service Packages", tab: "Service Packages" },
      { label: "Price Book", tab: "Price Book" },
      { label: "Maintenance Plans", tab: "Maintenance Plans" },
      { label: "Memberships", tab: "Membership Plans" },
      { label: "Subscriptions", tab: "Subscriptions", management: true },
      { label: "Lost Sales", tab: "Lost Sales" },
      { label: "Estimate Conversion", tab: "Estimate Conversion", management: true },
      { label: "Deferred Work", tab: "Deferred Work" },
      { label: "Warranty", tab: "Warranty" },
      { label: "Warranty Claims", tab: "Warranty Claims" },
      { label: "Warranty Alerts", tab: "Warranty Expiration" },
      { label: "Parts Warranty", tab: "Parts Warranty Returns" }
    ]
  },
  {
    key: "reports_management",
    label: "Reports + Management",
    icon: "📊",
    defaultOpen: false,
    managementGroup: true,
    items: [
      { label: "Command Center", tab: "Command Center" },
      { label: "Modern Command", tab: "Modern Command Center" },
      { label: "KPI Snapshot", tab: "KPI Snapshot" },
      { label: "KPI Goals", tab: "KPI Goals" },
      { label: "Business Review", tab: "Business Review" },
      { label: "Shop Health", tab: "Shop Health" },
      { label: "Shop Goals", tab: "Shop Goals" },
      { label: "Advisor Performance", tab: "Advisor Performance" },
      { label: "Customer Satisfaction", tab: "Customer Satisfaction" },
      { label: "Fleet Accounts", tab: "Fleet Accounts" },
      { label: "Capacity Planner", tab: "Capacity Planner" },
      { label: "Demand Forecast", tab: "Demand Forecast" },
      { label: "End Of Day", tab: "End Of Day" },
      { label: "Manager Notes", tab: "Manager Notes" },
      { label: "Analytics", tab: "Analytics" },
      { label: "Exports", tab: "Exports" },
      { label: "Audit Logs", tab: "Audit Logs" }
    ]
  },
  {
    key: "admin_tools",
    label: "Admin + Tools",
    icon: "⚙️",
    defaultOpen: false,
    items: [
      { label: "MOTOR", tab: "Motor Integration", management: true },
      { label: "VIN Helper", tab: "VIN Helper" },
      { label: "Labor Guide", tab: "Labor Guide" },
      { label: "Customer Portal", tab: "Customer Portal" },
      { label: "Document Timeline", tab: "Document Timeline" },
      { label: "Document Library", tab: "Document Library" },
      { label: "Document Control", tab: "Document Control", management: true },
      { label: "Shop Documents", tab: "Shop Documents" },
      { label: "Announcements", tab: "Announcements" },
      { label: "Notifications", tab: "Notifications" },
      { label: "Compliance", tab: "Compliance Checklist" },
      { label: "Release Notes", tab: "Release Notes" },
      { label: "Numbering Audit", tab: "Numbering Audit", management: true },
      { label: "Data Cleanup", tab: "Data Cleanup", management: true }
    ]
  }
];

function FutureOperationsNavigation({ activeTab, onSelect, canViewManagement }) {
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    OPERATION_GROUPS.forEach((group) => {
      initial[group.key] = Boolean(group.defaultOpen);
    });
    return initial;
  });

  const visibleGroups = useMemo(() => {
    return OPERATION_GROUPS
      .filter((group) => !group.managementGroup || canViewManagement)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.management || canViewManagement)
      }))
      .filter((group) => group.items.length > 0);
  }, [canViewManagement]);

  const activeGroupKey = useMemo(() => {
    const group = visibleGroups.find((candidate) =>
      candidate.items.some((item) => item.tab === activeTab)
    );
    return group?.key || "";
  }, [visibleGroups, activeTab]);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelect = (tab) => {
    if (typeof onSelect === "function") {
      onSelect(tab);
    }
  };

  return (
    <div className="future-operations-nav">
      {visibleGroups.map((group) => {
        const isOpen = openGroups[group.key] || activeGroupKey === group.key;

        return (
          <div
            key={group.key}
            className={
              activeGroupKey === group.key
                ? "future-operation-group active"
                : "future-operation-group"
            }
          >
            <button
              type="button"
              className="future-operation-header"
              onClick={() => toggleGroup(group.key)}
            >
              <span>
                <span className="future-operation-icon">{group.icon}</span>
                {group.label}
              </span>
              <span>{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
              <div className="future-operation-items">
                {group.items.map((item) => (
                  <button
                    key={`${group.key}_${item.tab}_${item.label}`}
                    type="button"
                    className={
                      activeTab === item.tab
                        ? `future-operation-item active ${item.subtab ? "subtab" : ""}`
                        : `future-operation-item ${item.subtab ? "subtab" : ""}`
                    }
                    onClick={() => handleSelect(item.tab)}
                  >
                    {item.subtab ? "↳ " : ""}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FutureOperationsNavigation;
// --- ADDED END ---
