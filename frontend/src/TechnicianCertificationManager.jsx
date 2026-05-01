import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const CERT_STATUSES = ["Active", "Expired", "Pending Renewal", "Training Needed"];

function TechnicianCertificationManager({ user, canEditEverything }) {
  const [profiles, setProfiles] = useState([]);
  const [certs, setCerts] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    technician_name: "",
    certification_name: "",
    certification_number: "",
    issuer: "",
    issue_date: "",
    expiration_date: "",
    status: "Active",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [profilesResult, settingsResult] = await Promise.all([
      supabase.from("profiles").select("*").order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "technician_certifications_json").maybeSingle()
    ]);

    if (profilesResult.error) {
      setMessage(profilesResult.error.message);
      return;
    }

    setProfiles(profilesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setCerts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCerts([]);
    }
  };

  const saveCerts = async (nextCerts) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "technician_certifications_json",
        setting_value: JSON.stringify(nextCerts, null, 2),
        description: "Technician certification records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setCerts(nextCerts);
    return true;
  };

  const addCertification = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can add certification records.");
      return;
    }

    if (!form.technician_name || !form.certification_name) {
      setMessage("Technician and certification name are required.");
      return;
    }

    const cert = {
      id: `cert_${Date.now()}`,
      ...form,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveCerts([cert, ...certs]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Technician Certification Created",
      table_name: "app_settings",
      record_id: cert.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${cert.technician_name} - ${cert.certification_name}`
    });

    setMessage("Certification saved.");
    setForm({
      technician_name: "",
      certification_name: "",
      certification_number: "",
      issuer: "",
      issue_date: "",
      expiration_date: "",
      status: "Active",
      notes: ""
    });
  };

  const updateCert = async (id, updates) => {
    const next = certs.map((cert) =>
      cert.id === id ? { ...cert, ...updates, updated_at: new Date().toISOString() } : cert
    );

    const saved = await saveCerts(next);
    if (saved) setMessage("Certification updated.");
  };

  const dueSoon = useMemo(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);

    return certs.filter((cert) => {
      if (!cert.expiration_date || cert.status === "Expired") return false;
      return new Date(cert.expiration_date) <= soon;
    });
  }, [certs]);

  return (
    <div>
      <h2>Technician Certifications</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Certifications" value={certs.length} />
        <StatCard title="Active" value={certs.filter((cert) => cert.status === "Active").length} />
        <StatCard title="Due Soon" value={dueSoon.length} />
        <StatCard title="Expired" value={certs.filter((cert) => cert.status === "Expired").length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Certification</h3>

        <div style={gridStyle}>
          <label>
            Technician
            <select value={form.technician_name} onChange={(e) => setForm((p) => ({ ...p, technician_name: e.target.value }))} style={inputStyle}>
              <option value="">Select technician</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.name || profile.email}>
                  {profile.name || profile.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            Certification
            <input value={form.certification_name} onChange={(e) => setForm((p) => ({ ...p, certification_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Cert #
            <input value={form.certification_number} onChange={(e) => setForm((p) => ({ ...p, certification_number: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Issuer
            <input value={form.issuer} onChange={(e) => setForm((p) => ({ ...p, issuer: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Issue Date
            <input type="date" value={form.issue_date} onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Expiration Date
            <input type="date" value={form.expiration_date} onChange={(e) => setForm((p) => ({ ...p, expiration_date: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {CERT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addCertification} disabled={!canEditEverything}>Save Certification</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Technician</th>
            <th>Certification</th>
            <th>Issuer</th>
            <th>Issue Date</th>
            <th>Expiration</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {certs.map((cert) => (
            <tr key={cert.id}>
              <td>
                <select value={cert.status} onChange={(e) => updateCert(cert.id, { status: e.target.value })} style={inputStyle}>
                  {CERT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{cert.technician_name}</td>
              <td>{cert.certification_name}<br /><small>{cert.certification_number || ""}</small></td>
              <td>{cert.issuer || "-"}</td>
              <td>{cert.issue_date || "-"}</td>
              <td>{cert.expiration_date || "-"}</td>
              <td>{cert.notes || "-"}</td>
            </tr>
          ))}

          {certs.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center" }}>No certifications.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default TechnicianCertificationManager;
