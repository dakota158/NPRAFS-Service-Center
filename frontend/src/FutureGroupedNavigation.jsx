import { useMemo, useState } from "react";
import "./futureShopLayout.css";

// --- ADDED START ---
// Phase 27B: grouped navigation helper.
// This is a reusable component for replacing long flat tab lists with rounded groups.

const DEFAULT_GROUPS = [
  {
    key: "front_counter",
    label: "Front Counter",
    items: [
      { label: "Customers", tab: "Customers" },
      { label: "Vehicles", tab: "Vehicles" },
      { label: "Estimates", tab: "Invoice Manager" },
      { label: "Approvals", tab: "Customer Approvals" },
      { label: "SMS", tab: "SMS Messaging" }
    ]
  },
  {
    key: "workflow",
    label: "Workflow",
    items: [
      { label: "Repair Orders", tab: "Invoice Manager" },
      { label: "Job Dispatch", tab: "Job Dispatch" },
      { label: "Priority", tab: "Priority Scoring" },
      { label: "RO Signatures", tab: "RO Signatures" },
      { label: "Deferred Work", tab: "Deferred Work" }
    ]
  },
  {
    key: "inventory",
    label: "Inventory",
    items: [
      { label: "Orders", tab: "Parts Orders", subtab: true },
      { label: "Stock", tab: "Parts Stock", subtab: true },
      { label: "History", tab: "Parts History", subtab: true },
      { label: "Shortages", tab: "Parts Shortage Board" },
      { label: "Core Ledger", tab: "Core Charge Ledger" },
      { label: "Parts Aging", tab: "Parts Aging" }
    ]
  },
  {
    key: "money",
    label: "Money",
    items: [
      { label: "Payments", tab: "Stripe Terminal" },
      { label: "Refunds", tab: "Stripe Refunds" },
      { label: "Cash Closeout", tab: "Cash Closeout" },
      { label: "Deposits", tab: "Customer Deposits" },
      { label: "Vendor Matching", tab: "Vendor Invoice Matching" }
    ]
  },
  {
    key: "shop_floor",
    label: "Shop Floor",
    items: [
      { label: "Tech Workload", tab: "Technician Workload" },
      { label: "Tech Quality", tab: "Tech Quality Scores" },
      { label: "Tech Handoffs", tab: "Tech Handoffs" },
      { label: "Inspections", tab: "Inspection Templates" },
      { label: "Equipment", tab: "Equipment Maintenance" }
    ]
  },
  {
    key: "reports",
    label: "Reports",
    items: [
      { label: "KPI Snapshot", tab: "KPI Snapshot" },
      { label: "Job Profitability", tab: "Job Profitability" },
      { label: "Advisor Performance", tab: "Advisor Performance" },
      { label: "Shop Goals", tab: "Shop Goals" },
      { label: "Manager Notes", tab: "Manager Notes" }
    ]
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { label: "Settings", tab: "Settings" },
      { label: "Workflow Settings", tab: "Workflow Customization" },
      { label: "Future Layout", tab: "Future Layout" },
      { label: "PDF Designer", tab: "PDF Layout Designer" },
      { label: "MOTOR", tab: "Motor Integration" }
    ]
  }
];

function FutureGroupedNavigation({ activeTab, onSelect, groups = DEFAULT_GROUPS }) {
  const [openGroups, setOpenGroups] = useState({
    front_counter: true,
    workflow: true,
    inventory: true,
    money: false,
    shop_floor: false,
    reports: false,
    settings: false
  });

  const activeGroupKeys = useMemo(() => {
    return groups
      .filter((group) => group.items.some((item) => item.tab === activeTab || item.label === activeTab))
      .map((group) => group.key);
  }, [groups, activeTab]);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectTab = (tab) => {
    if (typeof onSelect === "function") {
      onSelect(tab);
    }
  };

  return (
    <div className="future-tab-shell">
      {groups.map((group) => {
        const isOpen = openGroups[group.key] || activeGroupKeys.includes(group.key);

        return (
          <div key={group.key} className="future-tab-group">
            <button
              type="button"
              className="future-tab-group-header"
              onClick={() => toggleGroup(group.key)}
            >
              <span>{group.label}</span>
              <span>{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
              <div className="future-tab-group-body">
                {group.items.map((item) => {
                  const active = activeTab === item.tab || activeTab === item.label;

                  return (
                    <button
                      key={`${group.key}_${item.label}`}
                      type="button"
                      className={`future-tab-item nav-button ${item.subtab ? "subtab" : ""} ${active ? "active" : ""}`}
                      onClick={() => selectTab(item.tab)}
                    >
                      {item.subtab ? "↳ " : ""}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FutureGroupedNavigation;
// --- ADDED END ---
