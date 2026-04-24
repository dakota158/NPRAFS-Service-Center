import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function CompanyInfo({ canEditEverything }) {
  const [companyInfo, setCompanyInfo] = useState({
    id: "",
    name: "",
    address: "",
    phone_number: "",
    logo_url: "",
    main_contact_email: ""
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fallbackLogoPath = `${process.env.PUBLIC_URL}/favicon.ico`;

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("company_info")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Company info load error:", error);
      setMessage(`Could not load company info: ${error.message}`);
      setLoading(false);
      return;
    }

    if (data) {
      const loadedInfo = {
        id: data.id || "",
        name: data.name || "",
        address: data.address || "",
        phone_number: data.phone_number || "",
        logo_url: data.logo_url || "",
        main_contact_email: data.main_contact_email || ""
      };

      setCompanyInfo(loadedInfo);
      setLogoPreview(loadedInfo.logo_url || fallbackLogoPath);
    } else {
      setCompanyInfo({
        id: "",
        name: "",
        address: "",
        phone_number: "",
        logo_url: "",
        main_contact_email: ""
      });

      setLogoPreview(fallbackLogoPath);
    }

    setLoading(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setCompanyInfo((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setLogoFile(null);
      setLogoPreview(companyInfo.logo_url || fallbackLogoPath);
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogoIfNeeded = async () => {
    if (!logoFile) {
      return companyInfo.logo_url || "";
    }

    const fileExt = logoFile.name.split(".").pop();
    const cleanFileExt = fileExt ? fileExt.toLowerCase() : "png";
    const fileName = `company-logo-${Date.now()}.${cleanFileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(fileName, logoFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: logoFile.type || "image/png"
      });

    if (uploadError) {
      console.error("Logo upload error:", uploadError);
      throw new Error(uploadError.message || "Logo upload failed.");
    }

    const { data } = supabase.storage
      .from("company-logos")
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      throw new Error("Logo uploaded, but public URL could not be created.");
    }

    return data.publicUrl;
  };

  const saveCompanyInfo = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!canEditEverything) {
      setMessage("You do not have permission to edit company info.");
      return;
    }

    setSaving(true);

    try {
      const logoUrl = await uploadLogoIfNeeded();

      const payload = {
        name: companyInfo.name,
        address: companyInfo.address,
        phone_number: companyInfo.phone_number,
        logo_url: logoUrl,
        main_contact_email: companyInfo.main_contact_email,
        updated_at: new Date().toISOString()
      };

      let result;

      if (companyInfo.id) {
        result = await supabase
          .from("company_info")
          .update(payload)
          .eq("id", companyInfo.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("company_info")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) {
        console.error("Company info save error:", result.error);
        setMessage(`Could not save company info: ${result.error.message}`);
        setSaving(false);
        return;
      }

      const savedInfo = {
        id: result.data.id || "",
        name: result.data.name || "",
        address: result.data.address || "",
        phone_number: result.data.phone_number || "",
        logo_url: result.data.logo_url || "",
        main_contact_email: result.data.main_contact_email || ""
      };

      setCompanyInfo(savedInfo);
      setLogoPreview(savedInfo.logo_url || fallbackLogoPath);
      setLogoFile(null);
      setMessage("Company info saved.");

      await loadCompanyInfo();
    } catch (err) {
      console.error("Company info save crash:", err);
      setMessage(err.message || "Something went wrong saving company info.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <h2>Company Info</h2>
        <p>Loading company info...</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Company Info</h2>

      {!canEditEverything && (
        <p style={{ color: "red" }}>
          View only. Only Admin and IT accounts can edit company info.
        </p>
      )}

      {message && (
        <p
          style={{
            color: message.includes("saved") ? "green" : "red",
            fontWeight: "bold"
          }}
        >
          {message}
        </p>
      )}

      <form onSubmit={saveCompanyInfo}>
        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Name</strong>
          </label>
          <br />
          <input
            type="text"
            name="name"
            value={companyInfo.name}
            onChange={handleChange}
            disabled={!canEditEverything}
            style={inputStyle}
            placeholder="Company name"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Address</strong>
          </label>
          <br />
          <textarea
            name="address"
            value={companyInfo.address}
            onChange={handleChange}
            disabled={!canEditEverything}
            rows={4}
            style={inputStyle}
            placeholder="Company address"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Phone Number</strong>
          </label>
          <br />
          <input
            type="text"
            name="phone_number"
            value={companyInfo.phone_number}
            onChange={handleChange}
            disabled={!canEditEverything}
            style={inputStyle}
            placeholder="Company phone number"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Main Contact Email</strong>
          </label>
          <br />
          <input
            type="email"
            name="main_contact_email"
            value={companyInfo.main_contact_email}
            onChange={handleChange}
            disabled={!canEditEverything}
            style={inputStyle}
            placeholder="Main contact email"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Logo</strong>
          </label>
          <br />

          {logoPreview ? (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <img
                src={logoPreview}
                alt="Company Logo"
                style={{
                  maxWidth: 220,
                  maxHeight: 140,
                  objectFit: "contain",
                  border: "1px solid #ccc",
                  padding: 8,
                  borderRadius: 10,
                  background: "#fff"
                }}
              />
            </div>
          ) : (
            <p>No logo uploaded.</p>
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/x-icon"
            onChange={handleLogoChange}
            disabled={!canEditEverything}
            style={{
              display: "block",
              marginTop: 8
            }}
          />
        </div>

        {canEditEverything && (
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Company Info"}
          </button>
        )}
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  maxWidth: 500,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  background: "#fff",
  color: "#111827"
};

export default CompanyInfo;