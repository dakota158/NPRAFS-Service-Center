import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TechnicianWorkloadManager() {
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, profilesResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*").order("name", { ascending: true })
    ]);

    if (jobsResult.error || profilesResult.error) {
      setMessage(jobsResult.error?.message || profilesResult.error?.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setProfiles(profilesResult.data || []);
  };

  const rows = useMemo(() => {
    const activeJobs = jobs.filter(
      (job) =>
        (job.document_status === "Repair Order" || job.repair_order_number) &&
        !["Completed", "Delivered", "Cancelled", "Voided"].includes(job.status)
    );

    const techNames = new Set([
      ...profiles
        .filter((profile) => ["Tech", "Technician", "Manager", "IT", "Admin", "admin"].includes(profile.role))
        .map((profile) => profile.name || profile.email)
        .filter(Boolean),
      ...activeJobs.map((job) => job.technician_name || "Unassigned")
    ]);

    return Array.from(techNames).map((techName) => {
      const techJobs = activeJobs.filter((job) => (job.technician_name || "Unassigned") === techName);

      const laborHours = techJobs.reduce((sum, job) => {
        const laborItems = job.labor_items || [];
        return sum + laborItems.reduce((itemSum, labor) => itemSum + Number(labor.hours || 0), 0);
      }, 0);

      return {
        techName,
        jobs: techJobs.length,
        laborHours,
        revenue: techJobs.reduce((sum, job) => sum + Number(job.grand_total || 0), 0),
        waitingParts: techJobs.filter((job) => job.status === "Waiting Parts").length,
        ready: techJobs.filter((job) => job.status === "Ready").length,
        inProgress: techJobs.filter((job) => job.status === "In Progress").length
      };
    }).sort((a, b) => b.laborHours - a.laborHours);
  }, [jobs, profiles]);

  const avgHours = rows.length ? rows.reduce((sum, row) => sum + row.laborHours, 0) / rows.length : 0;

  return (
    <div>
      <h2>Technician Workload</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <div style={cardGrid}>
        <StatCard title="Technicians" value={rows.length} />
        <StatCard title="Open Jobs" value={rows.reduce((sum, row) => sum + row.jobs, 0)} />
        <StatCard title="Labor Hours" value={rows.reduce((sum, row) => sum + row.laborHours, 0).toFixed(1)} />
        <StatCard title="Avg Hours / Tech" value={avgHours.toFixed(1)} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Technician</th>
            <th>Jobs</th>
            <th>Labor Hours</th>
            <th>Revenue</th>
            <th>In Progress</th>
            <th>Waiting Parts</th>
            <th>Ready</th>
            <th>Balance</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const balance = row.laborHours > avgHours + 3 ? "Heavy" : row.laborHours < avgHours - 3 ? "Light" : "Balanced";

            return (
              <tr key={row.techName}>
                <td>{row.techName}</td>
                <td>{row.jobs}</td>
                <td>{row.laborHours.toFixed(2)}</td>
                <td>${row.revenue.toFixed(2)}</td>
                <td>{row.inProgress}</td>
                <td>{row.waitingParts}</td>
                <td>{row.ready}</td>
                <td style={{ color: balance === "Heavy" ? "red" : balance === "Light" ? "#b45309" : "green" }}>
                  {balance}
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No workload data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default TechnicianWorkloadManager;
