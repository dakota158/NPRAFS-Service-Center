import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const COLUMNS = ["To Do", "In Progress", "Waiting", "Done"];

function TaskBoardManager({ user, canEditEverything }) {
  const [tasks, setTasks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: user?.name || user?.email || "",
    due_date: new Date().toISOString().slice(0, 10),
    status: "To Do",
    priority: "Normal",
    invoice_id: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [settingsResult, jobsResult] = await Promise.all([
      supabase.from("app_settings").select("*").eq("setting_key", "shop_tasks_json").maybeSingle(),
      supabase.from("invoices").select("*").order("updated_at", { ascending: false })
    ]);

    if (jobsResult.error) {
      setMessage(jobsResult.error.message);
      return;
    }

    setJobs(jobsResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setTasks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTasks([]);
    }
  };

  const saveTasks = async (nextTasks) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "shop_tasks_json",
        setting_value: JSON.stringify(nextTasks, null, 2),
        description: "Shop task board",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setTasks(nextTasks);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_id") {
        const job = jobs.find((item) => item.id === value);
        if (job && !next.title) {
          next.title = `Follow up ${job.repair_order_number || job.invoice_number || ""}`;
        }
      }

      return next;
    });
  };

  const addTask = async () => {
    setMessage("");

    if (!form.title) {
      setMessage("Task title is required.");
      return;
    }

    const job = jobs.find((item) => item.id === form.invoice_id);

    const task = {
      id: `task_${Date.now()}`,
      ...form,
      document_number: job?.repair_order_number || job?.invoice_number || job?.estimate_number || "",
      customer_name: job?.customer_name || "",
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await saveTasks([task, ...tasks]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Shop Task Created",
      table_name: "app_settings",
      record_id: task.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created task ${task.title}`
    });

    setMessage("Task created.");
    setForm({
      title: "",
      description: "",
      assigned_to: user?.name || user?.email || "",
      due_date: new Date().toISOString().slice(0, 10),
      status: "To Do",
      priority: "Normal",
      invoice_id: ""
    });
  };

  const updateTask = async (taskId, updates) => {
    const nextTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, ...updates, updated_at: new Date().toISOString() } : task
    );

    const saved = await saveTasks(nextTasks);

    if (saved) setMessage("Task updated.");
  };

  const grouped = useMemo(() => {
    const result = {};
    COLUMNS.forEach((col) => {
      result[col] = tasks.filter((task) => task.status === col);
    });
    return result;
  }, [tasks]);

  return (
    <div>
      <h2>Task Board</h2>

      {message && <p style={{ color: message.includes("created") || message.includes("updated") ? "green" : "red" }}>{message}</p>}

      <div style={panelStyle}>
        <h3>Add Task</h3>

        <div style={gridStyle}>
          <label>
            Title
            <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Assigned To
            <input value={form.assigned_to} onChange={(e) => updateForm("assigned_to", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Due Date
            <input type="date" value={form.due_date} onChange={(e) => updateForm("due_date", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)} style={inputStyle}>
              <option>Low</option>
              <option>Normal</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} style={inputStyle}>
              {COLUMNS.map((col) => <option key={col}>{col}</option>)}
            </select>
          </label>

          <label>
            Related Job
            <select value={form.invoice_id} onChange={(e) => updateForm("invoice_id", e.target.value)} style={inputStyle}>
              <option value="">No job</option>
              {jobs.slice(0, 200).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.repair_order_number || job.invoice_number || job.estimate_number} - {job.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addTask}>Add Task</button>
      </div>

      <div style={boardStyle}>
        {COLUMNS.map((column) => (
          <div key={column} style={columnStyle}>
            <h3>{column} ({grouped[column]?.length || 0})</h3>

            {(grouped[column] || []).map((task) => (
              <div key={task.id} style={taskCardStyle}>
                <strong>{task.title}</strong>
                <p style={{ margin: "6px 0" }}>{task.description || "-"}</p>
                <small>
                  {task.priority} | Due {task.due_date || "-"} | {task.assigned_to || "Unassigned"}
                </small>
                {task.document_number && (
                  <small style={{ display: "block" }}>
                    {task.document_number} - {task.customer_name}
                  </small>
                )}

                <select
                  value={task.status}
                  onChange={(e) => updateTask(task.id, { status: e.target.value })}
                  style={{ ...inputStyle, marginTop: 8 }}
                >
                  {COLUMNS.map((col) => <option key={col}>{col}</option>)}
                </select>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const boardStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 };
const columnStyle = { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 };
const taskCardStyle = { background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 10 };

export default TaskBoardManager;
