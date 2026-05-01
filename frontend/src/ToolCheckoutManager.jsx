import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function ToolCheckoutManager({ user }) {
  const [tools, setTools] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    tool_name: "",
    tool_number: "",
    category: "",
    location: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [settingsResult, profilesResult] = await Promise.all([
      supabase.from("app_settings").select("*").eq("setting_key", "shop_tools_json").maybeSingle(),
      supabase.from("profiles").select("*").order("name", { ascending: true })
    ]);

    if (profilesResult.error) {
      setMessage(profilesResult.error.message);
      return;
    }

    setProfiles(profilesResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setTools(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTools([]);
    }
  };

  const saveTools = async (nextTools) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "shop_tools_json",
        setting_value: JSON.stringify(nextTools, null, 2),
        description: "Tool and equipment checkout records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setTools(nextTools);
    return true;
  };

  const addTool = async () => {
    setMessage("");

    if (!form.tool_name) {
      setMessage("Tool name is required.");
      return;
    }

    const tool = {
      id: `tool_${Date.now()}`,
      ...form,
      status: "Available",
      checked_out_to: "",
      checked_out_at: "",
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveTools([tool, ...tools]);

    if (!saved) return;

    setMessage("Tool added.");
    setForm({
      tool_name: "",
      tool_number: "",
      category: "",
      location: "",
      notes: ""
    });
  };

  const checkoutTool = async (toolId, technician) => {
    const nextTools = tools.map((tool) =>
      tool.id === toolId
        ? {
            ...tool,
            status: "Checked Out",
            checked_out_to: technician,
            checked_out_at: new Date().toISOString()
          }
        : tool
    );

    const saved = await saveTools(nextTools);

    if (saved) {
      await supabase.from("audit_logs").insert({
        action: "Tool Checked Out",
        table_name: "app_settings",
        record_id: toolId,
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `Tool checked out to ${technician}`
      });

      setMessage("Tool checked out.");
    }
  };

  const returnTool = async (toolId) => {
    const nextTools = tools.map((tool) =>
      tool.id === toolId
        ? {
            ...tool,
            status: "Available",
            checked_out_to: "",
            checked_out_at: "",
            returned_at: new Date().toISOString()
          }
        : tool
    );

    const saved = await saveTools(nextTools);

    if (saved) {
      setMessage("Tool returned.");
    }
  };

  const checkedOut = useMemo(() => tools.filter((tool) => tool.status === "Checked Out"), [tools]);

  return (
    <div>
      <h2>Tool / Equipment Checkout</h2>

      {message && (
        <p style={{ color: message.includes("added") || message.includes("returned") || message.includes("checked") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Tools" value={tools.length} />
        <StatCard title="Available" value={tools.filter((tool) => tool.status === "Available").length} />
        <StatCard title="Checked Out" value={checkedOut.length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Tool</h3>

        <div style={gridStyle}>
          <label>
            Tool Name
            <input value={form.tool_name} onChange={(e) => setForm((p) => ({ ...p, tool_name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Tool #
            <input value={form.tool_number} onChange={(e) => setForm((p) => ({ ...p, tool_number: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Location
            <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addTool}>Add Tool</button>
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Tool</th>
            <th>Category</th>
            <th>Location</th>
            <th>Checked Out To</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {tools.map((tool) => (
            <tr key={tool.id}>
              <td>{tool.status}</td>
              <td><strong>{tool.tool_name}</strong><br /><small>{tool.tool_number || ""}</small></td>
              <td>{tool.category || "-"}</td>
              <td>{tool.location || "-"}</td>
              <td>{tool.checked_out_to || "-"}</td>
              <td>
                {tool.status === "Checked Out" ? (
                  <button type="button" onClick={() => returnTool(tool.id)}>Return</button>
                ) : (
                  <select onChange={(e) => e.target.value && checkoutTool(tool.id, e.target.value)} defaultValue="" style={inputStyle}>
                    <option value="">Checkout to...</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.name || profile.email}>
                        {profile.name || profile.email}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}

          {tools.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center" }}>No tools added.</td></tr>}
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
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default ToolCheckoutManager;
