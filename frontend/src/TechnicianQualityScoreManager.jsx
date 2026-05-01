import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TechnicianQualityScoreManager() {
  const [jobs, setJobs] = useState([]);
  const [qcRecords, setQcRecords] = useState([]);
  const [comebacks, setComebacks] = useState([]);
  const [warrantyClaims, setWarrantyClaims] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, qcResult, comebackResult, warrantyResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "quality_control_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "comebacks_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "warranty_claim_workflow_json").maybeSingle()
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try { setQcRecords(JSON.parse(qcResult.data?.setting_value || "[]")); } catch { setQcRecords([]); }
    try { setComebacks(JSON.parse(comebackResult.data?.setting_value || "[]")); } catch { setComebacks([]); }
    try { setWarrantyClaims(JSON.parse(warrantyResult.data?.setting_value || "[]")); } catch { setWarrantyClaims([]); }
  };

  const rows = useMemo(() => {
    const techMap = {};

    jobs.forEach((job) => {
      const tech = job.technician_name || "Unassigned";
      if (!techMap[tech]) {
        techMap[tech] = { tech, jobs: 0, revenue: 0, qcPassed: 0, qcFailed: 0, comebacks: 0, warrantyClaims: 0 };
      }

      techMap[tech].jobs += 1;
      techMap[tech].revenue += Number(job.grand_total || 0);
    });

    qcRecords.forEach((record) => {
      const job = jobs.find((item) => item.id === record.invoice_id || item.repair_order_number === record.document_number);
      const tech = record.technician_name || job?.technician_name || "Unassigned";

      if (!techMap[tech]) {
        techMap[tech] = { tech, jobs: 0, revenue: 0, qcPassed: 0, qcFailed: 0, comebacks: 0, warrantyClaims: 0 };
      }

      if (record.status === "Passed" || record.completed) techMap[tech].qcPassed += 1;
      if (record.status === "Failed" || record.failed) techMap[tech].qcFailed += 1;
    });

    comebacks.forEach((record) => {
      const tech = record.technician_name || "Unassigned";
      if (!techMap[tech]) {
        techMap[tech] = { tech, jobs: 0, revenue: 0, qcPassed: 0, qcFailed: 0, comebacks: 0, warrantyClaims: 0 };
      }
      techMap[tech].comebacks += 1;
    });

    warrantyClaims.forEach((claim) => {
      const job = jobs.find((item) => item.id === claim.invoice_id || item.invoice_number === claim.document_number || item.repair_order_number === claim.document_number);
      const tech = job?.technician_name || "Unassigned";

      if (!techMap[tech]) {
        techMap[tech] = { tech, jobs: 0, revenue: 0, qcPassed: 0, qcFailed: 0, comebacks: 0, warrantyClaims: 0 };
      }

      techMap[tech].warrantyClaims += 1;
    });

    return Object.values(techMap)
      .map((row) => {
        let score = 100;
        score -= row.qcFailed * 8;
        score -= row.comebacks * 12;
        score -= row.warrantyClaims * 7;
        score += Math.min(row.qcPassed * 2, 10);
        score = Math.max(0, Math.min(100, score));

        return {
          ...row,
          score,
          comebackRate: row.jobs ? (row.comebacks / row.jobs) * 100 : 0
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [jobs, qcRecords, comebacks, warrantyClaims]);

  return (
    <div>
      <h2>Technician Quality Scores</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>Refresh</button>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Score</th>
            <th>Technician</th>
            <th>Jobs</th>
            <th>Revenue</th>
            <th>QC Passed</th>
            <th>QC Failed</th>
            <th>Comebacks</th>
            <th>Comeback Rate</th>
            <th>Warranty Claims</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.tech}>
              <td style={{ color: row.score >= 85 ? "green" : row.score >= 70 ? "#b45309" : "red" }}>
                <strong>{row.score}</strong>
              </td>
              <td>{row.tech}</td>
              <td>{row.jobs}</td>
              <td>${row.revenue.toFixed(2)}</td>
              <td>{row.qcPassed}</td>
              <td>{row.qcFailed}</td>
              <td>{row.comebacks}</td>
              <td>{row.comebackRate.toFixed(1)}%</td>
              <td>{row.warrantyClaims}</td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center" }}>No technician quality data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default TechnicianQualityScoreManager;
