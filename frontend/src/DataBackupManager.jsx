import { useState } from "react";
import { supabase } from "./supabaseClient";

const TABLES = [
  "app_settings",
  "audit_logs",
  "company_info",
  "customers",
  "customer_vehicles",
  "estimates",
  "history",
  "invoice_email_logs",
  "invoice_inventory_deductions",
  "invoice_payments",
  "invoices",
  "labor_rates",
  "markup_tiers",
  "orders",
  "parts",
  "profiles",
  "suppliers"
];

function DataBackupManager({ user }) {
  const [message, setMessage] = useState("");
  const [backupSummary, setBackupSummary] = useState(null);

  const downloadJson = (filename, object) => {
    const blob = new Blob([JSON.stringify(object, null, 2)], {
      type: "application/json;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportBackup = async () => {
    setMessage("Building backup...");
    const backup = {
      exported_at: new Date().toISOString(),
      exported_by: user?.email || user?.id || "",
      tables: {}
    };

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");

      if (error) {
        backup.tables[table] = {
          error: error.message,
          rows: []
        };
      } else {
        backup.tables[table] = {
          error: null,
          rows: data || []
        };
      }
    }

    await supabase.from("audit_logs").insert({
      action: "Data Backup Exported",
      table_name: "all",
      record_id: "backup",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Exported backup with ${TABLES.length} tables`
    });

    const summary = Object.fromEntries(
      Object.entries(backup.tables).map(([table, value]) => [
        table,
        value.rows?.length || 0
      ])
    );

    setBackupSummary(summary);
    setMessage("Backup exported.");
    downloadJson(`nprafs-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
  };

  const exportSettingsOnly = async () => {
    const { data, error } = await supabase.from("app_settings").select("*");

    if (error) {
      setMessage(error.message);
      return;
    }

    downloadJson(`nprafs-settings-${new Date().toISOString().slice(0, 10)}.json`, {
      exported_at: new Date().toISOString(),
      rows: data || []
    });
    setMessage("Settings exported.");
  };

  return (
    <div>
      <h2>Data Backup</h2>

      {message && (
        <p style={{ color: message.includes("exported") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Export Backup</h3>
        <p>
          This creates a JSON export of your app tables. It does not restore data automatically,
          which protects you from accidental overwrites.
        </p>

        <button type="button" onClick={exportBackup}>
          Export Full Backup JSON
        </button>{" "}
        <button type="button" onClick={exportSettingsOnly}>
          Export Settings Only
        </button>
      </div>

      {backupSummary && (
        <div style={panelStyle}>
          <h3>Last Backup Summary</h3>
          <table border="1" cellPadding="8" style={tableStyle}>
            <thead>
              <tr>
                <th>Table</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(backupSummary).map(([table, count]) => (
                <tr key={table}>
                  <td>{table}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default DataBackupManager;
