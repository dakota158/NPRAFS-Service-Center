import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const QC_ITEMS = [
  "Work requested completed",
  "Parts installed verified",
  "Fluids checked",
  "No warning lights",
  "Road test completed",
  "Interior/exterior clean",
  "Customer belongings returned",
  "Invoice notes complete"
];

function QualityControlManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [qcRecords, setQcRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [items, setItems] = useState(QC_ITEMS.map((name) => ({ name, passed: false, note: "" })));
  const [finalNote, setFinalNote] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "quality_control_json").maybeSingle()
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setQcRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setQcRecords([]);
    }
  };

  const saveQcRecords = async (nextRecords) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "quality_control_json",
        setting_value: JSON.stringify(nextRecords, null, 2),
        description: "Quality control checklist records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setQcRecords(nextRecords);
    return true;
  };

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const saveQualityCheck = async () => {
    setMessage("");

    if (!selectedJob) {
      setMessage("Select a job first.");
      return;
    }

    const failedItems = items.filter((item) => !item.passed);

    const record = {
      id: `qc_${Date.now()}`,
      invoice_id: selectedJob.id,
      document_number: selectedJob.repair_order_number || selectedJob.invoice_number || selectedJob.estimate_number || "",
      customer_name: selectedJob.customer_name || "",
      vehicle_name: [selectedJob.vehicle_year, selectedJob.vehicle_make, selectedJob.vehicle_model].filter(Boolean).join(" "),
      items,
      passed: failedItems.length === 0,
      final_note: finalNote,
      checked_by: user?.email || user?.username || "",
      checked_at: new Date().toISOString()
    };

    const saved = await saveQcRecords([record, ...qcRecords]);

    if (!saved) return;

    await supabase.from("invoices").update({
      status: record.passed ? "Ready" : "In Progress",
      internal_notes: [
        selectedJob.internal_notes || "",
        `QC ${record.passed ? "PASSED" : "NEEDS ATTENTION"} by ${record.checked_by}`,
        finalNote
      ].filter(Boolean).join("\n"),
      updated_at: new Date().toISOString()
    }).eq("id", selectedJob.id);

    await supabase.from("audit_logs").insert({
      action: "Quality Control Saved",
      table_name: "app_settings",
      record_id: record.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `QC ${record.passed ? "passed" : "failed"} for ${record.document_number}`
    });

    setMessage("Quality check saved.");
    setSelectedJobId("");
    setItems(QC_ITEMS.map((name) => ({ name, passed: false, note: "" })));
    setFinalNote("");
    loadAll();
  };

  const passRate = qcRecords.length
    ? Math.round((qcRecords.filter((item) => item.passed).length / qcRecords.length) * 100)
    : 0;

  return (
    <div>
      <h2>Quality Control</h2>

      {message && <p style={{ color: message.includes("saved") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="QC Records" value={qcRecords.length} />
        <StatCard title="Pass Rate" value={`${passRate}%`} />
        <StatCard title="Needs Attention" value={qcRecords.filter((item) => !item.passed).length} />
      </div>

      <div style={panelStyle}>
        <h3>New Quality Check</h3>

        <label>
          Job / RO
          <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} style={inputStyle}>
            <option value="">Select job</option>
            {jobs.slice(0, 200).map((job) => (
              <option key={job.id} value={job.id}>
                {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
              </option>
            ))}
          </select>
        </label>

        {selectedJob && (
          <p>
            <strong>{selectedJob.customer_name}</strong> - {[selectedJob.vehicle_year, selectedJob.vehicle_make, selectedJob.vehicle_model].filter(Boolean).join(" ")}
          </p>
        )}

        <table border="1" cellPadding="8" style={tableStyle}>
          <thead>
            <tr>
              <th>Pass</th>
              <th>Item</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.name}>
                <td style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={item.passed} onChange={(e) => updateItem(index, "passed", e.target.checked)} />
                </td>
                <td>{item.name}</td>
                <td>
                  <input value={item.note} onChange={(e) => updateItem(index, "note", e.target.value)} style={inputStyle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <label>
          Final Note
          <textarea value={finalNote} onChange={(e) => setFinalNote(e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={saveQualityCheck}>Save QC</button>
      </div>

      <h3>Recent QC Records</h3>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Result</th>
            <th>Document</th>
            <th>Customer / Vehicle</th>
            <th>Checked By</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {qcRecords.map((record) => (
            <tr key={record.id}>
              <td>{record.checked_at ? new Date(record.checked_at).toLocaleString() : "-"}</td>
              <td><strong style={{ color: record.passed ? "green" : "red" }}>{record.passed ? "PASS" : "FAIL"}</strong></td>
              <td>{record.document_number || "-"}</td>
              <td>{record.customer_name || "-"}<br /><small>{record.vehicle_name || ""}</small></td>
              <td>{record.checked_by || "-"}</td>
              <td>{record.final_note || "-"}</td>
            </tr>
          ))}
          {qcRecords.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center" }}>No QC records.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse", marginBottom: 12 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default QualityControlManager;
