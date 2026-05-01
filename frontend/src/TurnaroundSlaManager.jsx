import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TurnaroundSlaManager() {
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");
  const [targetHours, setTargetHours] = useState("48");

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setJobs(data || []);
  };

  const rows = useMemo(() => {
    return jobs.map((job) => {
      const start = job.created_at ? new Date(job.created_at).getTime() : null;
      const end =
        job.status === "Completed" || job.status === "Delivered" || job.status === "Ready"
          ? new Date(job.updated_at || job.created_at).getTime()
          : Date.now();

      const hours = start ? Math.max(0, (end - start) / 1000 / 60 / 60) : 0;
      const target = Number(targetHours || 48);

      return {
        ...job,
        turnaroundHours: hours,
        withinTarget: hours <= target
      };
    });
  }, [jobs, targetHours]);

  const activeRows = rows.filter(
    (row) => row.document_status === "Repair Order" || row.repair_order_number
  );

  const avgHours =
    activeRows.length > 0
      ? activeRows.reduce((sum, row) => sum + row.turnaroundHours, 0) / activeRows.length
      : 0;

  const withinRate =
    activeRows.length > 0
      ? Math.round((activeRows.filter((row) => row.withinTarget).length / activeRows.length) * 100)
      : 0;

  return (
    <div>
      <h2>Turnaround / SLA Tracking</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Jobs" value={activeRows.length} />
        <StatCard title="Average Hours" value={avgHours.toFixed(1)} />
        <StatCard title="Within Target" value={`${withinRate}%`} />
        <StatCard title="Over Target" value={activeRows.filter((row) => !row.withinTarget).length} />
      </div>

      <div style={panelStyle}>
        <label>
          Target Turnaround Hours
          <input type="number" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadJobs}>Refresh</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Created</th>
            <th>Hours</th>
            <th>SLA</th>
          </tr>
        </thead>

        <tbody>
          {activeRows.slice(0, 200).map((job) => (
            <tr key={job.id}>
              <td>{job.status || job.document_status || "-"}</td>
              <td>{job.repair_order_number || job.invoice_number || job.estimate_number || "-"}</td>
              <td>{job.customer_name || "-"}</td>
              <td>{[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ") || "-"}</td>
              <td>{job.created_at ? new Date(job.created_at).toLocaleString() : "-"}</td>
              <td>{job.turnaroundHours.toFixed(1)}</td>
              <td style={{ color: job.withinTarget ? "green" : "red" }}>
                {job.withinTarget ? "Within Target" : "Over Target"}
              </td>
            </tr>
          ))}

          {activeRows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No jobs found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 220, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default TurnaroundSlaManager;
