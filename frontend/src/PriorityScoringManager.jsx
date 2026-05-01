import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PriorityScoringManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [promiseRecords, setPromiseRecords] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, promiseResult, shortageResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "promise_times_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "parts_shortage_board_json").maybeSingle()
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      setPromiseRecords(JSON.parse(promiseResult.data?.setting_value || "[]"));
    } catch {
      setPromiseRecords([]);
    }

    try {
      setShortages(JSON.parse(shortageResult.data?.setting_value || "[]"));
    } catch {
      setShortages([]);
    }
  };

  const scoreJob = (job) => {
    let score = 0;
    const reasons = [];

    const total = Number(job.grand_total || 0);
    if (total >= 1000) {
      score += 20;
      reasons.push("High value");
    }

    if (job.status === "Waiting Parts") {
      score += 12;
      reasons.push("Waiting parts");
    }

    if (job.status === "Ready") {
      score += 18;
      reasons.push("Ready for pickup");
    }

    if (job.status === "In Progress") {
      score += 10;
      reasons.push("In progress");
    }

    const createdAt = job.created_at ? new Date(job.created_at) : null;
    if (createdAt) {
      const ageHours = (Date.now() - createdAt.getTime()) / 1000 / 60 / 60;
      if (ageHours > 72) {
        score += 18;
        reasons.push("Older than 72 hours");
      } else if (ageHours > 48) {
        score += 12;
        reasons.push("Older than 48 hours");
      }
    }

    const promise = promiseRecords.find((item) => item.invoice_id === job.id);
    if (promise) {
      const promiseTime = new Date(`${promise.promise_date}T${promise.promise_time || "17:00"}`);
      if (promiseTime.getTime() < Date.now()) {
        score += 25;
        reasons.push("Promise time late");
      } else if (promiseTime.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
        score += 15;
        reasons.push("Promise due soon");
      }
    }

    const jobShortages = shortages.filter((item) => item.invoice_id === job.id && item.status !== "Resolved");
    if (jobShortages.length > 0) {
      score += 10 + jobShortages.length * 3;
      reasons.push("Parts shortage");
    }

    if (!job.technician_name) {
      score += 8;
      reasons.push("Unassigned");
    }

    return { score, reasons };
  };

  const rows = useMemo(() => {
    return jobs
      .filter(
        (job) =>
          (job.document_status === "Repair Order" || job.repair_order_number) &&
          !["Delivered", "Completed", "Cancelled", "Voided"].includes(job.status)
      )
      .map((job) => ({
        ...job,
        ...scoreJob(job)
      }))
      .sort((a, b) => b.score - a.score);
  }, [jobs, promiseRecords, shortages]);

  const updateJobStatus = async (jobId, status) => {
    const { error } = await supabase
      .from("invoices")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Priority Board Status Updated",
      table_name: "invoices",
      record_id: jobId,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Status changed to ${status}`
    });

    setMessage("Job status updated.");
    loadAll();
  };

  return (
    <div>
      <h2>RO Priority Scoring</h2>

      {message && <p style={{ color: message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <div style={cardGrid}>
        <StatCard title="Open Jobs" value={rows.length} />
        <StatCard title="High Priority" value={rows.filter((row) => row.score >= 50).length} />
        <StatCard title="Unassigned" value={rows.filter((row) => !row.technician_name).length} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Score</th>
            <th>Job</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Technician</th>
            <th>Total</th>
            <th>Reasons</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((job) => (
            <tr key={job.id}>
              <td><strong>{job.score}</strong></td>
              <td>{job.repair_order_number || job.invoice_number || job.estimate_number || "-"}</td>
              <td>{job.customer_name || "-"}</td>
              <td>
                <select value={job.status || "Waiting"} onChange={(e) => updateJobStatus(job.id, e.target.value)} style={inputStyle}>
                  <option>Waiting</option>
                  <option>Assigned</option>
                  <option>In Progress</option>
                  <option>Waiting Parts</option>
                  <option>QC</option>
                  <option>Ready</option>
                  <option>Delivered</option>
                </select>
              </td>
              <td>{job.technician_name || "Unassigned"}</td>
              <td>${Number(job.grand_total || 0).toFixed(2)}</td>
              <td>{job.reasons.join(", ") || "-"}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No active jobs.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default PriorityScoringManager;
