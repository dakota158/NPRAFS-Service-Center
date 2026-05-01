import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function CapacityPlannerManager() {
  const [jobs, setJobs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bays, setBays] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [message, setMessage] = useState("");
  const [dailyHours, setDailyHours] = useState("8");
  const [planningDate, setPlanningDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, profilesResult, appointmentsResult, baysResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("app_settings").select("*").eq("setting_key", "appointments_json").maybeSingle(),
      supabase.from("app_settings").select("*").eq("setting_key", "shop_bays_json").maybeSingle()
    ]);

    if (jobsResult.error || profilesResult.error) {
      setMessage(jobsResult.error?.message || profilesResult.error?.message);
      return;
    }

    setJobs(jobsResult.data || []);
    setProfiles(profilesResult.data || []);

    try {
      setAppointments(JSON.parse(appointmentsResult.data?.setting_value || "[]"));
    } catch {
      setAppointments([]);
    }

    try {
      setBays(JSON.parse(baysResult.data?.setting_value || "[]"));
    } catch {
      setBays([]);
    }
  };

  const report = useMemo(() => {
    const techs = profiles.filter((profile) =>
      ["Tech", "Technician", "Manager", "IT", "Admin", "admin"].includes(profile.role)
    );

    const openJobs = jobs.filter(
      (job) =>
        (job.document_status === "Repair Order" || job.repair_order_number) &&
        !["Completed", "Delivered", "Cancelled", "Voided"].includes(job.status)
    );

    const estimatedHours = openJobs.reduce((sum, job) => {
      const laborItems = job.labor_items || [];
      const laborHours = laborItems.reduce((itemSum, labor) => itemSum + Number(labor.hours || 0), 0);
      return sum + laborHours;
    }, 0);

    const appointmentsToday = appointments.filter((appt) => appt.appointment_date === planningDate);
    const appointmentHours = appointmentsToday.reduce((sum, appt) => sum + Number(appt.duration_minutes || 0) / 60, 0);

    const bayCapacity = bays.length * Number(dailyHours || 8);
    const techCapacity = Math.max(techs.length, 1) * Number(dailyHours || 8);
    const capacity = Math.min(bayCapacity || techCapacity, techCapacity);
    const load = estimatedHours + appointmentHours;
    const utilization = capacity ? Math.round((load / capacity) * 100) : 0;

    return {
      techs: techs.length,
      bays: bays.length,
      openJobs: openJobs.length,
      estimatedHours,
      appointmentsToday: appointmentsToday.length,
      appointmentHours,
      capacity,
      load,
      utilization
    };
  }, [jobs, appointments, bays, profiles, dailyHours, planningDate]);

  return (
    <div>
      <h2>Shop Capacity Planner</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Planning Date
          <input type="date" value={planningDate} onChange={(e) => setPlanningDate(e.target.value)} style={inputStyle} />
        </label>

        <label>
          Hours Per Tech/Bay
          <input type="number" value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Technicians" value={report.techs} />
        <StatCard title="Bays" value={report.bays} />
        <StatCard title="Open Jobs" value={report.openJobs} />
        <StatCard title="Job Hours" value={report.estimatedHours.toFixed(1)} />
        <StatCard title="Appointments" value={report.appointmentsToday} />
        <StatCard title="Appt Hours" value={report.appointmentHours.toFixed(1)} />
        <StatCard title="Capacity Hours" value={report.capacity.toFixed(1)} />
        <StatCard title="Utilization" value={`${report.utilization}%`} />
      </div>

      <div style={panelStyle}>
        <h3>Capacity Status</h3>
        <div style={barTrack}>
          <div
            style={{
              ...barFill,
              width: `${Math.min(report.utilization, 100)}%`,
              background: report.utilization > 100 ? "#dc2626" : report.utilization > 85 ? "#f59e0b" : "#2563eb"
            }}
          />
        </div>

        {report.utilization > 100 ? (
          <p style={{ color: "red" }}>Over capacity. Consider moving appointments or adding technician time.</p>
        ) : report.utilization > 85 ? (
          <p style={{ color: "#b45309" }}>Near capacity. Watch new work intake.</p>
        ) : (
          <p style={{ color: "green" }}>Capacity looks healthy.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", maxWidth: 220, padding: 8, boxSizing: "border-box", margin: "4px 12px 10px 0" };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const barTrack = { background: "#e5e7eb", borderRadius: 10, height: 22, overflow: "hidden" };
const barFill = { height: 22, borderRadius: 10 };

export default CapacityPlannerManager;
