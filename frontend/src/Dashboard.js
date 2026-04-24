import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DashboardHome from "./DashboardHome";
import OrdersManager from "./OrdersManager";
import PartsManager from "./PartsManager";
import HistoryManager from "./HistoryManager";
import UserManagement from "./UserManagement";
import CompanyInfo from "./CompanyInfo";
import SuppliersManager from "./SuppliersManager";
import "./App.css";

function Dashboard({ user, onLogout }) {
  const role = user?.role || "Tech";
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [companyInfo, setCompanyInfo] = useState({
    name: "NPRAFS Service Center",
    logo_url: ""
  });

  const fallbackLogoPath = `${process.env.PUBLIC_URL}/favicon.ico`;

  const canViewAdminTabs =
    role === "IT" || role === "admin" || role === "Admin" || role === "Manager";

  const canEditEverything =
    role === "IT" || role === "admin" || role === "Admin";

  const tabs = ["Dashboard", "Orders", "Parts", "History", "Suppliers"];

  if (canViewAdminTabs) {
    tabs.push("User Management", "Profile", "Company Info");
  }

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
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "nav-button active" : "nav-button"}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          <div className="top-bar">
            <div>
              <h2 className="page-title">{activeTab}</h2>
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

            {activeTab === "Orders" && (
              <OrdersManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "Parts" && (
              <PartsManager user={user} canEditEverything={canEditEverything} />
            )}

            {activeTab === "History" && (
              <HistoryManager
                user={user}
                canEditEverything={canEditEverything}
              />
            )}

            {activeTab === "Suppliers" && (
              <SuppliersManager
                user={user}
                canEditEverything={canEditEverything}
              />
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