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
import "./App.css";

function Dashboard({ user, onLogout }) {
  const role = user?.role || "Tech";

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    activeTab === "Settings Audit";

  const pageTitle =
    activeTab === "Inventory Orders"
      ? "Inventory - Orders"
      : activeTab === "Inventory Stock"
      ? "Inventory - Stock"
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
            {activeTab === "Dashboard" && <DashboardHome user={user} />}

            {activeTab === "Inventory Orders" && (
              <OrdersManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inventory Stock" && (
              <PartsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Inventory History" && <HistoryManager user={user} />}

            {activeTab === "Invoices" && <InvoiceManager user={user} />}

            {activeTab === "Suppliers" && (
              <SuppliersManager
                user={user}
                canEditEverything={canEditEverything}
              />
            )}

            {isSettingsTab && canViewSettings && (
              <SettingsManager user={user} activeSettingsTab={activeTab} />
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;