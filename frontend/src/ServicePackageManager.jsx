import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_PACKAGES = [
  {
    id: "oil_service",
    name: "Oil Change Service",
    category: "Maintenance",
    labor_hours: 0.5,
    labor_rate: 0,
    parts: "Oil filter\nEngine oil",
    price: 0,
    notes: "Basic maintenance package"
  },
  {
    id: "brake_service",
    name: "Front Brake Service",
    category: "Brakes",
    labor_hours: 2,
    labor_rate: 0,
    parts: "Front brake pads\nFront rotors",
    price: 0,
    notes: "Standard front brake package"
  }
];

function ServicePackageManager({ user, canEditEverything }) {
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "",
    labor_hours: "",
    labor_rate: "",
    parts: "",
    price: "",
    notes: ""
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
      if (Array.isArray(parsed) && parsed.length > 0) setPackages(parsed);
    } catch {
      setPackages(DEFAULT_PACKAGES);
    }
  };

  const savePackages = async (nextPackages) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "service_packages_json",
        setting_value: JSON.stringify(nextPackages, null, 2),
        description: "Reusable service package builder records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setPackages(nextPackages);
    return true;
  };

  const addPackage = async () => {
    setMessage("");

    if (!form.name) {
      setMessage("Package name is required.");
      return;
    }

    const pkg = {
      id: `package_${Date.now()}`,
      ...form,
      labor_hours: Number(form.labor_hours || 0),
      labor_rate: Number(form.labor_rate || 0),
      price: Number(form.price || 0),
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await savePackages([pkg, ...packages]);

    if (!saved) return;

    setMessage("Service package saved.");
    setForm({
      name: "",
      category: "",
      labor_hours: "",
      labor_rate: "",
      parts: "",
      price: "",
      notes: ""
    });
  };

  const deletePackage = async (id) => {
    if (!canEditEverything) {
      setMessage("Only Admin/IT can delete packages.");
      return;
    }

    const saved = await savePackages(packages.filter((pkg) => pkg.id !== id));
    if (saved) setMessage("Service package deleted.");
  };

  const copyPackage = async (pkg) => {
    const text = `Service Package: ${pkg.name}
Category: ${pkg.category || "-"}
Labor: ${pkg.labor_hours || 0} hours
Parts:
${pkg.parts || "-"}
Price: $${Number(pkg.price || 0).toFixed(2)}
Notes: ${pkg.notes || "-"}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Package copied.");
    } catch {
      setMessage("Could not copy package.");
    }
  };

  const totalValue = useMemo(
    () => packages.reduce((sum, pkg) => sum + Number(pkg.price || 0), 0),
    [packages]
  );

  return (
    <div>
      <h2>Service Package Builder</h2>

      {message && <p style={{ color: message.includes("saved") || message.includes("copied") || message.includes("deleted") ? "green" : "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Packages" value={packages.length} />
        <StatCard title="Average Price" value={`$${packages.length ? (totalValue / packages.length).toFixed(2) : "0.00"}`} />
      </div>

      <div style={panelStyle}>
        <h3>Add Package</h3>

        <div style={gridStyle}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Category
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Labor Hours
            <input type="number" value={form.labor_hours} onChange={(e) => setForm((p) => ({ ...p, labor_hours: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Labor Rate
            <input type="number" value={form.labor_rate} onChange={(e) => setForm((p) => ({ ...p, labor_rate: e.target.value }))} style={inputStyle} />
          </label>

          <label>
            Package Price
            <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} style={inputStyle} />
          </label>
        </div>

        <label>
          Parts Included
          <textarea value={form.parts} onChange={(e) => setForm((p) => ({ ...p, parts: e.target.value }))} style={textareaStyle} />
        </label>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={textareaStyle} />
        </label>

        <button type="button" onClick={addPackage}>Save Package</button>
      </div>

      <div style={packageGrid}>
        {packages.map((pkg) => (
          <div key={pkg.id} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>{pkg.name}</h3>
            <p><strong>Category:</strong> {pkg.category || "-"}</p>
            <p><strong>Labor:</strong> {pkg.labor_hours || 0} hours</p>
            <p><strong>Price:</strong> ${Number(pkg.price || 0).toFixed(2)}</p>
            <pre style={preStyle}>{pkg.parts || "No parts listed"}</pre>
            <p>{pkg.notes || ""}</p>
            <button type="button" onClick={() => copyPackage(pkg)}>Copy</button>{" "}
            {canEditEverything && <button type="button" onClick={() => deletePackage(pkg.id)}>Delete</button>}
          </div>
        ))}
      </div>
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
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const packageGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
const preStyle = { background: "#f8fafc", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit" };

export default ServicePackageManager;
