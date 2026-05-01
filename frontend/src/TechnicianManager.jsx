import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function TechnicianManager({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [profilesResult, jobsResult] = await Promise.all([
      supabase.from("profiles").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("updated_at", { ascending: false })
    ]);

    if (profilesResult.error || jobsResult.error) {
      setMessage(profilesResult.error?.message || jobsResult.error?.message);
      return;
    }

    setProfiles(profilesResult.data || []);
    setJobs(jobsResult.data || []);
  };

  const technicians = useMemo(
    () =>
      profiles.filter((profile) =>
        ["Tech", "Manager", "IT", "admin", "Admin"].includes(profile.role)
      ),
    [profiles]
  );

  const getTechJobs = (tech) =>
    jobs.filter(
      (job) =>
        (job.technician_name || "").toLowerCase() ===
        (tech.name || tech.email || "").toLowerCase()
    );

  const updateJobStatus = async (job, status) => {
    const { error } = await supabase
      .from("invoices")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "Technician Job Status Updated",
      table_name: "invoices",
      record_id: job.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Set ${job.repair_order_number || job.invoice_number} to ${status}`
    });

    loadAll();
  };

  return (
    <div>
      <h2>Technician System</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <button type="button" onClick={loadAll} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <div style={cardGrid}>
        {technicians.map((tech) => {
          const techJobs = getTechJobs(tech);
          const activeJobs = techJobs.filter(
            (job) =>
              !["Completed", "Delivered", "Cancelled", "Paid"].includes(
                job.status
              )
          );

          return (
            <div key={tech.id} style={panelStyle}>
              <h3 style={{ marginTop: 0 }}>{tech.name || tech.email}</h3>
              <p>
                <strong>Role:</strong> {tech.role}
              </p>
              <p>
                <strong>Active Jobs:</strong> {activeJobs.length}
              </p>
              <p>
                <strong>Total Assigned:</strong> {techJobs.length}
              </p>

              <table border="1" cellPadding="6" style={tableStyle}>
                <thead>
                  <tr>
                    <th>RO</th>
                    <th>Customer</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {techJobs.slice(0, 8).map((job) => (
                    <tr key={job.id}>
                      <td>{job.repair_order_number || job.invoice_number}</td>
                      <td>{job.customer_name || "-"}</td>
                      <td>
                        <select
                          value={job.status || "Open"}
                          onChange={(e) => updateJobStatus(job, e.target.value)}
                          style={inputStyle}
                        >
                          {[
                            "Open",
                            "Waiting Parts",
                            "In Progress",
                            "Ready",
                            "Completed",
                            "Delivered",
                            "Cancelled"
                          ].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {techJobs.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center" }}>
                        No assigned jobs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}

        {technicians.length === 0 && <p>No technicians found.</p>}
      </div>
    </div>
  );
}

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 14
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

const inputStyle = {
  width: "100%",
  padding: 6,
  boxSizing: "border-box"
};

export default TechnicianManager;
