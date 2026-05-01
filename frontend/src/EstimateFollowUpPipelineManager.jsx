import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Not Contacted", "Left Message", "Contacted", "Needs Review", "Won", "Lost", "Do Not Contact"];

function EstimateFollowUpPipelineManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [message, setMessage] = useState("");
  const [daysBack, setDaysBack] = useState("60");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [docsResult, followResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*").eq("setting_key", "estimate_followup_pipeline_json").maybeSingle()
    ]);

    if (docsResult.error) {
      setMessage(docsResult.error.message);
      return;
    }

    setDocuments(docsResult.data || []);

    try {
      const parsed = JSON.parse(followResult.data?.setting_value || "[]");
      setFollowUps(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFollowUps([]);
    }
  };

  const saveFollowUps = async (nextFollowUps) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "estimate_followup_pipeline_json",
        setting_value: JSON.stringify(nextFollowUps, null, 2),
        description: "Estimate follow-up pipeline records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setFollowUps(nextFollowUps);
    return true;
  };

  const estimates = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysBack || 60));

    return documents
      .filter((doc) => doc.document_status === "Estimate" || doc.estimate_number)
      .filter((doc) => {
        const created = doc.created_at ? new Date(doc.created_at) : null;
        return !created || created >= cutoff;
      });
  }, [documents, daysBack]);

  const rows = useMemo(() => {
    return estimates.map((estimate) => {
      const existing = followUps.find((item) => item.invoice_id === estimate.id);
      return {
        ...estimate,
        followup: existing || {
          status: "Not Contacted",
          next_follow_up_date: "",
          last_contact_date: "",
          notes: ""
        }
      };
    });
  }, [estimates, followUps]);

  const updateFollowUp = async (estimate, updates) => {
    const existing = followUps.find((item) => item.invoice_id === estimate.id);

    const record = {
      id: existing?.id || `estimate_follow_${Date.now()}`,
      invoice_id: estimate.id,
      document_number: estimate.estimate_number || estimate.invoice_number || estimate.repair_order_number || "",
      customer_name: estimate.customer_name || "",
      amount: Number(estimate.grand_total || 0),
      ...existing,
      ...updates,
      updated_by: user?.id || null,
      updated_by_email: user?.email || "",
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString()
    };

    const next = existing
      ? followUps.map((item) => (item.id === existing.id ? record : item))
      : [record, ...followUps];

    const saved = await saveFollowUps(next);
    if (saved) setMessage("Follow-up updated.");
  };

  const copyFollowUp = async (row) => {
    const text = `Hello ${row.customer_name || ""},

We are following up on estimate ${row.estimate_number || row.invoice_number || ""} for $${Number(row.grand_total || 0).toFixed(2)}.

Please let us know if you have any questions or would like to schedule the work.

Thank you.`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Follow-up message copied.");
    } catch {
      setMessage("Could not copy message.");
    }
  };

  const pipelineTotals = useMemo(() => {
    const totals = {};
    rows.forEach((row) => {
      const status = row.followup.status || "Not Contacted";
      totals[status] = (totals[status] || 0) + Number(row.grand_total || 0);
    });
    return totals;
  }, [rows]);

  return (
    <div>
      <h2>Estimate Follow-Up Pipeline</h2>

      {message && <p style={{ color: message.includes("updated") || message.includes("copied") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <label>
          Days Back
          <input type="number" value={daysBack} onChange={(e) => setDaysBack(e.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={loadAll}>Refresh</button>
      </div>

      <div style={cardGrid}>
        <StatCard title="Estimates" value={rows.length} />
        <StatCard title="Open Value" value={`$${rows.reduce((s, r) => s + Number(r.grand_total || 0), 0).toFixed(2)}`} />
        <StatCard title="Won Value" value={`$${Number(pipelineTotals.Won || 0).toFixed(2)}`} />
        <StatCard title="Lost Value" value={`$${Number(pipelineTotals.Lost || 0).toFixed(2)}`} />
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Estimate</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Last Contact</th>
            <th>Next Follow-Up</th>
            <th>Notes</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <select value={row.followup.status} onChange={(e) => updateFollowUp(row, { status: e.target.value })} style={inputStyle}>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
              <td>{row.estimate_number || row.invoice_number || "-"}</td>
              <td>{row.customer_name || "-"}</td>
              <td>${Number(row.grand_total || 0).toFixed(2)}</td>
              <td>
                <input
                  type="date"
                  value={row.followup.last_contact_date || ""}
                  onChange={(e) => updateFollowUp(row, { last_contact_date: e.target.value })}
                  style={inputStyle}
                />
              </td>
              <td>
                <input
                  type="date"
                  value={row.followup.next_follow_up_date || ""}
                  onChange={(e) => updateFollowUp(row, { next_follow_up_date: e.target.value })}
                  style={inputStyle}
                />
              </td>
              <td>
                <input
                  value={row.followup.notes || ""}
                  onChange={(e) => updateFollowUp(row, { notes: e.target.value })}
                  style={inputStyle}
                />
              </td>
              <td><button type="button" onClick={() => copyFollowUp(row)}>Copy</button></td>
            </tr>
          ))}

          {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center" }}>No estimates found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default EstimateFollowUpPipelineManager;
