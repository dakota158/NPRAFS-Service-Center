import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_NOTES = [
  {
    version: "Phase 7",
    date: new Date().toISOString().slice(0, 10),
    notes: [
      "Added permissions matrix",
      "Added KPI goals",
      "Added data backup export",
      "Added notification center",
      "Added release notes screen"
    ]
  },
  {
    version: "Phase 6",
    date: "",
    notes: [
      "Added expenses",
      "Added profit reports",
      "Added purchase planning",
      "Added VIN helper",
      "Added barcode labels"
    ]
  }
];

function ReleaseNotesManager({ user }) {
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "release_notes_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        setNotes(parsed);
      }
    } catch {
      setNotes(DEFAULT_NOTES);
    }
  };

  const saveDefaultNotes = async () => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "release_notes_json",
        setting_value: JSON.stringify(notes, null, 2),
        description: "Application release notes",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Release notes saved.");
  };

  return (
    <div>
      <h2>Release Notes</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <button type="button" onClick={saveDefaultNotes} style={{ marginBottom: 12 }}>
        Save Release Notes To Settings
      </button>

      {notes.map((release, index) => (
        <div key={`${release.version}-${index}`} style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>{release.version}</h3>
          {release.date && <p>{release.date}</p>}
          <ul>
            {(release.notes || []).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

export default ReleaseNotesManager;
