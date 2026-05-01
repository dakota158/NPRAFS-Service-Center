import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUSES = ["Draft", "Counting", "Review", "Completed"];

function CycleCountManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [counts, setCounts] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    count_name: "",
    zone: "",
    status: "Draft",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, settingsResult] = await Promise.all([
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("app_settings").select("*").eq("setting_key", "cycle_counts_json").maybeSingle()
    ]);

    if (partsResult.error) {
      setMessage(partsResult.error.message);
      return;
    }

    setParts(partsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setCounts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCounts([]);
    }
  };

  const saveCounts = async (nextCounts) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "cycle_counts_json",
        setting_value: JSON.stringify(nextCounts, null, 2),
        description: "Inventory cycle count records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setCounts(nextCounts);
    return true;
  };

  const createCount = async () => {
    setMessage("");

    if (!canEditEverything) {
      setMessage("Only Admin/IT can create cycle counts.");
      return;
    }

    if (!form.count_name) {
      setMessage("Count name is required.");
      return;
    }

    const count = {
      id: `count_${Date.now()}`,
      ...form,
      items: parts.map((part) => ({
        part_id: part.id,
        part_number: part.part_number || "",
        description: part.name || "",
        system_qty: Number(part.quantity || 0),
        counted_qty: "",
        variance: 0,
        note: ""
      })),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveCounts([count, ...counts]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Cycle Count Created",
      table_name: "app_settings",
      record_id: count.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${count.count_name} with ${count.items.length} parts`
    });

    setMessage("Cycle count created.");
    setForm({
      count_name: "",
      zone: "",
      status: "Draft",
      notes: ""
    });
  };

  const updateCount = async (countId, updates) => {
    const next = counts.map((count) =>
      count.id === countId ? { ...count, ...updates, updated_at: new Date().toISOString() } : count
    );

    const saved = await saveCounts(next);
    if (saved) setMessage("Cycle count updated.");
  };

  const updateCountItem = async (countId, partId, field, value) => {
    const next = counts.map((count) => {
      if (count.id !== countId) return count;

      const items = (count.items || []).map((item) => {
        if (item.part_id !== partId) return item;

        const nextItem = { ...item, [field]: value };
        nextItem.variance = Number(nextItem.counted_qty || 0) - Number(nextItem.system_qty || 0);
        return nextItem;
      });

      return { ...count, items, updated_at: new Date().toISOString() };
    });

    const saved = await saveCounts(next);
    if (saved) setMessage("Count item updated.");
  };

  const applyCompletedCount = async (count) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can apply count adjustments.");
      return;
    }

    const items = (count.items || []).filter((item) => item.counted_qty !== "");

    for (const item of items) {
      await supabase.from("parts").update({
        quantity: Number(item.counted_qty || 0)
      }).eq("id", item.part_id);
    }

    await updateCount(count.id, {
      status: "Completed",
      applied_at: new Date().toISOString(),
      applied_by: user?.email || ""
    });

    await supabase.from("audit_logs").insert({
      action: "Cycle Count Applied",
      table_name: "parts",
      record_id: count.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Applied ${items.length} cycle count adjustments`
    });

    setMessage("Cycle count applied to inventory.");
    loadAll();
  };

  const openCounts = counts.filter((count) => count.status !== "Completed");

  return (
    <div>
      <h2>Inventory Cycle Counts</h2>

      {message && <p style={{ color: message.includes("created") || message.includes("updated") || message.includes("applied") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Open Counts" value={openCounts.length} />
        <StatCard title="Completed" value={counts.filter((count) => count.status === "Completed").length} />
        <StatCard title="Parts" value={parts.length} />
      </div>

      <div style={panelStyle}>
        <h3>Create Count</h3>

        <div style={gridStyle}>
          <label>
            Count Name
            <input value={form.count_name} onChange={(e) => setForm((p) => ({ ...p, count_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Zone / Area
            <input value={form.zone} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={createCount} disabled={!canEditEverything}>Create Cycle Count</button>
      </div>

      {counts.map((count) => (
        <div key={count.id} style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>{count.count_name}</h3>
          <p><strong>Status:</strong> {count.status} | <strong>Zone:</strong> {count.zone || "-"}</p>

          <select value={count.status} onChange={(e) => updateCount(count.id, { status: e.target.value })} style={{ ...inputStyle, maxWidth: 240 }}>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>

          <table border="1" cellPadding="8" style={tableStyle}>
            <thead>
              <tr>
                <th>Part #</th>
                <th>Description</th>
                <th>System Qty</th>
                <th>Counted Qty</th>
                <th>Variance</th>
                <th>Note</th>
              </tr>
            </thead>

            <tbody>
              {(count.items || []).slice(0, 100).map((item) => (
                <tr key={item.part_id}>
                  <td>{item.part_number || "-"}</td>
                  <td>{item.description || "-"}</td>
                  <td>{item.system_qty}</td>
                  <td>
                    <input
                      type="number"
                      value={item.counted_qty}
                      onChange={(e) => updateCountItem(count.id, item.part_id, "counted_qty", e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ color: Number(item.variance || 0) === 0 ? "green" : "red" }}>
                    {item.variance}
                  </td>
                  <td>
                    <input
                      value={item.note || ""}
                      onChange={(e) => updateCountItem(count.id, item.part_id, "note", e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {count.status !== "Completed" && (
            <button type="button" onClick={() => applyCompletedCount(count)} disabled={!canEditEverything}>
              Apply Count To Inventory
            </button>
          )}
        </div>
      ))}
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
const tableStyle = { width: "100%", borderCollapse: "collapse", marginTop: 12, marginBottom: 12 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default CycleCountManager;
