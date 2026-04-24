import { useState } from "react";
import OrdersManager from "./OrdersManager";
import PartsManager from "./PartsManager";
import HistoryManager from "./HistoryManager";
import UserManagement from "./UserManagement";

function Dashboard({ user, onLogout }) {
  const safeUser = user || { username: "User", role: "Tech" };
  const role = safeUser.role || "Tech";

  const [activeTab, setActiveTab] = useState("Orders");

  const canViewAdminTabs =
    role === "IT" || role === "admin" || role === "Manager";

  const canEditEverything =
    role === "IT" || role === "admin";

  const tabs = ["Orders", "Parts", "History"];

  if (canViewAdminTabs) {
    tabs.push("User Management", "Profile", "Company Info");
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1>AutoShop Dashboard</h1>
          <p>
            Welcome, {safeUser.username} ({role})
          </p>
        </div>

        <button onClick={onLogout}>Logout</button>
      </div>

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 16px",
              marginRight: 8,
              cursor: "pointer",
              fontWeight: activeTab === tab ? "bold" : "normal"
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Orders" && (
        <OrdersManager user={safeUser} canEditEverything={canEditEverything} />
      )}

      {activeTab === "Parts" && (
        <PartsManager user={safeUser} canEditEverything={canEditEverything} />
      )}

      {activeTab === "History" && (
        <HistoryManager user={safeUser} canEditEverything={canEditEverything} />
      )}

      {activeTab === "User Management" && canViewAdminTabs && (
        <UserManagement user={safeUser} />
      )}

      {activeTab === "Profile" && canViewAdminTabs && (
        <div>
          <h2>Profile</h2>
          <p>Username: {safeUser.username}</p>
          <p>Role: {role}</p>
        </div>
      )}

      {activeTab === "Company Info" && canViewAdminTabs && (
        <div>
          <h2>Company Info</h2>
          <p>Company information will go here.</p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;