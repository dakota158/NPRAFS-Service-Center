import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DashboardHome from "./DashboardHome";
import OrdersManager from "./OrdersManager";
import PartsManager from "./PartsManager";
import HistoryManager from "./HistoryManager";
import UserManagement from "./UserManagement";
import CompanyInfo from "./CompanyInfo";
import SuppliersManager from "./SuppliersManager";
import SettingsManager from "./SettingsManager";
import InvoiceManager from "./InvoiceManager";
// --- ADDED START ---
import JobTrackingManager from "./JobTrackingManager";
import CustomersManager from "./CustomersManager";
import VehiclesManager from "./VehiclesManager";
import AnalyticsManager from "./AnalyticsManager";
import TechnicianManager from "./TechnicianManager";
import CommunicationsManager from "./CommunicationsManager";
import ApprovalsManager from "./ApprovalsManager";
import PaymentsManager from "./PaymentsManager";
import LowStockManager from "./LowStockManager";
import ServicePackagesManager from "./ServicePackagesManager";
import AuditSecurityManager from "./AuditSecurityManager";
import ExportManager from "./ExportManager";
import ServiceRemindersManager from "./ServiceRemindersManager";
import AuthorizationManager from "./AuthorizationManager";
import AppointmentsManager from "./AppointmentsManager";
import TimeClockManager from "./TimeClockManager";
import InspectionManager from "./InspectionManager";
import FollowUpsManager from "./FollowUpsManager";
import CommandCenterManager from "./CommandCenterManager";
import TaskBoardManager from "./TaskBoardManager";
import WarrantyManager from "./WarrantyManager";
import MessageTemplatesManager from "./MessageTemplatesManager";
import ShopDocumentsManager from "./ShopDocumentsManager";
import ExpenseManager from "./ExpenseManager";
import ProfitReportsManager from "./ProfitReportsManager";
import PurchasePlanningManager from "./PurchasePlanningManager";
import VinHelperManager from "./VinHelperManager";
import BarcodeLabelManager from "./BarcodeLabelManager";
import PermissionsMatrixManager from "./PermissionsMatrixManager";
import GoalsKpiManager from "./GoalsKpiManager";
import DataBackupManager from "./DataBackupManager";
import NotificationCenterManager from "./NotificationCenterManager";
import ReleaseNotesManager from "./ReleaseNotesManager";
import PriceBookManager from "./PriceBookManager";
import CustomerPortalManager from "./CustomerPortalManager";
import DocumentTimelineManager from "./DocumentTimelineManager";
import LaborGuideManager from "./LaborGuideManager";
import ShopHealthManager from "./ShopHealthManager";
import CustomerCheckInManager from "./CustomerCheckInManager";
import ComebackManager from "./ComebackManager";
import QualityControlManager from "./QualityControlManager";
import DeferredWorkManager from "./DeferredWorkManager";
import EndOfDayManager from "./EndOfDayManager";
import FleetAccountsManager from "./FleetAccountsManager";
import ReceivingAuditManager from "./ReceivingAuditManager";
import TechnicianEfficiencyManager from "./TechnicianEfficiencyManager";
import CustomerSatisfactionManager from "./CustomerSatisfactionManager";
import DataCleanupManager from "./DataCleanupManager";
import BayManager from "./BayManager";
import ToolCheckoutManager from "./ToolCheckoutManager";
import PartsReturnsManager from "./PartsReturnsManager";
import QuoteComparisonManager from "./QuoteComparisonManager";
import SafetyIncidentManager from "./SafetyIncidentManager";
import MaintenancePlansManager from "./MaintenancePlansManager";
import DemandForecastManager from "./DemandForecastManager";
import DocumentControlManager from "./DocumentControlManager";
import TrainingRecordsManager from "./TrainingRecordsManager";
import AnnouncementBoardManager from "./AnnouncementBoardManager";
import CustomerCreditManager from "./CustomerCreditManager";
import PaymentReconciliationManager from "./PaymentReconciliationManager";
import InventoryValuationManager from "./InventoryValuationManager";
import TurnaroundSlaManager from "./TurnaroundSlaManager";
import ComplianceChecklistManager from "./ComplianceChecklistManager";
import SubscriptionExpenseManager from "./SubscriptionExpenseManager";
import VendorScorecardManager from "./VendorScorecardManager";
import NumberingAuditManager from "./NumberingAuditManager";
import CustomerRetentionManager from "./CustomerRetentionManager";
import CapacityPlannerManager from "./CapacityPlannerManager";
import MembershipPlansManager from "./MembershipPlansManager";
import EstimateConversionManager from "./EstimateConversionManager";
import LostSalesManager from "./LostSalesManager";
import PartsReservationManager from "./PartsReservationManager";
import BusinessReviewManager from "./BusinessReviewManager";
import TechnicianCertificationManager from "./TechnicianCertificationManager";
import PartsLocationManager from "./PartsLocationManager";
import RefundAdjustmentManager from "./RefundAdjustmentManager";
import CommunicationLogManager from "./CommunicationLogManager";
import AppointmentWaitlistManager from "./AppointmentWaitlistManager";
import WarrantyClaimWorkflowManager from "./WarrantyClaimWorkflowManager";
import CycleCountManager from "./CycleCountManager";
import TechnicianNoteTemplatesManager from "./TechnicianNoteTemplatesManager";
import InspectionTemplateManager from "./InspectionTemplateManager";
import JobDispatchBoardManager from "./JobDispatchBoardManager";
import PromiseTimeManager from "./PromiseTimeManager";
import SupplierFollowUpManager from "./SupplierFollowUpManager";
import TechnicianWorkloadManager from "./TechnicianWorkloadManager";
import ShopDocumentLibraryManager from "./ShopDocumentLibraryManager";
import PriorityScoringManager from "./PriorityScoringManager";
import CustomerApprovalManager from "./CustomerApprovalManager";
import PartsShortageBoardManager from "./PartsShortageBoardManager";
import TechnicianHandoffManager from "./TechnicianHandoffManager";
import WarrantyExpirationAlertManager from "./WarrantyExpirationAlertManager";
import JobProfitabilityManager from "./JobProfitabilityManager";
import NoShowTrackingManager from "./NoShowTrackingManager";
import EquipmentMaintenanceManager from "./EquipmentMaintenanceManager";
import PartsWarrantyReturnManager from "./PartsWarrantyReturnManager";
import DailyManagerNotesManager from "./DailyManagerNotesManager";
import CashDrawerCloseoutManager from "./CashDrawerCloseoutManager";
import TechnicianQualityScoreManager from "./TechnicianQualityScoreManager";
import VehicleTimelineManager from "./VehicleTimelineManager";
import PartsAgingReportManager from "./PartsAgingReportManager";
import ShopGoalTrackingManager from "./ShopGoalTrackingManager";
import CustomerDepositManager from "./CustomerDepositManager";
import SubletWorkManager from "./SubletWorkManager";
import EstimateFollowUpPipelineManager from "./EstimateFollowUpPipelineManager";
import CoreChargeLedgerManager from "./CoreChargeLedgerManager";
import ShopKpiSnapshotManager from "./ShopKpiSnapshotManager";
import VendorInvoiceMatchingManager from "./VendorInvoiceMatchingManager";
import AdvisorPerformanceManager from "./AdvisorPerformanceManager";
import CustomerReferralManager from "./CustomerReferralManager";
import PolicyAcknowledgementManager from "./PolicyAcknowledgementManager";
import StripeTerminalManager from "./StripeTerminalManager";
import RepairOrderSignatureManager from "./RepairOrderSignatureManager";
import MotorIntegrationManager from "./MotorIntegrationManager";
import StripeRefundManager from "./StripeRefundManager";
import SmsMessagingManager from "./SmsMessagingManager";
import WorkflowCustomizationManager from "./WorkflowCustomizationManager";
import ModernWorkflowShellSafe from "./ModernWorkflowShellSafe";
import FutureLayoutSettingsManager from "./FutureLayoutSettingsManager";
import FutureGroupedNavigation from "./FutureGroupedNavigation";
import FutureOperationsNavigation from "./FutureOperationsNavigation";
import CollapsibleSectionsSettingsManager from "./CollapsibleSectionsSettingsManager";
import RolePermissionManager from "./RolePermissionManager";
import RolePermissionGate from "./RolePermissionGate";
import SettingsHubManager from "./SettingsHubManager";
import StripeSettingsManager from "./StripeSettingsManager";
import AutoCollapsePageSections from "./AutoCollapsePageSections";
// --- ADDED END ---
import "./App.css";
import "./futureShopLayout.css";

function Dashboard({ user, onLogout }) {
  // --- ADDED START ---
  // Phase 26C: safe modern workflow toggle.
  // Defaults OFF so login/startup stays safe. If the setting fails to load, legacy UI remains active.
  const [phase26cModernModeEnabled, setPhase26cModernModeEnabled] = useState(false);
  const [phase26cModernSettings, setPhase26cModernSettings] = useState(null);

  useEffect(() => {
    async function loadPhase26cModernMode() {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("*")
          .eq("setting_key", "modern_workflow_settings_json")
          .maybeSingle();

        const parsed = data?.setting_value ? JSON.parse(data.setting_value) : {};
        setPhase26cModernSettings(parsed);
        setPhase26cModernModeEnabled(Boolean(parsed?.layout?.modernModeEnabled));
      } catch (error) {
        setPhase26cModernModeEnabled(false);
      }
    }

    loadPhase26cModernMode();

    window.addEventListener("focus", loadPhase26cModernMode);
    return () => window.removeEventListener("focus", loadPhase26cModernMode);
  }, []);
  // --- ADDED END ---

  const role = user?.role || "Tech";

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- ADDED START ---
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  // --- ADDED END ---

  const [companyInfo, setCompanyInfo] = useState({
    name: "NPRAFS Service Center",
    logo_url: ""
  });

  const fallbackLogoPath = `${process.env.PUBLIC_URL}/favicon.ico`;

  const canViewAdminTabs =
    role === "IT" || role === "admin" || role === "Admin" || role === "Manager";

  const canEditEverything =
    role === "IT" || role === "admin" || role === "Admin";

  const canViewSettings =
    role === "IT" || role === "admin" || role === "Admin";

  // --- ADDED START ---
  const canViewManagement =
    role === "Manager" || role === "IT" || role === "admin" || role === "Admin";
  // --- ADDED END ---

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    const { data, error } = await supabase
      .from("company_info")
      .select("name, logo_url")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Company info load error:", error);
      return;
    }

    setCompanyInfo({
      name: data?.name || "NPRAFS Service Center",
      logo_url: data?.logo_url || fallbackLogoPath
    });
  };

  const logoToUse = companyInfo.logo_url || fallbackLogoPath;

  const selectInventoryTab = (tab) => {
    setActiveTab(tab);
    setInventoryOpen(true);
  };

  const selectSettingsTab = (tab) => {
    setActiveTab(tab);
    setSettingsOpen(true);
  };

  // --- ADDED START ---
  const selectOperationsTab = (tab) => {
    setActiveTab(tab);
    setOperationsOpen(true);
  };

  const selectCustomersTab = (tab) => {
    setActiveTab(tab);
    setCustomersOpen(true);
  };
  // --- ADDED END ---

  const isSettingsTab =
    activeTab === "Settings General" ||
    activeTab === "Settings Invoice" ||
    activeTab === "Settings PDF" ||
    activeTab === "Settings Features" ||
    activeTab === "Settings Labor" ||
    activeTab === "Settings Markup" ||
    activeTab === "Settings Tax" ||
    activeTab === "Settings Shop Fees" ||
    activeTab === "Settings Permissions" ||
    activeTab === "Settings Audit" ||
    activeTab === "Permissions Matrix" ||
    activeTab === "Data Backup" ||
    activeTab === "Workflow Customization";

  // --- ADDED START ---
  const isOperationsTab =
    activeTab === "Jobs / Work Orders" ||
    activeTab === "Technicians" ||
    activeTab === "Approvals" ||
    activeTab === "Communications" ||
    activeTab === "Payments" ||
    activeTab === "Service Packages" ||
    activeTab === "Authorization" ||
    activeTab === "Appointments" ||
    activeTab === "Time Clock" ||
    activeTab === "Inspections" ||
    activeTab === "Follow Ups" ||
    activeTab === "Task Board" ||
    activeTab === "Warranty" ||
    activeTab === "Message Templates" ||
    activeTab === "Shop Documents" ||
    activeTab === "Command Center" ||
    activeTab === "Expenses" ||
    activeTab === "Profit Reports" ||
    activeTab === "Purchase Planning" ||
    activeTab === "VIN Helper" ||
    activeTab === "Barcode Labels" ||
    activeTab === "Notifications" ||
    activeTab === "KPI Goals" ||
    activeTab === "Release Notes" ||
    activeTab === "Price Book" ||
    activeTab === "Customer Portal" ||
    activeTab === "Document Timeline" ||
    activeTab === "Labor Guide" ||
    activeTab === "Shop Health" ||
    activeTab === "Customer Check-In" ||
    activeTab === "Comebacks" ||
    activeTab === "Quality Control" ||
    activeTab === "Deferred Work" ||
    activeTab === "End Of Day" ||
    activeTab === "Fleet Accounts" ||
    activeTab === "Receiving Audit" ||
    activeTab === "Technician Efficiency" ||
    activeTab === "Customer Satisfaction" ||
    activeTab === "Data Cleanup" ||
    activeTab === "Bay Management" ||
    activeTab === "Tool Checkout" ||
    activeTab === "Parts Returns" ||
    activeTab === "Quote Comparison" ||
    activeTab === "Safety Incidents" ||
    activeTab === "Maintenance Plans" ||
    activeTab === "Demand Forecast" ||
    activeTab === "Document Control" ||
    activeTab === "Training Records" ||
    activeTab === "Announcements" ||
    activeTab === "Customer Credit" ||
    activeTab === "Payment Reconciliation" ||
    activeTab === "Inventory Valuation" ||
    activeTab === "Turnaround SLA" ||
    activeTab === "Compliance Checklist" ||
    activeTab === "Subscriptions" ||
    activeTab === "Vendor Scorecards" ||
    activeTab === "Numbering Audit" ||
    activeTab === "Customer Retention" ||
    activeTab === "Capacity Planner" ||
    activeTab === "Membership Plans" ||
    activeTab === "Estimate Conversion" ||
    activeTab === "Lost Sales" ||
    activeTab === "Parts Reservations" ||
    activeTab === "Business Review" ||
    activeTab === "Tech Certifications" ||
    activeTab === "Parts Locations" ||
    activeTab === "Refunds Adjustments" ||
    activeTab === "Communication Log" ||
    activeTab === "Appointment Waitlist" ||
    activeTab === "Warranty Claims" ||
    activeTab === "Cycle Counts" ||
    activeTab === "Tech Note Templates" ||
    activeTab === "Inspection Templates" ||
    activeTab === "Job Dispatch" ||
    activeTab === "Promise Times" ||
    activeTab === "Supplier Follow-Ups" ||
    activeTab === "Technician Workload" ||
    activeTab === "Document Library" ||
    activeTab === "Priority Scoring" ||
    activeTab === "Customer Approvals" ||
    activeTab === "Parts Shortage Board" ||
    activeTab === "Tech Handoffs" ||
    activeTab === "Warranty Expiration" ||
    activeTab === "Job Profitability" ||
    activeTab === "No Show Tracking" ||
    activeTab === "Equipment Maintenance" ||
    activeTab === "Parts Warranty Returns" ||
    activeTab === "Manager Notes" ||
    activeTab === "Cash Closeout" ||
    activeTab === "Tech Quality Scores" ||
    activeTab === "Vehicle Timeline" ||
    activeTab === "Parts Aging" ||
    activeTab === "Shop Goals" ||
    activeTab === "Customer Deposits" ||
    activeTab === "Sublet Work" ||
    activeTab === "Estimate Follow-Up" ||
    activeTab === "Core Charge Ledger" ||
    activeTab === "KPI Snapshot" ||
    activeTab === "Vendor Invoice Matching" ||
    activeTab === "Advisor Performance" ||
    activeTab === "Customer Referrals" ||
    activeTab === "Policy Acknowledgements" ||
    activeTab === "Stripe Terminal" ||
    activeTab === "RO Signatures" ||
    activeTab === "Motor Integration" ||
    activeTab === "Stripe Refunds" ||
    activeTab === "SMS Messaging" ||
    activeTab === "Modern Command Center" ||
    activeTab === "Service Reminders" ||
    activeTab === "Exports" ||
    activeTab === "Audit Logs" ||
    activeTab === "Analytics";

  const isCustomersTab =
    activeTab === "Customers" || activeTab === "Vehicles";
  // --- ADDED END ---

  const pageTitle =
    activeTab === "Inventory Orders"
      ? "Inventory - Orders"
      : activeTab === "Inventory Stock"
      ? "Inventory - Stock"
      : activeTab === "Inventory Low Stock"
      ? "Inventory - Low Stock"
      : activeTab === "Inventory History"
      ? "Inventory - History"
      : activeTab === "Settings General"
      ? "Settings - General"
      : activeTab === "Settings Invoice"
      ? "Settings - Invoice"
      : activeTab === "Settings PDF"
      ? "Settings - PDF Layout"
      : activeTab === "Settings Features"
      ? "Settings - Feature Toggles"
      : activeTab === "Settings Labor"
      ? "Settings - Labor Rates"
      : activeTab === "Settings Markup"
      ? "Settings - Parts Markup"
      : activeTab === "Settings Tax"
      ? "Settings - Taxes"
      : activeTab === "Settings Shop Fees"
      ? "Settings - Shop Fees"
      : activeTab === "Settings Permissions"
      ? "Settings - Permissions"
      : activeTab === "Settings Audit"
      ? "Settings - Audit / Security"
      : activeTab === "Permissions Matrix"
      ? "Settings - Permissions Matrix"
      : activeTab === "Data Backup"
      ? "Settings - Data Backup"
      : activeTab;

  return (
    <div className="app-shell">
      <div
        className="app-background-logo"
        style={{
          backgroundImage: `url('${logoToUse}')`
        }}
      />

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo-row">
            {logoToUse && (
              <img src={logoToUse} alt="Company Logo" className="sidebar-logo" />
            )}

            <div>
              <h1 className="sidebar-title">
                {companyInfo.name || "NPRAFS Service Center"}
              </h1>
              <p className="sidebar-subtitle">Inventory System</p>
            </div>
          </div>

          <nav>
            <button
              type="button"
              onClick={() => setActiveTab("Dashboard")}
              className={activeTab === "Dashboard" ? "nav-button active" : "nav-button"}
            >
              Dashboard
            </button>

            {/* --- ADDED START --- */}
            <button
              type="button"
              onClick={() => {
                setOperationsOpen((prev) => !prev);

                if (!isOperationsTab) {
                  setActiveTab("Jobs / Work Orders");
                }
              }}
              className={isOperationsTab ? "nav-button active" : "nav-button"}
            >
              Operations {operationsOpen ? "▾" : "▸"}
            </button>

            {operationsOpen && (
              <FutureOperationsNavigation
                activeTab={activeTab}
                onSelect={selectOperationsTab}
                canViewManagement={canViewManagement}
              />
            )}

            <button
              type="button"
              onClick={() => {
                setCustomersOpen((prev) => !prev);

                if (!isCustomersTab) {
                  setActiveTab("Customers");
                }
              }}
              className={isCustomersTab ? "nav-button active" : "nav-button"}
            >
              Customers {customersOpen ? "▾" : "▸"}
            </button>

            {customersOpen && (
              <div style={{ marginLeft: 14, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => selectCustomersTab("Customers")}
                  className={
                    activeTab === "Customers" ? "nav-button active" : "nav-button"
                  }
                  style={{ fontSize: 14, padding: "9px 12px" }}
                >
                  Customers
                </button>

                <button
                  type="button"
                  onClick={() => selectCustomersTab("Vehicles")}
                  className={
                    activeTab === "Vehicles" ? "nav-button active" : "nav-button"
                  }
                  style={{ fontSize: 14, padding: "9px 12px" }}
                >
                  Vehicles
                </button>
              </div>
            )}
            {/* --- ADDED END --- */}

            <button
              type="button"
              onClick={() => {
                setInventoryOpen((prev) => !prev);

                if (
                  activeTab !== "Inventory Orders" &&
                  activeTab !== "Inventory Stock" &&
                  activeTab !== "Inventory History"
                ) {
                  setActiveTab("Inventory Orders");
                }
              }}
              className={
                activeTab === "Inventory Orders" ||
                activeTab === "Inventory Stock" ||
                activeTab === "Inventory Low Stock" ||
                activeTab === "Inventory History"
                  ? "nav-button active"
                  : "nav-button"
              }
            >
              Inventory {inventoryOpen ? "▾" : "▸"}
            </button>

            {inventoryOpen && (
              <div style={{ marginLeft: 14, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => selectInventoryTab("Inventory Orders")}
                  className={
                    activeTab === "Inventory Orders"
                      ? "nav-button active"
                      : "nav-button"
                  }
                  style={{ fontSize: 14, padding: "9px 12px" }}
                >
                  Orders
                </button>

                <button
                  type="button"
                  onClick={() => selectInventoryTab("Inventory Stock")}
                  className={
                    activeTab === "Inventory Stock"
                      ? "nav-button active"
                      : "nav-button"
                  }
                  style={{ fontSize: 14, padding: "9px 12px" }}
                >
                  Stock
                </button>

                <button
                  type="button"
                  onClick={() => selectInventoryTab("Inventory Low Stock")}
                  className={
                    activeTab === "Inventory Low Stock"
                      ? "nav-button active"
                      : "nav-button"
                  }
                  style={{ fontSize: 14, padding: "9px 12px" }}
                >
                  Low Stock
                </button>

                <button
                  type="button"
                  onClick={() => selectInventoryTab("Inventory History")}
                  className={
                    activeTab === "Inventory History"
                      ? "nav-button active"
                      : "nav-button"
                  }
                  style={{ fontSize: 14, padding: "9px 12px" }}
                >
                  History
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("Invoices")}
              className={activeTab === "Invoices" ? "nav-button active" : "nav-button"}
            >
              Invoices
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("Suppliers")}
              className={activeTab === "Suppliers" ? "nav-button active" : "nav-button"}
            >
              Suppliers
            </button>

            {canViewSettings && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen((prev) => !prev);

                    if (!isSettingsTab) {
                      setActiveTab("Settings General");
                    }
                  }}
                  className={isSettingsTab ? "nav-button active" : "nav-button"}
                >
                  Settings {settingsOpen ? "▾" : "▸"}
                </button>

                {settingsOpen && (
                  <div style={{ marginLeft: 14, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings General")}
                      className={
                        activeTab === "Settings General"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      General
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Invoice")}
                      className={
                        activeTab === "Settings Invoice"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Invoice
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings PDF")}
                      className={
                        activeTab === "Settings PDF"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      PDF Layout
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Features")}
                      className={
                        activeTab === "Settings Features"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Feature Toggles
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Labor")}
                      className={
                        activeTab === "Settings Labor"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Labor Rates
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Markup")}
                      className={
                        activeTab === "Settings Markup"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Parts Markup
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Tax")}
                      className={
                        activeTab === "Settings Tax"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Taxes
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Shop Fees")}
                      className={
                        activeTab === "Settings Shop Fees"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Shop Fees
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Permissions")}
                      className={
                        activeTab === "Settings Permissions"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Permissions
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Hub")}
                      className={
                        activeTab === "Settings Hub"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Settings Hub
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Stripe Settings")}
                      className={
                        activeTab === "Stripe Settings"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Stripe Settings
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Role Permissions")}
                      className={
                        activeTab === "Role Permissions"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Role Permissions
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Settings Audit")}
                      className={
                        activeTab === "Settings Audit"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Audit / Security
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Permissions Matrix")}
                      className={
                        activeTab === "Permissions Matrix"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Permissions Matrix
                    </button>

                    <button
                      type="button"
                      onClick={() => selectSettingsTab("Data Backup")}
                      className={
                        activeTab === "Data Backup"
                          ? "nav-button active"
                          : "nav-button"
                      }
                      style={{ fontSize: 14, padding: "9px 12px" }}
                    >
                      Data Backup
                    </button>
                  </div>
                )}
              </>
            )}

            {canViewAdminTabs && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("User Management")}
                  className={
                    activeTab === "User Management"
                      ? "nav-button active"
                      : "nav-button"
                  }
                >
                  User Management
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("Profile")}
                  className={activeTab === "Profile" ? "nav-button active" : "nav-button"}
                >
                  Profile
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("Company Info")}
                  className={
                    activeTab === "Company Info" ? "nav-button active" : "nav-button"
                  }
                >
                  Company Info
                </button>
              </>
            )}
          </nav>
        </aside>

        <main className="main-content">
          <div className="top-bar">
            <div>
              <h2 className="page-title">{pageTitle}</h2>
              <p className="welcome-text">
                Welcome, {user?.username || user?.email || "User"} ({role})
              </p>
            </div>

            <button type="button" onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>

          <div className="content-card">
            <RolePermissionGate user={user} activeTab={activeTab} canEditEverything={canEditEverything} />
            <AutoCollapsePageSections activeTab={activeTab} />
            <>
            {activeTab === "Dashboard" && <DashboardHome user={user} />}

            {/* --- ADDED START --- */}
            {activeTab === "Jobs / Work Orders" && (
              <JobTrackingManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Customers" && (
              <CustomersManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Vehicles" && (
              <VehiclesManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Technicians" && (
              <TechnicianManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Approvals" && (
              <ApprovalsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Communications" && (
              <CommunicationsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Payments" && (
              <PaymentsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Service Packages" && (
              <ServicePackagesManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Authorization" && (
              <AuthorizationManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Appointments" && (
              <AppointmentsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Time Clock" && (
              <TimeClockManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inspections" && (
              <InspectionManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Follow Ups" && (
              <FollowUpsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Task Board" && (
              <TaskBoardManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Warranty" && (
              <WarrantyManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Message Templates" && (
              <MessageTemplatesManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Shop Documents" && (
              <ShopDocumentsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Command Center" && (
              <CommandCenterManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Expenses" && (
              <ExpenseManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Profit Reports" && canViewManagement && (
              <ProfitReportsManager user={user} />
            )}

            {activeTab === "Purchase Planning" && (
              <PurchasePlanningManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "VIN Helper" && (
              <VinHelperManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Barcode Labels" && (
              <BarcodeLabelManager user={user} />
            )}

            {activeTab === "Notifications" && (
              <NotificationCenterManager user={user} />
            )}

            {activeTab === "KPI Goals" && canViewManagement && (
              <GoalsKpiManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Release Notes" && (
              <ReleaseNotesManager user={user} />
            )}

            {activeTab === "Price Book" && (
              <PriceBookManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Customer Portal" && (
              <CustomerPortalManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Document Timeline" && (
              <DocumentTimelineManager user={user} />
            )}

            {activeTab === "Labor Guide" && (
              <LaborGuideManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Shop Health" && (
              <ShopHealthManager user={user} />
            )}

            {activeTab === "Customer Check-In" && (
              <CustomerCheckInManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Comebacks" && (
              <ComebackManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Quality Control" && (
              <QualityControlManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Deferred Work" && (
              <DeferredWorkManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "End Of Day" && canViewManagement && (
              <EndOfDayManager user={user} />
            )}

            {activeTab === "Fleet Accounts" && (
              <FleetAccountsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Receiving Audit" && (
              <ReceivingAuditManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Technician Efficiency" && canViewManagement && (
              <TechnicianEfficiencyManager user={user} />
            )}

            {activeTab === "Customer Satisfaction" && (
              <CustomerSatisfactionManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Data Cleanup" && canViewManagement && (
              <DataCleanupManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Bay Management" && (
              <BayManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Tool Checkout" && (
              <ToolCheckoutManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Parts Returns" && (
              <PartsReturnsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Quote Comparison" && (
              <QuoteComparisonManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Safety Incidents" && (
              <SafetyIncidentManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Maintenance Plans" && (
              <MaintenancePlansManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Demand Forecast" && canViewManagement && (
              <DemandForecastManager user={user} />
            )}

            {activeTab === "Document Control" && canViewManagement && (
              <DocumentControlManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Training Records" && (
              <TrainingRecordsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Announcements" && (
              <AnnouncementBoardManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Customer Credit" && canViewManagement && (
              <CustomerCreditManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Payment Reconciliation" && canViewManagement && (
              <PaymentReconciliationManager user={user} />
            )}

            {activeTab === "Inventory Valuation" && canViewManagement && (
              <InventoryValuationManager user={user} />
            )}

            {activeTab === "Turnaround SLA" && (
              <TurnaroundSlaManager user={user} />
            )}

            {activeTab === "Compliance Checklist" && (
              <ComplianceChecklistManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Subscriptions" && canViewManagement && (
              <SubscriptionExpenseManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Vendor Scorecards" && canViewManagement && (
              <VendorScorecardManager user={user} />
            )}

            {activeTab === "Numbering Audit" && canViewManagement && (
              <NumberingAuditManager user={user} />
            )}

            {activeTab === "Customer Retention" && canViewManagement && (
              <CustomerRetentionManager user={user} />
            )}

            {activeTab === "Capacity Planner" && canViewManagement && (
              <CapacityPlannerManager user={user} />
            )}

            {activeTab === "Membership Plans" && (
              <MembershipPlansManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Estimate Conversion" && canViewManagement && (
              <EstimateConversionManager user={user} />
            )}

            {activeTab === "Lost Sales" && (
              <LostSalesManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Parts Reservations" && (
              <PartsReservationManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Business Review" && canViewManagement && (
              <BusinessReviewManager user={user} />
            )}

            {activeTab === "Tech Certifications" && (
              <TechnicianCertificationManager user={user} canEditEverything={canEditEverything} />
            )}


            {activeTab === "Parts Locations" && (
              <PartsLocationManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Refunds Adjustments" && canViewManagement && (
              <RefundAdjustmentManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Communication Log" && (
              <CommunicationLogManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Appointment Waitlist" && (
              <AppointmentWaitlistManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Warranty Claims" && (
              <WarrantyClaimWorkflowManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Cycle Counts" && canViewManagement && (
              <CycleCountManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Tech Note Templates" && (
              <TechnicianNoteTemplatesManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inspection Templates" && (
              <InspectionTemplateManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Job Dispatch" && (
              <JobDispatchBoardManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Promise Times" && (
              <PromiseTimeManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Supplier Follow-Ups" && (
              <SupplierFollowUpManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Technician Workload" && canViewManagement && (
              <TechnicianWorkloadManager user={user} />
            )}

            {activeTab === "Document Library" && (
              <ShopDocumentLibraryManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Priority Scoring" && (
              <PriorityScoringManager user={user} />
            )}

            {activeTab === "Customer Approvals" && (
              <CustomerApprovalManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Parts Shortage Board" && (
              <PartsShortageBoardManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Tech Handoffs" && (
              <TechnicianHandoffManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Warranty Expiration" && (
              <WarrantyExpirationAlertManager user={user} />
            )}

            {activeTab === "Job Profitability" && canViewManagement && (
              <JobProfitabilityManager user={user} />
            )}

            {activeTab === "No Show Tracking" && (
              <NoShowTrackingManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Equipment Maintenance" && (
              <EquipmentMaintenanceManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Parts Warranty Returns" && (
              <PartsWarrantyReturnManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Manager Notes" && canViewManagement && (
              <DailyManagerNotesManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Cash Closeout" && canViewManagement && (
              <CashDrawerCloseoutManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Tech Quality Scores" && canViewManagement && (
              <TechnicianQualityScoreManager user={user} />
            )}

            {activeTab === "Vehicle Timeline" && (
              <VehicleTimelineManager user={user} />
            )}

            {activeTab === "Parts Aging" && canViewManagement && (
              <PartsAgingReportManager user={user} />
            )}

            {activeTab === "Shop Goals" && canViewManagement && (
              <ShopGoalTrackingManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Customer Deposits" && canViewManagement && (
              <CustomerDepositManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Sublet Work" && (
              <SubletWorkManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Estimate Follow-Up" && (
              <EstimateFollowUpPipelineManager user={user} />
            )}

            {activeTab === "Core Charge Ledger" && canViewManagement && (
              <CoreChargeLedgerManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "KPI Snapshot" && canViewManagement && (
              <ShopKpiSnapshotManager user={user} />
            )}

            {activeTab === "Vendor Invoice Matching" && canViewManagement && (
              <VendorInvoiceMatchingManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Advisor Performance" && canViewManagement && (
              <AdvisorPerformanceManager user={user} />
            )}

            {activeTab === "Customer Referrals" && (
              <CustomerReferralManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Policy Acknowledgements" && (
              <PolicyAcknowledgementManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Stripe Terminal" && canViewManagement && (
              <StripeTerminalManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "RO Signatures" && (
              <RepairOrderSignatureManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Motor Integration" && canViewManagement && (
              <MotorIntegrationManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Stripe Refunds" && canViewManagement && (
              <StripeRefundManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "SMS Messaging" && (
              <SmsMessagingManager user={user} canEditEverything={canEditEverything} />
            )}

            {/* --- ADDED START --- */}
            {activeTab === "Settings Hub" && canViewManagement && (
              <SettingsHubManager
                user={user}
                canEditEverything={canEditEverything}
                selectOperationsTab={selectSettingsTab}
              />
            )}

            {activeTab === "Stripe Settings" && canViewManagement && (
              <StripeSettingsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Role Permissions" && canViewManagement && (
              <RolePermissionManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Future Layout" && canViewManagement && (
              <FutureLayoutSettingsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Collapsible Sections" && canViewManagement && (
              <CollapsibleSectionsSettingsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Navigation Preview" && canViewManagement && (
              <div>
                <h2>Better Tab Organization Preview</h2>
                <p>
                  This preview shows the grouped navigation layout. Inventory is organized as Orders,
                  Stock, History, and Low Stock so Operations is no longer one long list.
                </p>
                <FutureGroupedNavigation
                  activeTab={activeTab}
                  onSelect={(tab) => selectOperationsTab(tab)}
                />
              </div>
            )}
            {/* --- ADDED END --- */}

            {activeTab === "Modern Command Center" && (
              <ModernWorkflowShellSafe
                user={user}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectOperationsTab={selectOperationsTab}
                settings={phase26cModernSettings}
                modernModeEnabled={phase26cModernModeEnabled}
              />
            )}

            {activeTab === "Workflow Customization" && canViewManagement && (
              <WorkflowCustomizationManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Service Reminders" && (
              <ServiceRemindersManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Exports" && canViewManagement && (
              <ExportManager user={user} />
            )}

            {activeTab === "Audit Logs" && canViewManagement && (
              <AuditSecurityManager user={user} />
            )}

            {activeTab === "Analytics" && canViewManagement && (
              <AnalyticsManager user={user} />
            )}
            {/* --- ADDED END --- */}

            {activeTab === "Inventory Orders" && (
              <OrdersManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inventory Stock" && (
              <PartsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inventory Low Stock" && (
              <LowStockManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inventory History" && <HistoryManager user={user} />}

            {activeTab === "Invoices" && <InvoiceManager user={user} />}

            {activeTab === "Suppliers" && (
              <SuppliersManager
                user={user}
                canEditEverything={canEditEverything}
              />
            )}

            {isSettingsTab &&
              canViewSettings &&
              activeTab !== "Settings Hub" &&
              activeTab !== "Stripe Settings" &&
              activeTab !== "Role Permissions" &&
              activeTab !== "Future Layout" &&
              activeTab !== "Collapsible Sections" &&
              activeTab !== "Workflow Customization" &&
              activeTab !== "Permissions Matrix" &&
              activeTab !== "Data Backup" && (
                <SettingsManager user={user} activeSettingsTab={activeTab} />
              )}

            {activeTab === "Permissions Matrix" && canViewSettings && (
              <PermissionsMatrixManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Data Backup" && canViewSettings && (
              <DataBackupManager user={user} />
            )}

            {activeTab === "User Management" && canViewAdminTabs && (
              <UserManagement user={user} />
            )}

            {activeTab === "Profile" && (
              <div>
                <h2>Profile</h2>
                <p>Name: {user?.username || "-"}</p>
                <p>Email: {user?.email || "-"}</p>
                <p>Phone: {user?.phone || "-"}</p>
                <p>Position: {user?.position || "-"}</p>
                <p>Role: {role}</p>
                <p>User ID: {user?.id}</p>
              </div>
            )}

            {activeTab === "Company Info" && canViewAdminTabs && (
              <CompanyInfo user={user} canEditEverything={canEditEverything} />
            )}
            </>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;