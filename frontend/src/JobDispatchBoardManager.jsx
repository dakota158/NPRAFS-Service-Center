import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DISPATCH_STATUSES = ["Waiting", "Assigned", "In Progress", "Waiting Parts", "QC", "Ready", "Delivered"];

function JobDispatchBoardManager({ user }) {
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

  const updateJob = async (jobId, updates) => {
    const { error } = await supabase
      .from("invoices")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Dispatch Board Updated",
      table_name: "invoices",
      record_id: jobId,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: JSON.stringify(updates)
    });

    setMessage("Job updated.");
    loadAll();
  };

  const activeJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (job.document_status === "Repair Order" || job.repair_order_number) &&
          !["Delivered", "Completed", "Cancelled", "Voided"].includes(job.status)
      ),
    [jobs]
  );

  const groupedJobs = useMemo(() => {
    const groups = {};
    DISPATCH_STATUSES.forEach((status) => {
      groups[status] = [];
    });

    activeJobs.forEach((job) => {
      const status = DISPATCH_STATUSES.includes(job.status) ? job.status : "Waiting";
      groups[status].push(job);
    });

    return groups;
  }, [activeJobs]);

  return (
    <div>
      <h2>Job Dispatch Board</h2>

      {message && <p style={{ color: message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <div style={boardStyle}>
        {DISPATCH_STATUSES.map((status) => (
          <div key={status} style={columnStyle}>
            <h3 style={{ marginTop: 0 }}>{status}</h3>
            <p>{groupedJobs[status]?.length || 0} job(s)</p>

            {(groupedJobs[status] || []).map((job) => (
              <div key={job.id} style={cardStyle}>
                <strong>{job.repair_order_number || job.invoice_number || job.estimate_number || "No #"}</strong>
                <p style={{ marginBottom: 4 }}>{job.customer_name || "Customer"}</p>
                <small>
                  {[job.vehicle_year, job.vehicle_make, job.vehicle_model]
                    .filter(Boolean)
                    .join(" ") || "No vehicle"}
                </small>

                <label style={labelStyle}>
                  Technician
                  <select
                    value={job.technician_name || ""}
                    onChange={(e) => updateJob(job.id, { technician_name: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Unassigned</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.name || profile.email}>
                        {profile.name || profile.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={labelStyle}>
                  Status
                  <select
                    value={job.status || "Waiting"}
                    onChange={(e) => updateJob(job.id, { status: e.target.value })}
                    style={inputStyle}
                  >
                    {DISPATCH_STATUSES.map((nextStatus) => (
                      <option key={nextStatus}>{nextStatus}</option>
                    ))}
                  </select>
                </label>

                <p style={{ marginTop: 8 }}>
                  <strong>Total:</strong> ${Number(job.grand_total || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const boardStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  alignItems: "start"
};

const columnStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#f8fafc",
  minHeight: 250
};

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 10,
  marginBottom: 10
};

const inputStyle = {
  width: "100%",
  padding: 7,
  boxSizing: "border-box",
  marginTop: 4
};

const labelStyle = {
  display: "block",
  marginTop: 8
};

export default JobDispatchBoardManager;
