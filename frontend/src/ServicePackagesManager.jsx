import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_PACKAGES = [
  {
    id: "diagnostic",
    name: "Diagnostic",
    labor_description: "Diagnostic Labor",
    hours: 1,
    suggested_parts: []
  },
  {
    id: "front_brakes",
    name: "Front Brake Job",
    labor_description: "Front Brakes R&R",
    hours: 2,
    suggested_parts: ["Brake Pads", "Brake Rotors", "Brake Cleaner"]
  },
  {
    id: "oil_change",
    name: "Oil Change",
    labor_description: "Oil Change Service",
    hours: 0.5,
    suggested_parts: ["Oil Filter", "Engine Oil"]
  }
];

function ServicePackagesManager({ user, canEditEverything }) {
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    labor_description: "",
    hours: "",
    suggested_parts: ""
  });

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("setting_key", "service_packages_json")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      const parsed = JSON.parse(data?.setting_value || "[]");

      if (Array.isArray(parsed) && parsed.length > 0) {
        setPackages(parsed);
      }
    } catch {
      setPackages(DEFAULT_PACKAGES);
    }
  };

  const savePackages = async (nextPackages) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "service_packages_json",
        setting_value: JSON.stringify(nextPackages, null, 2),
        description: "Reusable service package templates",
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "setting_key"
      }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setPackages(nextPackages);
    setMessage("Service packages saved.");
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const addPackage = async () => {
    setMessage("");

    if (!form.name || !form.labor_description) {
      setMessage("Package name and labor description are required.");
      return;
    }

    const nextPackage = {
      id: `pkg_${Date.now()}`,
      name: form.name,
      labor_description: form.labor_description,
      hours: Number(form.hours || 0),
      suggested_parts: form.suggested_parts
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    };

    const nextPackages = [...packages, nextPackage];

    const saved = await savePackages(nextPackages);

    if (saved) {
      await supabase.from("audit_logs").insert({
        action: "Service Package Created",
        table_name: "app_settings",
        record_id: "service_packages_json",
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `Created service package ${form.name}`
      });

      setForm({
        name: "",
        labor_description: "",
        hours: "",
        suggested_parts: ""
      });
    }
  };

  const deletePackage = async (packageId) => {
    if (!canEditEverything) {
      setMessage("Only Admin and IT can delete service packages.");
      return;
    }

    const nextPackages = packages.filter((item) => item.id !== packageId);
    await savePackages(nextPackages);
  };

  const packageText = useMemo(
    () =>
      packages
        .map(
          (item) =>
            `${item.name}: Labor - ${item.labor_description} - ${item.hours} Hours${
              item.suggested_parts?.length
                ? ` | Parts: ${item.suggested_parts.join(", ")}`
                : ""
            }`
        )
        .join("\n"),
    [packages]
  );

  const copyPackages = async () => {
    try {
      await navigator.clipboard.writeText(packageText);
      setMessage("Package list copied.");
    } catch {
      setMessage("Could not copy package list.");
    }
  };

  return (
    <div>
      <h2>Service Packages</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("copied") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Add Common Job Template</h3>

        <div style={gridStyle}>
          <label>
            Package Name
            <input
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Front Brake Job"
              style={inputStyle}
            />
          </label>

          <label>
            Labor Description
            <input
              value={form.labor_description}
              onChange={(e) => updateForm("labor_description", e.target.value)}
              placeholder="Brakes R&R"
              style={inputStyle}
            />
          </label>

          <label>
            Labor Hours
            <input
              type="number"
              value={form.hours}
              onChange={(e) => updateForm("hours", e.target.value)}
              placeholder="2"
              style={inputStyle}
            />
          </label>

          <label>
            Suggested Parts
            <input
              value={form.suggested_parts}
              onChange={(e) => updateForm("suggested_parts", e.target.value)}
              placeholder="Brake Pads, Rotors"
              style={inputStyle}
            />
          </label>
        </div>

        <button type="button" onClick={addPackage}>
          Add Service Package
        </button>{" "}
        <button type="button" onClick={copyPackages}>
          Copy Package List
        </button>
      </div>

      <div style={cardGrid}>
        {packages.map((item) => (
          <div key={item.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{item.name}</h3>
            <p>
              <strong>Labor:</strong> {item.labor_description}
            </p>
            <p>
              <strong>Hours:</strong> {item.hours}
            </p>
            <p>
              <strong>Suggested Parts:</strong>{" "}
              {item.suggested_parts?.length
                ? item.suggested_parts.join(", ")
                : "None"}
            </p>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: 10,
                borderRadius: 8,
                whiteSpace: "pre-wrap"
              }}
            >
              Labor - {item.labor_description} - {item.hours} Hours
              {item.suggested_parts?.map((part) => (
                <div key={part}>-- Parts - {part}</div>
              ))}
            </div>

            {canEditEverything && (
              <button
                type="button"
                onClick={() => deletePackage(item.id)}
                style={{ marginTop: 10 }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  boxSizing: "border-box",
  marginTop: 4
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12
};

const panelStyle = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 18
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12
};

export default ServicePackagesManager;
