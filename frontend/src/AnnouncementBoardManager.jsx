import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

function AnnouncementBoardManager({ user, canEditEverything }) {
  const [announcements, setAnnouncements] = useState([]);
  const [message, setMessage] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "Normal",
    expires_at: "",
    pinned: false
  });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "announcement_board_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      setAnnouncements(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAnnouncements([]);
    }
  };

  const saveAnnouncements = async (nextAnnouncements) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "announcement_board_json",
        setting_value: JSON.stringify(nextAnnouncements, null, 2),
        description: "Internal shop announcement board",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setAnnouncements(nextAnnouncements);
    return true;
  };

  const addAnnouncement = async () => {
    setMessage("");

    if (!form.title || !form.body) {
      setMessage("Title and message are required.");
      return;
    }

    const announcement = {
      id: `announcement_${Date.now()}`,
      ...form,
      archived: false,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveAnnouncements([announcement, ...announcements]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Announcement Created",
      table_name: "app_settings",
      record_id: announcement.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: announcement.title
    });

    setMessage("Announcement posted.");
    setForm({
      title: "",
      body: "",
      priority: "Normal",
      expires_at: "",
      pinned: false
    });
  };

  const updateAnnouncement = async (id, updates) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can edit announcements.");
      return;
    }

    const next = announcements.map((item) =>
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    );

    const saved = await saveAnnouncements(next);
    if (saved) setMessage("Announcement updated.");
  };

  const visibleAnnouncements = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return announcements
      .filter((item) => (showArchived ? true : !item.archived))
      .filter((item) => !item.expires_at || item.expires_at >= today || showArchived)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return String(b.created_at).localeCompare(String(a.created_at));
      });
  }, [announcements, showArchived]);

  return (
    <div>
      <h2>Internal Announcement Board</h2>

      {message && (
        <p style={{ color: message.includes("posted") || message.includes("updated") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Post Announcement</h3>

        <div style={gridStyle}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} style={inputStyle}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>

          <label>
            Expires
            <input type="date" value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))} style={inputStyle} />
          </label>

          <label style={{ marginTop: 28 }}>
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))} /> Pinned
          </label>
        </div>

        <label>
          Message
          <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addAnnouncement}>Post Announcement</button>
      </div>

      <label style={{ display: "block", marginBottom: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived/expired
      </label>

      <div style={cardGrid}>
        {visibleAnnouncements.map((announcement) => (
          <div key={announcement.id} style={announcementCardStyle}>
            <h3 style={{ marginTop: 0 }}>
              {announcement.pinned ? "📌 " : ""}
              {announcement.title}
            </h3>
            <p><strong>{announcement.priority}</strong> | {announcement.created_by_email || ""}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{announcement.body}</p>
            {announcement.expires_at && <small>Expires: {announcement.expires_at}</small>}
            <br />
            {canEditEverything && (
              <>
                <button type="button" onClick={() => updateAnnouncement(announcement.id, { archived: !announcement.archived })} style={{ marginTop: 8 }}>
                  {announcement.archived ? "Unarchive" : "Archive"}
                </button>{" "}
                <button type="button" onClick={() => updateAnnouncement(announcement.id, { pinned: !announcement.pinned })} style={{ marginTop: 8 }}>
                  {announcement.pinned ? "Unpin" : "Pin"}
                </button>
              </>
            )}
          </div>
        ))}

        {visibleAnnouncements.length === 0 && <p>No announcements.</p>}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 90, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 };
const announcementCardStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14 };

export default AnnouncementBoardManager;
