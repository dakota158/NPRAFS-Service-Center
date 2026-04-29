import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
// --- ADDED START ---
import PdfLayoutDesigner from "./PdfLayoutDesigner";
// --- ADDED END ---

function SettingsManager({ user, activeSettingsTab = "Settings General" }) {
  const role = user?.role || "Tech";

  const canEditSettings =
    role === "IT" || role === "admin" || role === "Admin";

  const [message, setMessage] = useState("");
  const [laborRates, setLaborRates] = useState([]);
  const [markupTiers, setMarkupTiers] = useState([]);

  // --- ADDED START ---
  const [pdfDesignerOpen, setPdfDesignerOpen] = useState(false);
  // --- ADDED END ---

  const [settings, setSettings] = useState({
    tax_rate: "0",
    tax_enabled: "true",
    tax_labor_enabled: "true",
    tax_parts_enabled: "true",
    tax_shop_fee_enabled: "true",
    tax_exempt_enabled: "true",
    tax_exempt_reason_required: "true",
    tax_label: "Sales Tax",

    shop_fee_enabled: "true",
    shop_fee_type: "percent",
    shop_fee_value: "0",
    shop_fee_taxable: "true",
    shop_fee_minimum: "0",
    shop_fee_maximum: "0",
    shop_fee_label: "Shop Supplies",
    shop_fee_override_enabled: "true",

    company_name: "NPRAFS Service Center",
    company_address: "",
    company_phone: "",
    company_email: "",
    company_website: "",
    company_logo_url: "",

    invoice_enabled: "true",
    invoice_title: "INVOICE",
    invoice_disclaimer: "",
    invoice_require_customer_name: "true",
    invoice_require_vehicle_info: "false",
    invoice_require_vin: "false",
    invoice_auto_number_enabled: "true",
    invoice_number_prefix: "INV",
    invoice_next_number: "1001",
    invoice_manual_number_override: "true",
    invoice_save_before_pdf_required: "false",
    invoice_edit_saved_enabled: "true",
    invoice_delete_enabled: "false",
    invoice_void_enabled: "true",
    invoice_void_reason_required: "true",
    invoice_statuses: "Draft,Sent,Paid,Partial,Void",
    invoice_payment_tracking_enabled: "true",
    invoice_payment_methods: "Cash,Check,Credit Card,Debit Card,ACH,Other",
    invoice_partial_payments_enabled: "true",
    invoice_due_date_enabled: "true",
    invoice_default_payment_terms: "Due on Receipt",
    invoice_customer_signature_enabled: "false",
    invoice_technician_notes_enabled: "true",
    invoice_internal_notes_enabled: "true",
    invoice_estimate_conversion_enabled: "false",
        invoice_labor_enabled: "true",
    invoice_parts_enabled: "true",
    invoice_misc_lines_enabled: "true",
    invoice_discounts_enabled: "true",
    invoice_coupons_enabled: "false",
    invoice_environmental_fee_enabled: "false",
    invoice_hazardous_waste_fee_enabled: "false",
    invoice_towing_fee_enabled: "false",
    invoice_diagnostic_fee_enabled: "true",
    invoice_storage_fee_enabled: "false",
    invoice_core_charges_enabled: "true",
    invoice_part_returns_enabled: "true",
    invoice_negative_lines_enabled: "false",
    invoice_zero_dollar_lines_enabled: "true",
    invoice_labor_description_required: "false",
    invoice_part_description_required: "false",
    invoice_labor_rate_override_enabled: "true",
    invoice_markup_override_enabled: "true",
    invoice_sale_price_override_enabled: "true",
    invoice_show_internal_cost_manager_admin_only: "true",

    invoice_show_logo: "true",
    invoice_show_website: "true",
    invoice_show_customer_email: "true",
    invoice_show_vehicle_vin: "true",
    invoice_show_terms: "true",

    pdf_primary_color: "#1f2937",
    pdf_accent_color: "#e5e7eb",
    pdf_text_color: "#111827",
    pdf_font_family: "helvetica",
    pdf_title_size: "26",
    pdf_company_size: "20",
    pdf_body_size: "10",
    pdf_table_size: "9",
    pdf_logo_width: "110",
    pdf_header_style: "classic",
    pdf_paper_size: "letter",
    pdf_orientation: "portrait",
    pdf_logo_position: "left",
    pdf_footer_style: "simple",
    pdf_show_company_address: "true",
    pdf_show_company_phone: "true",
    pdf_show_company_email: "true",
    pdf_show_labor_rate: "true",
    pdf_show_part_unit_price: "true",
    pdf_show_part_markup: "false",
    pdf_show_part_cost: "false",
    pdf_show_tax_breakdown: "true",
    pdf_show_shop_fee: "true",
    pdf_show_technician_name: "false",
    pdf_show_service_advisor: "false",
    pdf_show_signature_line: "false",
    pdf_show_payment_terms: "true",
    pdf_show_footer: "true",
    pdf_footer_text: "Thank you for your business.",
    pdf_terms_title: "Terms / Disclaimer",
    pdf_paid_stamp_text: "PAID",
    pdf_void_stamp_text: "VOID",

    // --- ADDED START ---
    pdf_layout_enabled: "false",
    pdf_layout_json: "",
    // --- ADDED END ---

    permission_invoice_create_roles: "Tech,Manager,IT,Admin,admin",
    permission_invoice_edit_roles: "Manager,IT,Admin,admin",
    permission_invoice_delete_roles: "IT,Admin,admin",
    permission_invoice_void_roles: "Manager,IT,Admin,admin",
    permission_labor_override_roles: "Manager,IT,Admin,admin",
    permission_markup_override_roles: "Manager,IT,Admin,admin",
    permission_view_cost_profit_roles: "Manager,IT,Admin,admin",
    permission_pdf_generate_roles: "Tech,Manager,IT,Admin,admin",
    permission_invoice_settings_roles: "IT,Admin,admin",

    audit_invoice_create_enabled: "true",
    audit_invoice_edit_enabled: "true",
    audit_invoice_pdf_enabled: "true",
    audit_invoice_delete_enabled: "true",
    audit_invoice_void_enabled: "true",
    audit_price_override_enabled: "true",
    audit_override_reason_required: "false",
    audit_discount_approval_required: "false",
    audit_lock_paid_invoice_enabled: "true"
  });
    useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setMessage("");

    const { data: appSettingsData, error: appSettingsError } = await supabase
      .from("app_settings")
      .select("*")
      .order("setting_key", { ascending: true });

    const { data: laborData, error: laborError } = await supabase
      .from("labor_rates")
      .select("*")
      .order("name", { ascending: true });

    const { data: markupData, error: markupError } = await supabase
      .from("markup_tiers")
      .select("*")
      .order("min", { ascending: true });

    if (appSettingsError || laborError || markupError) {
      setMessage(
        appSettingsError?.message || laborError?.message || markupError?.message
      );
      return;
    }

    const loaded = {};
    (appSettingsData || []).forEach((setting) => {
      loaded[setting.setting_key] = setting.setting_value;
    });

    setSettings((prev) => ({
      ...prev,
      ...loaded
    }));

    setLaborRates(laborData || []);
    setMarkupTiers(markupData || []);
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // --- ADDED START ---
  const saveSingleSetting = async (key, value) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: key,
        setting_value: String(value ?? ""),
        description: "System setting",
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

    return true;
  };

  const handleSavePdfLayout = async (nextLayoutJson) => {
    setMessage("");

    setSettings((prev) => ({
      ...prev,
      pdf_layout_enabled: "true",
      pdf_layout_json: nextLayoutJson
    }));

    const layoutSaved = await saveSingleSetting(
      "pdf_layout_json",
      nextLayoutJson
    );

    const enabledSaved = await saveSingleSetting("pdf_layout_enabled", "true");

    if (!layoutSaved || !enabledSaved) return;

    setMessage("PDF layout saved.");
    setPdfDesignerOpen(false);
    loadAllSettings();
  };

  const handleResetPdfLayout = async () => {
    setMessage("");

    setSettings((prev) => ({
      ...prev,
      pdf_layout_enabled: "false",
      pdf_layout_json: ""
    }));

    const layoutSaved = await saveSingleSetting("pdf_layout_json", "");
    const enabledSaved = await saveSingleSetting("pdf_layout_enabled", "false");

    if (!layoutSaved || !enabledSaved) return;

    setMessage("PDF layout reset to default.");
    loadAllSettings();
  };
  // --- ADDED END ---

  const saveSettings = async () => {
    setMessage("");

    for (const key of Object.keys(settings)) {
      const { error } = await supabase.from("app_settings").upsert(
        {
          setting_key: key,
          setting_value: String(settings[key] ?? ""),
          description: "System setting",
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "setting_key"
        }
      );

      if (error) {
        setMessage(error.message);
        return;
      }
    }

    setMessage("Settings saved.");
    loadAllSettings();
  };
    const CheckboxSetting = ({ settingKey, label }) => (
    <label style={{ display: "block", marginBottom: 8 }}>
      <input
        type="checkbox"
        checked={settings[settingKey] === "true"}
        onChange={(e) => updateSetting(settingKey, String(e.target.checked))}
      />{" "}
      {label}
    </label>
  );

  const TextSetting = ({ settingKey, label, placeholder = "", type = "text" }) => (
    <label style={{ display: "block" }}>
      {label}
      <input
        type={type}
        value={settings[settingKey] || ""}
        onChange={(e) => updateSetting(settingKey, e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: 8,
          boxSizing: "border-box",
          marginTop: 4
        }}
      />
    </label>
  );

  const SelectSetting = ({ settingKey, label, options }) => (
    <label style={{ display: "block" }}>
      {label}
      <select
        value={settings[settingKey] || ""}
        onChange={(e) => updateSetting(settingKey, e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          boxSizing: "border-box",
          marginTop: 4
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const SectionActions = () => (
    <div style={{ marginTop: 20 }}>
      <button type="button" onClick={saveSettings}>
        Save Settings
      </button>
    </div>
  );

  const addLaborRate = async () => {
    setMessage("");

    if (laborRates.length >= 50) {
      setMessage("You can only add up to 50 labor rates.");
      return;
    }

    const { error } = await supabase.from("labor_rates").insert({
      name: "New Labor Rate",
      hourly_rate: 0,
      description: "",
      updated_at: new Date().toISOString()
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    loadAllSettings();
  };

  const updateLaborRateLocal = (id, field, value) => {
    setLaborRates((prev) =>
      prev.map((rate) =>
        rate.id === id
          ? {
              ...rate,
              [field]: field === "hourly_rate" ? Number(value || 0) : value
            }
          : rate
      )
    );
  };

  const saveLaborRate = async (rate) => {
    setMessage("");

    const { error } = await supabase
      .from("labor_rates")
      .update({
        name: rate.name,
        hourly_rate: Number(rate.hourly_rate || 0),
        description: rate.description || "",
        updated_at: new Date().toISOString()
      })
      .eq("id", rate.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Labor rate saved.");
    loadAllSettings();
  };

  const deleteLaborRate = async (id) => {
    setMessage("");

    const { error } = await supabase.from("labor_rates").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Labor rate deleted.");
    loadAllSettings();
  };

  const addMarkupTier = async () => {
    setMessage("");

    const { error } = await supabase.from("markup_tiers").insert({
      min: 0,
      max: null,
      percent: 0,
      updated_at: new Date().toISOString()
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    loadAllSettings();
  };
    const updateMarkupTierLocal = (id, field, value) => {
    setMarkupTiers((prev) =>
      prev.map((tier) =>
        tier.id === id
          ? {
              ...tier,
              [field]:
                value === "" && field === "max"
                  ? null
                  : field === "min" || field === "max" || field === "percent"
                  ? Number(value || 0)
                  : value
            }
          : tier
      )
    );
  };

  const saveMarkupTier = async (tier) => {
    setMessage("");

    const { error } = await supabase
      .from("markup_tiers")
      .update({
        min: Number(tier.min || 0),
        max:
          tier.max === "" || tier.max === null || tier.max === undefined
            ? null
            : Number(tier.max || 0),
        percent: Number(tier.percent || 0),
        updated_at: new Date().toISOString()
      })
      .eq("id", tier.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Markup tier saved.");
    loadAllSettings();
  };

  const deleteMarkupTier = async (id) => {
    setMessage("");

    const { error } = await supabase.from("markup_tiers").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Markup tier deleted.");
    loadAllSettings();
  };

  if (!canEditSettings) {
    return (
      <div>
        <h2>Settings</h2>
        <p style={{ color: "red" }}>
          Only IT and Admin accounts can access system settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Settings</h2>

      {message && (
        <p
          style={{
            color:
              message.includes("saved") ||
              message.includes("deleted") ||
              message.includes("reset")
                ? "green"
                : "red",
            fontWeight: "bold"
          }}
        >
          {message}
        </p>
      )}

      {activeSettingsTab === "Settings General" && (
        <div>
          <h3>General Company Settings</h3>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <TextSetting settingKey="company_name" label="Company Name" />
            <TextSetting settingKey="company_phone" label="Company Phone" />
            <TextSetting settingKey="company_email" label="Company Email" />
            <TextSetting settingKey="company_website" label="Company Website" />
            <TextSetting settingKey="company_logo_url" label="Company Logo URL" />
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            Company Address
            <textarea
              value={settings.company_address || ""}
              onChange={(e) => updateSetting("company_address", e.target.value)}
              style={{
                width: "100%",
                minHeight: 80,
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4
              }}
            />
          </label>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Invoice" && (
        <div>
          <h3>Invoice Behavior</h3>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <TextSetting settingKey="invoice_title" label="Invoice Title" />
            <TextSetting settingKey="invoice_number_prefix" label="Invoice Number Prefix" />
            <TextSetting
              settingKey="invoice_next_number"
              label="Next Invoice Number"
              type="number"
            />
            <TextSetting
              settingKey="invoice_statuses"
              label="Invoice Statuses"
              placeholder="Draft,Sent,Paid,Partial,Void"
            />
            <TextSetting
              settingKey="invoice_payment_methods"
              label="Payment Methods"
              placeholder="Cash,Check,Credit Card"
            />
            <TextSetting
              settingKey="invoice_default_payment_terms"
              label="Default Payment Terms"
            />
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            Invoice Disclaimer / Terms
            <textarea
              value={settings.invoice_disclaimer || ""}
              onChange={(e) => updateSetting("invoice_disclaimer", e.target.value)}
              style={{
                width: "100%",
                minHeight: 120,
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4
              }}
            />
          </label>

          <h4>Rules</h4>
          <CheckboxSetting settingKey="invoice_enabled" label="Enable Invoices" />
          <CheckboxSetting settingKey="invoice_require_customer_name" label="Require Customer Name Before Saving" />
          <CheckboxSetting settingKey="invoice_require_vehicle_info" label="Require Vehicle Info Before Saving" />
          <CheckboxSetting settingKey="invoice_require_vin" label="Require VIN Before Saving" />
          <CheckboxSetting settingKey="invoice_auto_number_enabled" label="Auto Generate Invoice Numbers" />
          <CheckboxSetting settingKey="invoice_manual_number_override" label="Allow Manual Invoice Number Override" />
          <CheckboxSetting settingKey="invoice_save_before_pdf_required" label="Require Save Before PDF" />
          <CheckboxSetting settingKey="invoice_edit_saved_enabled" label="Allow Editing Saved Invoices" />
          <CheckboxSetting settingKey="invoice_delete_enabled" label="Allow Deleting Invoices" />
          <CheckboxSetting settingKey="invoice_void_enabled" label="Allow Voiding Invoices" />
          <CheckboxSetting settingKey="invoice_void_reason_required" label="Require Void Reason" />
          <CheckboxSetting settingKey="invoice_payment_tracking_enabled" label="Enable Payment Tracking" />
          <CheckboxSetting settingKey="invoice_partial_payments_enabled" label="Allow Partial Payments" />
          <CheckboxSetting settingKey="invoice_due_date_enabled" label="Enable Due Dates" />
          <CheckboxSetting settingKey="invoice_customer_signature_enabled" label="Enable Customer Signature" />
          <CheckboxSetting settingKey="invoice_technician_notes_enabled" label="Enable Technician Notes" />
          <CheckboxSetting settingKey="invoice_internal_notes_enabled" label="Enable Internal Notes" />
          <CheckboxSetting settingKey="invoice_estimate_conversion_enabled" label="Enable Estimate-To-Invoice Conversion Later" />

          <SectionActions />
        </div>
      )}
            {activeSettingsTab === "Settings Invoice" && (
        <div>
          <h3>Invoice Behavior</h3>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <TextSetting settingKey="invoice_title" label="Invoice Title" />
            <TextSetting settingKey="invoice_number_prefix" label="Invoice Number Prefix" />
            <TextSetting
              settingKey="invoice_next_number"
              label="Next Invoice Number"
              type="number"
            />
            <TextSetting
              settingKey="invoice_statuses"
              label="Invoice Statuses"
              placeholder="Draft,Sent,Paid,Partial,Void"
            />
            <TextSetting
              settingKey="invoice_payment_methods"
              label="Payment Methods"
              placeholder="Cash,Check,Credit Card"
            />
            <TextSetting
              settingKey="invoice_default_payment_terms"
              label="Default Payment Terms"
            />
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            Invoice Disclaimer / Terms
            <textarea
              value={settings.invoice_disclaimer || ""}
              onChange={(e) => updateSetting("invoice_disclaimer", e.target.value)}
              style={{
                width: "100%",
                minHeight: 120,
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4
              }}
            />
          </label>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings PDF" && (
        <div>
          <h3>PDF Layout Customization</h3>

          {/* --- ADDED START --- */}
          <h4>Advanced Layout Designer</h4>

          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 16,
              background: "#f9fafb"
            }}
          >
            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={settings.pdf_layout_enabled === "true"}
                onChange={(e) =>
                  updateSetting("pdf_layout_enabled", String(e.target.checked))
                }
              />{" "}
              Enable Custom PDF Layout
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPdfDesignerOpen(true)}>
                Open PDF Layout Designer
              </button>

              <button type="button" onClick={handleResetPdfLayout}>
                Reset PDF Layout
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
              Drag & drop layout elements. Saving will automatically enable custom layout.
            </p>

            <label style={{ display: "block", marginTop: 10 }}>
              Layout JSON (optional manual edit)
              <textarea
                value={settings.pdf_layout_json || ""}
                onChange={(e) =>
                  updateSetting("pdf_layout_json", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 120,
                  fontFamily: "monospace"
                }}
              />
            </label>
          </div>
          {/* --- ADDED END --- */}
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <TextSetting settingKey="pdf_title_size" label="Title Size" type="number" />
            <TextSetting settingKey="pdf_company_size" label="Company Size" type="number" />
            <TextSetting settingKey="pdf_body_size" label="Body Size" type="number" />
            <TextSetting settingKey="pdf_table_size" label="Table Size" type="number" />
            <TextSetting settingKey="pdf_footer_text" label="Footer Text" />
          </div>

          <h4>Visibility</h4>
          <CheckboxSetting settingKey="pdf_show_labor_rate" label="Show Labor Rate" />
          <CheckboxSetting settingKey="pdf_show_part_unit_price" label="Show Part Price" />
          <CheckboxSetting settingKey="pdf_show_part_markup" label="Show Markup" />
          <CheckboxSetting settingKey="pdf_show_shop_fee" label="Show Shop Fee" />
          <CheckboxSetting settingKey="pdf_show_footer" label="Show Footer" />

          <SectionActions />
        </div>
      )}
            {/* --- ADDED START --- */}
      <PdfLayoutDesigner
        open={pdfDesignerOpen}
        onClose={() => setPdfDesignerOpen(false)}
        layoutJson={settings.pdf_layout_json}
        onSave={handleSavePdfLayout}
        onResetDefault={handleResetPdfLayout}
      />
      {/* --- ADDED END --- */}
    </div>
  );
}

export default SettingsManager;
