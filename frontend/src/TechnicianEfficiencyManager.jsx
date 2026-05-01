import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TechnicianEfficiencyManager() {
  const [jobs, setJobs] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "time_clock_entries_json").maybeSingle()
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setTimeEntries(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTimeEntries([]);
    }
  };

  const getHours = (entry) => {
    if (!entry.clock_in) return 0;
    const start = new Date(entry.clock_in).getTime();
    const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
    return Math.max(0, (end - start) / 1000 / 60 / 60);
  };

  const report = useMemo(() => {
    const techs = {};

    jobs.forEach((job) => {
      const techName = job.technician_name || "Unassigned";
      if (!techs[techName]) {
        techs[techName] = {
          name: techName,
          jobs: 0,
          laborSold: 0,
          billedHours: 0,
          clockHours: 0,
          revenue: 0
        };
      }

      techs[techName].jobs += 1;
      techs[techName].laborSold += Number(job.labor_subtotal || 0);
      techs[techName].revenue += Number(job.grand_total || 0);

      (job.labor_items || []).forEach((labor) => {
        techs[techName].billedHours += Number(labor.hours || 0);
      });
    });

    timeEntries.forEach((entry) => {
      const techName = entry.technician_name || "Unassigned";
      if (!techs[techName]) {
        techs[techName] = {
          name: techName,
          jobs: 0,
          laborSold: 0,
          billedHours: 0,
          clockHours: 0,
          revenue: 0
        };
      }

      techs[techName].clockHours += getHours(entry);
    });

    return Object.values(techs).sort((a, b) => b.laborSold - a.laborSold);
  }, [jobs, timeEntries]);

  return (
    <div>
      <h2>Technician Efficiency</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Technician</th>
            <th>Jobs</th>
            <th>Billed Hours</th>
            <th>Clock Hours</th>
            <th>Efficiency</th>
            <th>Labor Sold</th>
            <th>Total Revenue</th>
          </tr>
        </thead>
        <tbody>
          {report.map((tech) => {
            const efficiency = tech.clockHours > 0 ? (tech.billedHours / tech.clockHours) * 100 : 0;
            return (
              <tr key={tech.name}>
                <td>{tech.name}</td>
                <td>{tech.jobs}</td>
                <td>{tech.billedHours.toFixed(2)}</td>
                <td>{tech.clockHours.toFixed(2)}</td>
                <td><strong>{efficiency.toFixed(1)}%</strong></td>
                <td>${tech.laborSold.toFixed(2)}</td>
                <td>${tech.revenue.toFixed(2)}</td>
              </tr>
            );
          })}
          {report.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No technician data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default TechnicianEfficiencyManager;
