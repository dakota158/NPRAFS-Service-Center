import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_ITEMS = [
  "Exterior lights",
  "Wipers / washers",
  "Tires / tread",
  "Brakes",
  "Battery / charging",
  "Fluids",
  "Belts / hoses",
  "Leaks",
  "Suspension / steering",
  "Road test"
];

function InspectionManager({ user }) {
  const [jobs, setJobs] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [items, setItems] = useState(
    DEFAULT_ITEMS.map((name) => ({
      name,
      status: "OK",
      note: ""
    }))
  );

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [jobsResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "inspection_reports_json")
        .maybeSingle()
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setInspections(Array.isArray(parsed) ? parsed : []);
    } catch {
      setInspections([]);
    }
  };

  const saveInspections = async (nextInspections) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "inspection_reports_json",
        setting_value: JSON.stringify(nextInspections, null, 2),
        description: "Vehicle inspection reports",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setInspections(nextInspections);
    return true;
  };

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId),
    [jobs, selectedJobId]
  );

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addCustomItem = () => {
    setItems((prev) => [...prev, { name: "Custom Check", status: "OK", note: "" }]);
  };

  const saveInspection = async () => {
    setMessage("");

    if (!selectedJob) {
      setMessage("Select a job/vehicle first.");
      return;
    }

    const report = {
      id: `inspection_${Date.now()}`,
      invoice_id: selectedJob.id,
      document_number:
        selectedJob.repair_order_number ||
        selectedJob.invoice_number ||
        selectedJob.estimate_number ||
        "",
      customer_name: selectedJob.customer_name || "",
      vehicle_name: [selectedJob.vehicle_year, selectedJob.vehicle_make, selectedJob.vehicle_model]
        .filter(Boolean)
        .join(" "),
      vin: selectedJob.vehicle_vin || "",
      mileage: selectedJob.vehicle_mileage || "",
      items,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveInspections([report, ...inspections]);

    if (!saved) return;

    const recommendationText = items
      .filter((item) => item.status === "Needs Attention" || item.status === "Fail")
      .map((item) => `${item.name}: ${item.note || item.status}`)
      .join("\n");

    if (recommendationText) {
      await supabase
        .from("invoices")
        .update({
          technician_notes: [
            selectedJob.technician_notes || "",
            "Inspection Recommendations:",
            recommendationText
          ]
            .filter(Boolean)
            .join("\n"),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedJob.id);
    }

    await supabase.from("audit_logs").insert({
      action: "Inspection Saved",
      table_name: "app_settings",
      record_id: report.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Saved inspection for ${report.document_number || report.vehicle_name}`
    });

    setMessage("Inspection saved.");
    setItems(
      DEFAULT_ITEMS.map((name) => ({
        name,
        status: "OK",
        note: ""
      }))
    );
  };

  const getInspectionSummary = (report) => {
    const fail = report.items.filter((item) => item.status === "Fail").length;
    const attention = report.items.filter((item) => item.status === "Needs Attention").length;

    if (fail) return `${fail} fail / ${attention} attention`;
    if (attention) return `${attention} needs attention`;
    return "All OK";
  };

  return (
    <div>
      <h2>Vehicle Inspections</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Create Inspection</h3>

        <label>
          Job / Vehicle
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select job</option>
            {jobs.slice(0, 200).map((job) => (
              <option key={job.id} value={job.id}>
                {job.repair_order_number || job.invoice_number || job.estimate_number} -{" "}
                {job.customer_name || "Customer"} -{" "}
                {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </label>

        {selectedJob && (
          <p>
            <strong>{selectedJob.customer_name}</strong> -{" "}
            {[selectedJob.vehicle_year, selectedJob.vehicle_make, selectedJob.vehicle_model]
              .filter(Boolean)
              .join(" ")}
          </p>
        )}

        <table border="1" cellPadding="8" style={tableStyle}>
          <thead>
            <tr>
              <th>Check Item</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.name}-${index}`}>
                <td>
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td>
                  <select
                    value={item.status}
                    onChange={(e) => updateItem(index, "status", e.target.value)}
                    style={inputStyle}
                  >
                    <option value="OK">OK</option>
                    <option value="Needs Attention">Needs Attention</option>
                    <option value="Fail">Fail</option>
                    <option value="N/A">N/A</option>
                  </select>
                </td>
                <td>
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(index, "note", e.target.value)}
                    style={inputStyle}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="button" onClick={addCustomItem}>
          Add Check Item
        </button>{" "}
        <button type="button" onClick={saveInspection}>
          Save Inspection
        </button>
      </div>

      <h3>Inspection History</h3>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Document</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Summary</th>
          </tr>
        </thead>

        <tbody>
          {inspections.map((report) => (
            <tr key={report.id}>
              <td>{report.created_at ? new Date(report.created_at).toLocaleString() : "-"}</td>
              <td>{report.document_number || "-"}</td>
              <td>{report.customer_name || "-"}</td>
              <td>{report.vehicle_name || "-"}</td>
              <td>{getInspectionSummary(report)}</td>
            </tr>
          ))}

          {inspections.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center" }}>
                No inspections yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse", marginBottom: 12 };

export default InspectionManager;
