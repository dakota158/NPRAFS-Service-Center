import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function AuditSecurityManager({ user }) {
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setMessage("");

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setMessage(error.message);
      return;
    }

    setLogs(data || []);
  };

  const tables = useMemo(
    () =>
      [...new Set(logs.map((log) => log.table_name).filter(Boolean))].sort(),
    [logs]
  );

  const actions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (tableFilter && log.table_name !== tableFilter) return false;
      if (actionFilter && log.action !== actionFilter) return false;

      if (!term) return true;

      return [
        log.action,
        log.table_name,
        log.record_id,
        log.user_email,
        log.details
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [logs, search, tableFilter, actionFilter]);

  const exportAuditCsv = () => {
    const rows = [
      ["Created", "Action", "Table", "Record ID", "User", "Details"],
      ...filteredLogs.map((log) => [
        log.created_at || "",
        log.action || "",
        log.table_name || "",
        log.record_id || "",
        log.user_email || log.user_id || "",
        typeof log.details === "string" ? log.details : JSON.stringify(log.details || "")
      ])
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Audit / Security Logs</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Logs Loaded" value={logs.length} />
        <StatCard title="Filtered Results" value={filteredLogs.length} />
        <StatCard title="Tables" value={tables.length} />
        <StatCard title="Actions" value={actions.length} />
      </div>

      <div style={panelStyle}>
        <h3>Filters</h3>

        <div style={gridStyle}>
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, user, table, details..."
              style={inputStyle}
            />
          </label>

          <label>
            Table
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All tables</option>
              {tables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </label>

          <label>
            Action
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" onClick={loadLogs}>
          Refresh
        </button>{" "}
        <button type="button" onClick={exportAuditCsv}>
          Export CSV
        </button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Table</th>
            <th>Record</th>
            <th>User</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {filteredLogs.map((log) => (
            <tr key={log.id}>
              <td>
                {log.created_at
                  ? new Date(log.created_at).toLocaleString()
                  : "-"}
              </td>
              <td>{log.action || "-"}</td>
              <td>{log.table_name || "-"}</td>
              <td>{log.record_id || "-"}</td>
              <td>{log.user_email || log.user_id || "-"}</td>
              <td style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>
                {typeof log.details === "string"
                  ? log.details
                  : JSON.stringify(log.details || "", null, 2)}
              </td>
            </tr>
          ))}

          {filteredLogs.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No audit logs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12
};

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

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginBottom: 18
};

const statCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14
};

export default AuditSecurityManager;
