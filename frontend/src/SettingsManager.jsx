import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
// --- ADDED START ---
import PdfLayoutDesigner from "./PdfLayoutDesigner";
// --- ADDED END ---

// --- ADDED START ---
const DEFAULT_SETTINGS = {
  tax_rate: "0",
  tax_enabled: "true",
  tax_labor_enabled: "true",
  tax_parts_enabled: "true",
  tax_shop_fee_enabled: "true",
  tax_exempt_enabled: "true",
  tax_exempt_reason_required: "true",
  tax_label: "Sales Tax",
  tax_rounding_mode: "standard",
  tax_display_mode: "summary",
  tax_show_exempt_note_on_pdf: "true",

  shop_fee_enabled: "true",
  shop_fee_type: "percent",
  shop_fee_value: "0",
  shop_fee_taxable: "true",
  shop_fee_minimum: "0",
  shop_fee_maximum: "0",
  shop_fee_label: "Shop Supplies",
  shop_fee_override_enabled: "true",
  shop_fee_show_on_pdf: "true",
  shop_fee_description: "Shop supplies and materials",

  company_name: "NPRAFS Service Center",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_website: "",
  company_logo_url: "",
  company_license_number: "",
  company_slogan: "",
  company_hours: "",
  company_facebook: "",
  company_google_review_url: "",

  // --- ADDED START ---
  document_workflow_enabled: "true",
  document_workflow_start_type: "Estimate",
  document_shared_number_enabled: "true",
  document_number_prefix: "EST",
  document_next_number: "1001",
  estimate_title: "ESTIMATE",
  repair_order_title: "REPAIR ORDER",
  invoice_group_labor_parts_enabled: "true",
  invoice_show_unassigned_parts_enabled: "true",
  pdf_group_labor_parts_enabled: "true",
  pdf_hide_separate_parts_table_when_grouped: "true",
  // --- ADDED END ---

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
  invoice_statuses: "Draft,Sent,Paid,Partial,Void,Overdue",
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
  pdf_background_color: "#ffffff",
  pdf_border_color: "#d1d5db",
  pdf_muted_text_color: "#6b7280",

  pdf_font_family: "helvetica",
  pdf_title_size: "26",
  pdf_company_size: "20",
  pdf_body_size: "10",
  pdf_table_size: "9",
  pdf_small_text_size: "8",

  pdf_logo_width: "110",
  pdf_logo_height: "80",
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
  pdf_custom_elements_enabled: "true",
  pdf_custom_text_boxes_json: "[]",
  pdf_custom_shapes_json: "[]",
  pdf_custom_images_json: "[]",
  pdf_watermark_enabled: "false",
  pdf_watermark_text: "",
  pdf_watermark_opacity: "0.12",
  pdf_watermark_rotation: "-35",
  pdf_page_margin_top: "40",
  pdf_page_margin_right: "40",
  pdf_page_margin_bottom: "40",
  pdf_page_margin_left: "40",
  pdf_table_header_background: "#1f2937",
  pdf_table_header_text_color: "#ffffff",
  pdf_table_row_alternate_color: "#e5e7eb",
  pdf_table_border_enabled: "true",
  pdf_table_border_width: "0.5",
  pdf_table_cell_padding: "6",
  pdf_show_invoice_barcode: "false",
  pdf_show_qr_code: "false",
  pdf_qr_code_value: "",
  pdf_show_balance_due_box: "true",
  pdf_show_paid_stamp: "true",
  pdf_show_void_stamp: "true",
  pdf_signature_label: "Customer Signature",
  pdf_authorization_text: "I authorize the above repairs and charges.",
  pdf_custom_css_notes: "",
  // --- ADDED END ---

  payment_enabled: "true",
  payment_require_method: "false",
  payment_allow_partial: "true",
  payment_show_balance_due: "true",
  payment_receipt_enabled: "true",
  payment_default_status_when_paid: "Paid",
  payment_late_fee_enabled: "false",
  payment_late_fee_type: "flat",
  payment_late_fee_value: "0",

  customer_history_enabled: "true",
  customer_required_phone: "false",
  customer_required_email: "false",
  customer_duplicate_check_enabled: "true",
  customer_marketing_opt_in_enabled: "false",

  vehicle_history_enabled: "true",
  vehicle_require_mileage: "false",
  vehicle_require_plate: "false",
  vehicle_show_vin_on_invoice: "true",
  vehicle_service_reminder_enabled: "false",
    inventory_enabled: "true",
  inventory_auto_deduct_on_invoice_save: "false",
  inventory_auto_deduct_on_invoice_paid: "true",
  inventory_low_stock_alerts_enabled: "true",
  inventory_default_reorder_quantity: "1",
  inventory_allow_negative_stock: "false",
  inventory_require_repair_order_when_used: "true",
  inventory_show_cost_to_admin_only: "true",
  inventory_default_markup_percent: "0",
  inventory_vendor_tracking_enabled: "true",
  inventory_purchase_orders_enabled: "true",

  repair_orders_enabled: "true",
  repair_order_prefix: "RO",
  repair_order_next_number: "1001",
  repair_order_require_customer: "true",
  repair_order_require_vehicle: "true",
  repair_order_statuses: "Open,Waiting Parts,In Progress,Ready,Closed,Cancelled",
  repair_order_convert_to_invoice_enabled: "true",
  repair_order_technician_assignment_enabled: "true",
  repair_order_customer_approval_required: "false",

  estimates_enabled: "true",
  estimate_prefix: "EST",
  estimate_next_number: "1001",
  estimate_default_expiration_days: "30",
  estimate_require_customer: "true",
  estimate_require_vehicle: "false",
  estimate_convert_to_invoice_enabled: "true",
  estimate_customer_approval_enabled: "false",
  estimate_show_disclaimer: "true",
  estimate_disclaimer: "This estimate is not a final invoice and may change after inspection.",

  ui_theme: "light",
  ui_accent_color: "#2563eb",
  ui_sidebar_collapsed_default: "false",
  ui_compact_mode: "false",
  ui_show_dashboard_metrics: "true",
  ui_show_debug_tools: "false",
  ui_login_show_version: "true",
  ui_login_background_logo_opacity: "0.12",

  auto_update_enabled: "true",
  auto_update_check_on_startup: "true",
  auto_update_allow_manual_check: "true",
  auto_update_download_automatically: "false",
  auto_update_install_on_quit: "true",
  auto_update_channel: "latest",

  backup_enabled: "true",
  backup_export_json_enabled: "true",
  backup_export_csv_enabled: "true",
  backup_export_pdf_enabled: "true",
  backup_include_settings: "true",
  backup_include_invoices: "true",
  backup_include_inventory: "true",

  notification_enabled: "true",
  notification_low_stock_enabled: "true",
  notification_overdue_invoice_enabled: "true",
  notification_estimate_expiring_enabled: "true",
  notification_service_reminder_enabled: "false",

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
  audit_lock_paid_invoice_enabled: "true",
  audit_log_retention_days: "365",
  audit_show_user_in_logs: "true"
};
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

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

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
        appSettingsError?.message ||
          laborError?.message ||
          markupError?.message
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

    const enabledSaved = await saveSingleSetting(
      "pdf_layout_enabled",
      "true"
    );

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
    const enabledSaved = await saveSingleSetting(
      "pdf_layout_enabled",
      "false"
    );

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
        onChange={(e) =>
          updateSetting(settingKey, String(e.target.checked))
        }
      />{" "}
      {label}
    </label>
  );

  const TextSetting = ({
    settingKey,
    label,
    placeholder = "",
    type = "text"
  }) => (
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
              [field]:
                field === "hourly_rate"
                  ? Number(value || 0)
                  : value
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

    const { error } = await supabase
      .from("labor_rates")
      .delete()
      .eq("id", id);

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
                  : field === "min" ||
                    field === "max" ||
                    field === "percent"
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

    const { error } = await supabase
      .from("markup_tiers")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Markup tier deleted.");
    loadAllSettings();
  };

  const FieldGrid = ({ children, columns = "1fr 1fr" }) => (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: columns
      }}
    >
      {children}
    </div>
  );

  const Panel = ({ title, children }) => (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
        background: "#fff"
      }}
    >
      <h4 style={{ marginTop: 0 }}>{title}</h4>
      {children}
    </div>
  );

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

          <Panel title="Company Identity">
            <FieldGrid>
              <TextSetting settingKey="company_name" label="Company Name" />
              <TextSetting settingKey="company_slogan" label="Company Slogan" />
              <TextSetting settingKey="company_phone" label="Company Phone" />
              <TextSetting settingKey="company_email" label="Company Email" />
              <TextSetting settingKey="company_website" label="Company Website" />
              <TextSetting settingKey="company_logo_url" label="Company Logo URL" />
              <TextSetting settingKey="company_license_number" label="License Number" />
              <TextSetting settingKey="company_hours" label="Business Hours" />
              <TextSetting settingKey="company_facebook" label="Facebook URL" />
              <TextSetting settingKey="company_google_review_url" label="Google Review URL" />
            </FieldGrid>

            <label style={{ display: "block", marginTop: 12 }}>
              Company Address
              <textarea
                value={settings.company_address || ""}
                onChange={(e) =>
                  updateSetting("company_address", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 80,
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>
          </Panel>

          <Panel title="Application UI">
            <FieldGrid>
              <SelectSetting
                settingKey="ui_theme"
                label="Theme"
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "Use System" }
                ]}
              />
                            <TextSetting
                settingKey="ui_accent_color"
                label="Accent Color"
                type="color"
              />
              <TextSetting
                settingKey="ui_login_background_logo_opacity"
                label="Login Logo Opacity"
                type="number"
              />
            </FieldGrid>

            <CheckboxSetting
              settingKey="ui_sidebar_collapsed_default"
              label="Sidebar Collapsed By Default"
            />
            <CheckboxSetting settingKey="ui_compact_mode" label="Compact Mode" />
            <CheckboxSetting
              settingKey="ui_show_dashboard_metrics"
              label="Show Dashboard Metrics"
            />
            <CheckboxSetting
              settingKey="ui_show_debug_tools"
              label="Show Debug Tools"
            />
            <CheckboxSetting
              settingKey="ui_login_show_version"
              label="Show Version On Login Screen"
            />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Invoice" && (
        <div>
          <h3>Invoice Settings</h3>

          {/* --- ADDED START --- */}
          <Panel title="Estimate → Repair Order → Invoice Workflow">
            <CheckboxSetting
              settingKey="document_workflow_enabled"
              label="Enable Estimate → Repair Order → Invoice Workflow"
            />
            <CheckboxSetting
              settingKey="document_shared_number_enabled"
              label="Use Same Number For Estimate, Repair Order, And Invoice"
            />
            <CheckboxSetting
              settingKey="invoice_group_labor_parts_enabled"
              label="Group Parts Under Labor Items"
            />
            <CheckboxSetting
              settingKey="invoice_show_unassigned_parts_enabled"
              label="Allow Unassigned Parts"
            />

            <FieldGrid>
              <TextSetting settingKey="document_number_prefix" label="Shared Number Prefix" />
              <TextSetting settingKey="document_next_number" label="Next Shared Number" type="number" />
              <TextSetting settingKey="estimate_title" label="Estimate PDF Title" />
              <TextSetting settingKey="repair_order_title" label="Repair Order PDF Title" />
              <TextSetting settingKey="invoice_title" label="Invoice PDF Title" />
            </FieldGrid>
          </Panel>
          {/* --- ADDED END --- */}

          <Panel title="Invoice Numbering & Statuses">
            <FieldGrid>
              <TextSetting settingKey="invoice_title" label="Invoice Title" />
              <TextSetting
                settingKey="invoice_number_prefix"
                label="Invoice Number Prefix"
              />
              <TextSetting
                settingKey="invoice_next_number"
                label="Next Invoice Number"
                type="number"
              />
              <TextSetting
                settingKey="invoice_statuses"
                label="Invoice Statuses"
                placeholder="Draft,Sent,Paid,Partial,Void,Overdue"
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
            </FieldGrid>
          </Panel>

          <Panel title="Invoice Rules">
            <CheckboxSetting settingKey="invoice_enabled" label="Enable Invoices" />
            <CheckboxSetting
              settingKey="invoice_require_customer_name"
              label="Require Customer Name Before Saving"
            />
            <CheckboxSetting
              settingKey="invoice_require_vehicle_info"
              label="Require Vehicle Info Before Saving"
            />
            <CheckboxSetting
              settingKey="invoice_require_vin"
              label="Require VIN Before Saving"
            />
            <CheckboxSetting
              settingKey="invoice_auto_number_enabled"
              label="Auto Generate Invoice Numbers"
            />
            <CheckboxSetting
              settingKey="invoice_manual_number_override"
              label="Allow Manual Invoice Number Override"
            />
            <CheckboxSetting
              settingKey="invoice_save_before_pdf_required"
              label="Require Save Before PDF"
            />
            <CheckboxSetting
              settingKey="invoice_edit_saved_enabled"
              label="Allow Editing Saved Invoices"
            />
            <CheckboxSetting
              settingKey="invoice_delete_enabled"
              label="Allow Deleting Invoices"
            />
            <CheckboxSetting
              settingKey="invoice_void_enabled"
              label="Allow Voiding Invoices"
            />
            <CheckboxSetting
              settingKey="invoice_void_reason_required"
              label="Require Void Reason"
            />
          </Panel>
                    <Panel title="Invoice Features">
            <CheckboxSetting
              settingKey="invoice_payment_tracking_enabled"
              label="Enable Payment Tracking"
            />
            <CheckboxSetting
              settingKey="invoice_partial_payments_enabled"
              label="Allow Partial Payments"
            />
            <CheckboxSetting
              settingKey="invoice_due_date_enabled"
              label="Enable Due Dates"
            />
            <CheckboxSetting
              settingKey="invoice_customer_signature_enabled"
              label="Enable Customer Signature"
            />
            <CheckboxSetting
              settingKey="invoice_technician_notes_enabled"
              label="Enable Technician Notes"
            />
            <CheckboxSetting
              settingKey="invoice_internal_notes_enabled"
              label="Enable Internal Notes"
            />
            <CheckboxSetting
              settingKey="invoice_estimate_conversion_enabled"
              label="Enable Estimate-To-Invoice Conversion"
            />
          </Panel>

          <Panel title="Invoice Line Items">
            <CheckboxSetting settingKey="invoice_labor_enabled" label="Enable Labor Lines" />
            <CheckboxSetting settingKey="invoice_parts_enabled" label="Enable Parts Lines" />
            <CheckboxSetting settingKey="invoice_misc_lines_enabled" label="Enable Miscellaneous Lines" />
            <CheckboxSetting settingKey="invoice_discounts_enabled" label="Enable Discounts" />
            <CheckboxSetting settingKey="invoice_coupons_enabled" label="Enable Coupons / Promos" />
            <CheckboxSetting settingKey="invoice_environmental_fee_enabled" label="Enable Environmental Fees" />
            <CheckboxSetting settingKey="invoice_hazardous_waste_fee_enabled" label="Enable Hazardous Waste Fee" />
            <CheckboxSetting settingKey="invoice_towing_fee_enabled" label="Enable Towing Fee" />
            <CheckboxSetting settingKey="invoice_diagnostic_fee_enabled" label="Enable Diagnostic Fee" />
            <CheckboxSetting settingKey="invoice_storage_fee_enabled" label="Enable Storage Fee" />
            <CheckboxSetting settingKey="invoice_core_charges_enabled" label="Enable Core Charges" />
            <CheckboxSetting settingKey="invoice_part_returns_enabled" label="Enable Part Returns / Credits" />
            <CheckboxSetting settingKey="invoice_negative_lines_enabled" label="Allow Negative Line Items" />
            <CheckboxSetting settingKey="invoice_zero_dollar_lines_enabled" label="Allow Zero-Dollar Line Items" />
            <CheckboxSetting settingKey="invoice_labor_description_required" label="Require Labor Descriptions" />
            <CheckboxSetting settingKey="invoice_part_description_required" label="Require Parts Descriptions" />
            <CheckboxSetting settingKey="invoice_labor_rate_override_enabled" label="Allow Labor Rate Override" />
            <CheckboxSetting settingKey="invoice_markup_override_enabled" label="Allow Markup Override" />
            <CheckboxSetting settingKey="invoice_sale_price_override_enabled" label="Allow Sale Price Override" />
            <CheckboxSetting settingKey="invoice_show_internal_cost_manager_admin_only" label="Show Internal Part Cost To Manager/Admin Only" />
          </Panel>

          <Panel title="Invoice Disclaimer / Terms">
            <label style={{ display: "block" }}>
              Invoice Disclaimer / Terms
              <textarea
                value={settings.invoice_disclaimer || ""}
                onChange={(e) =>
                  updateSetting("invoice_disclaimer", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>
          </Panel>

          <SectionActions />
        </div>
      )}
            {activeSettingsTab === "Settings PDF" && (
        <div>
          <h3>PDF Customization</h3>

          <Panel title="Advanced Layout Designer">
            <CheckboxSetting
              settingKey="pdf_layout_enabled"
              label="Enable Custom PDF Layout"
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPdfDesignerOpen(true)}>
                Open Layout Designer
              </button>

              <button type="button" onClick={handleResetPdfLayout}>
                Reset Layout
              </button>
            </div>

            <label style={{ display: "block", marginTop: 10 }}>
              Layout JSON
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
          </Panel>

          <Panel title="PDF Appearance">
            <FieldGrid columns="1fr 1fr 1fr">
              <TextSetting settingKey="pdf_primary_color" label="Primary Color" type="color" />
              <TextSetting settingKey="pdf_accent_color" label="Accent Color" type="color" />
              <TextSetting settingKey="pdf_text_color" label="Text Color" type="color" />
              <TextSetting settingKey="pdf_background_color" label="Background Color" type="color" />
              <TextSetting settingKey="pdf_border_color" label="Border Color" type="color" />
              <TextSetting settingKey="pdf_muted_text_color" label="Muted Text Color" type="color" />
            </FieldGrid>
          </Panel>

          <Panel title="Typography & Layout">
            <FieldGrid>
              <TextSetting settingKey="pdf_title_size" label="Title Size" type="number" />
              <TextSetting settingKey="pdf_company_size" label="Company Size" type="number" />
              <TextSetting settingKey="pdf_body_size" label="Body Size" type="number" />
              <TextSetting settingKey="pdf_table_size" label="Table Font Size" type="number" />
              <TextSetting settingKey="pdf_small_text_size" label="Small Text Size" type="number" />
            </FieldGrid>

            <FieldGrid>
              <TextSetting settingKey="pdf_logo_width" label="Logo Width" type="number" />
              <TextSetting settingKey="pdf_logo_height" label="Logo Height" type="number" />
              <SelectSetting
                settingKey="pdf_logo_position"
                label="Logo Position"
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" }
                ]}
              />
            </FieldGrid>

            <FieldGrid>
              <SelectSetting
                settingKey="pdf_orientation"
                label="Orientation"
                options={[
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" }
                ]}
              />
              <SelectSetting
                settingKey="pdf_paper_size"
                label="Paper Size"
                options={[
                  { value: "letter", label: "Letter" },
                  { value: "a4", label: "A4" }
                ]}
              />
            </FieldGrid>
          </Panel>
                    <Panel title="PDF Margins">
            <FieldGrid columns="1fr 1fr 1fr 1fr">
              <TextSetting settingKey="pdf_page_margin_top" label="Top" type="number" />
              <TextSetting settingKey="pdf_page_margin_right" label="Right" type="number" />
              <TextSetting settingKey="pdf_page_margin_bottom" label="Bottom" type="number" />
              <TextSetting settingKey="pdf_page_margin_left" label="Left" type="number" />
            </FieldGrid>
          </Panel>

          <Panel title="PDF Table Styling">
            <FieldGrid>
              <TextSetting settingKey="pdf_table_header_background" label="Header Background" type="color" />
              <TextSetting settingKey="pdf_table_header_text_color" label="Header Text Color" type="color" />
              <TextSetting settingKey="pdf_table_row_alternate_color" label="Alternate Row Color" type="color" />
              <TextSetting settingKey="pdf_table_border_width" label="Border Width" type="number" />
              <TextSetting settingKey="pdf_table_cell_padding" label="Cell Padding" type="number" />
            </FieldGrid>

            <CheckboxSetting settingKey="pdf_table_border_enabled" label="Show Table Borders" />
          </Panel>

          <Panel title="PDF Visibility">
            <CheckboxSetting settingKey="invoice_show_logo" label="Show Logo" />
            <CheckboxSetting settingKey="invoice_show_website" label="Show Website" />
            <CheckboxSetting settingKey="invoice_show_customer_email" label="Show Customer Email" />
            <CheckboxSetting settingKey="invoice_show_vehicle_vin" label="Show Vehicle VIN" />
            <CheckboxSetting settingKey="invoice_show_terms" label="Show Terms / Disclaimer" />
            <CheckboxSetting settingKey="pdf_show_company_address" label="Show Company Address" />
            <CheckboxSetting settingKey="pdf_show_company_phone" label="Show Company Phone" />
            <CheckboxSetting settingKey="pdf_show_company_email" label="Show Company Email" />
            <CheckboxSetting settingKey="pdf_show_labor_rate" label="Show Labor Rate Column" />
            <CheckboxSetting settingKey="pdf_show_part_unit_price" label="Show Part Unit Price Column" />
            <CheckboxSetting settingKey="pdf_show_part_markup" label="Show Part Markup Column" />
            <CheckboxSetting settingKey="pdf_show_part_cost" label="Show Part Cost Column" />
            <CheckboxSetting settingKey="pdf_show_tax_breakdown" label="Show Tax Breakdown" />
            <CheckboxSetting settingKey="pdf_show_shop_fee" label="Show Shop Fee" />
            <CheckboxSetting settingKey="pdf_show_technician_name" label="Show Technician Name" />
            <CheckboxSetting settingKey="pdf_show_service_advisor" label="Show Service Advisor" />
            <CheckboxSetting settingKey="pdf_show_signature_line" label="Show Signature Line" />
            <CheckboxSetting settingKey="pdf_show_payment_terms" label="Show Payment Terms" />
            <CheckboxSetting settingKey="pdf_show_footer" label="Show Footer" />
            {/* --- ADDED START --- */}
            <CheckboxSetting
              settingKey="pdf_group_labor_parts_enabled"
              label="Show Labor And Attached Parts In One Grouped PDF Table"
            />
            <CheckboxSetting
              settingKey="pdf_hide_separate_parts_table_when_grouped"
              label="Hide Separate Parts Table When Labor/Parts Are Grouped"
            />
            {/* --- ADDED END --- */}
            <CheckboxSetting settingKey="pdf_show_balance_due_box" label="Show Balance Due Box" />
            <CheckboxSetting settingKey="pdf_show_paid_stamp" label="Show Paid Stamp" />
            <CheckboxSetting settingKey="pdf_show_void_stamp" label="Show Void Stamp" />
            <CheckboxSetting settingKey="pdf_show_invoice_barcode" label="Show Invoice Barcode" />
            <CheckboxSetting settingKey="pdf_show_qr_code" label="Show QR Code" />
          </Panel>

          <Panel title="PDF Text, Stamps, QR & Watermark">
            <FieldGrid>
              <TextSetting settingKey="pdf_footer_text" label="Footer Text" />
              <TextSetting settingKey="pdf_terms_title" label="Terms Title" />
              <TextSetting settingKey="pdf_paid_stamp_text" label="Paid Stamp Text" />
              <TextSetting settingKey="pdf_void_stamp_text" label="Void Stamp Text" />
              <TextSetting settingKey="pdf_signature_label" label="Signature Label" />
              <TextSetting settingKey="pdf_qr_code_value" label="QR Code Value" />
            </FieldGrid>

            <label style={{ display: "block", marginTop: 12 }}>
              Authorization Text
              <textarea
                value={settings.pdf_authorization_text || ""}
                onChange={(e) =>
                  updateSetting("pdf_authorization_text", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 70,
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>

            <hr />

            <CheckboxSetting settingKey="pdf_watermark_enabled" label="Enable Watermark" />

            <FieldGrid>
              <TextSetting settingKey="pdf_watermark_text" label="Watermark Text" />
              <TextSetting settingKey="pdf_watermark_opacity" label="Watermark Opacity" type="number" />
              <TextSetting settingKey="pdf_watermark_rotation" label="Watermark Rotation" type="number" />
            </FieldGrid>
          </Panel>

          <Panel title="Custom PDF Elements">
            <CheckboxSetting
              settingKey="pdf_custom_elements_enabled"
              label="Enable Custom Text Boxes, Shapes, and Images"
            />

            <label style={{ display: "block", marginTop: 10 }}>
              Custom Text Boxes JSON
              <textarea
                value={settings.pdf_custom_text_boxes_json || ""}
                onChange={(e) =>
                  updateSetting("pdf_custom_text_boxes_json", e.target.value)
                }
                placeholder='[{"id":"custom_note","text":"Thank you!","x":40,"y":740,"width":200,"height":30,"fontSize":10}]'
                style={{
                  width: "100%",
                  minHeight: 100,
                  fontFamily: "monospace",
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>

            <label style={{ display: "block", marginTop: 10 }}>
              Custom Shapes JSON
              <textarea
                value={settings.pdf_custom_shapes_json || ""}
                onChange={(e) =>
                  updateSetting("pdf_custom_shapes_json", e.target.value)
                }
                placeholder='[{"id":"line1","shape":"line","x":40,"y":120,"width":530,"height":0,"color":"#111827"}]'
                style={{
                  width: "100%",
                  minHeight: 100,
                  fontFamily: "monospace",
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>

            <label style={{ display: "block", marginTop: 10 }}>
              Custom Images JSON
              <textarea
                value={settings.pdf_custom_images_json || ""}
                onChange={(e) =>
                  updateSetting("pdf_custom_images_json", e.target.value)
                }
                placeholder='[{"id":"badge","url":"https://...","x":450,"y":40,"width":80,"height":80}]'
                style={{
                  width: "100%",
                  minHeight: 100,
                  fontFamily: "monospace",
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>

            <label style={{ display: "block", marginTop: 10 }}>
              Custom CSS / Notes
              <textarea
                value={settings.pdf_custom_css_notes || ""}
                onChange={(e) =>
                  updateSetting("pdf_custom_css_notes", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 80,
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>
          </Panel>

          <SectionActions />
        </div>
      )}
            {activeSettingsTab === "Settings Tax" && (
        <div>
          <h3>Tax Settings</h3>

          <Panel title="Tax Rates & Display">
            <FieldGrid>
              <TextSetting settingKey="tax_label" label="Tax Label" />
              <TextSetting settingKey="tax_rate" label="Tax Rate %" type="number" />
              <SelectSetting
                settingKey="tax_rounding_mode"
                label="Tax Rounding"
                options={[
                  { value: "standard", label: "Standard" },
                  { value: "up", label: "Round Up" },
                  { value: "down", label: "Round Down" }
                ]}
              />
              <SelectSetting
                settingKey="tax_display_mode"
                label="Tax Display Mode"
                options={[
                  { value: "summary", label: "Summary Only" },
                  { value: "line", label: "Line Item Tax" },
                  { value: "both", label: "Both" }
                ]}
              />
            </FieldGrid>

            <CheckboxSetting settingKey="tax_enabled" label="Enable Tax" />
            <CheckboxSetting settingKey="tax_labor_enabled" label="Tax Labor" />
            <CheckboxSetting settingKey="tax_parts_enabled" label="Tax Parts" />
            <CheckboxSetting settingKey="tax_shop_fee_enabled" label="Tax Shop Fee" />
            <CheckboxSetting settingKey="tax_exempt_enabled" label="Allow Tax-Exempt Customers" />
            <CheckboxSetting settingKey="tax_exempt_reason_required" label="Require Tax-Exempt Reason" />
            <CheckboxSetting settingKey="tax_show_exempt_note_on_pdf" label="Show Tax-Exempt Note On PDF" />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Shop Fees" && (
        <div>
          <h3>Shop Fee Settings</h3>

          <Panel title="Shop Fee Rules">
            <FieldGrid>
              <TextSetting settingKey="shop_fee_label" label="Shop Fee Label" />
              <TextSetting settingKey="shop_fee_value" label="Shop Fee Value" type="number" />
              <TextSetting settingKey="shop_fee_minimum" label="Minimum Shop Fee" type="number" />
              <TextSetting settingKey="shop_fee_maximum" label="Maximum Shop Fee / Cap" type="number" />

              <SelectSetting
                settingKey="shop_fee_type"
                label="Shop Fee Type"
                options={[
                  { value: "percent", label: "Percent of Labor" },
                  { value: "flat", label: "Flat Fee" }
                ]}
              />
            </FieldGrid>

            <label style={{ display: "block", marginTop: 12 }}>
              Shop Fee Description
              <textarea
                value={settings.shop_fee_description || ""}
                onChange={(e) =>
                  updateSetting("shop_fee_description", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 70,
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>

            <CheckboxSetting settingKey="shop_fee_enabled" label="Enable Shop Fee" />
            <CheckboxSetting settingKey="shop_fee_taxable" label="Shop Fee Is Taxable" />
            <CheckboxSetting settingKey="shop_fee_override_enabled" label="Allow Shop Fee Override Per Invoice" />
            <CheckboxSetting settingKey="shop_fee_show_on_pdf" label="Show Shop Fee On PDF" />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Labor" && (
        <div>
          <h3>Labor Rates</h3>

          <button type="button" onClick={addLaborRate}>
            Add Labor Rate
          </button>

          <table
            border="1"
            cellPadding="8"
            style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}
          >
            <thead>
              <tr>
                <th>Name</th>
                <th>Hourly Rate</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {laborRates.map((rate) => (
                <tr key={rate.id}>
                  <td>
                    <input
                      value={rate.name || ""}
                      onChange={(e) =>
                        updateLaborRateLocal(rate.id, "name", e.target.value)
                      }
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={rate.hourly_rate || 0}
                      onChange={(e) =>
                        updateLaborRateLocal(
                          rate.id,
                          "hourly_rate",
                          e.target.value
                        )
                      }
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td>
                    <input
                      value={rate.description || ""}
                      onChange={(e) =>
                        updateLaborRateLocal(
                          rate.id,
                          "description",
                          e.target.value
                        )
                      }
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td>
                    <button type="button" onClick={() => saveLaborRate(rate)}>
                      Save
                    </button>{" "}
                    <button type="button" onClick={() => deleteLaborRate(rate.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {laborRates.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center" }}>
                    No labor rates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSettingsTab === "Settings Markup" && (
        <div>
          <h3>Parts Markup Tiers</h3>

          <button type="button" onClick={addMarkupTier}>
            Add Markup Tier
          </button>

          <table
            border="1"
            cellPadding="8"
            style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}
          >
            <thead>
              <tr>
                <th>Minimum Cost</th>
                <th>Maximum Cost</th>
                <th>Markup %</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {markupTiers.map((tier) => (
                <tr key={tier.id}>
                  <td>
                    <input
                      type="number"
                      value={tier.min ?? 0}
                      onChange={(e) =>
                        updateMarkupTierLocal(tier.id, "min", e.target.value)
                      }
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={tier.max ?? ""}
                      onChange={(e) =>
                        updateMarkupTierLocal(tier.id, "max", e.target.value)
                      }
                      placeholder="Blank = no max"
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={tier.percent ?? 0}
                      onChange={(e) =>
                        updateMarkupTierLocal(tier.id, "percent", e.target.value)
                      }
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td>
                    <button type="button" onClick={() => saveMarkupTier(tier)}>
                      Save
                    </button>{" "}
                    <button type="button" onClick={() => deleteMarkupTier(tier.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {markupTiers.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center" }}>
                    No markup tiers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSettingsTab === "Settings Payments" && (
        <div>
          <h3>Payment Settings</h3>

          <Panel title="Payments">
            <CheckboxSetting settingKey="payment_enabled" label="Enable Payments" />
            <CheckboxSetting settingKey="payment_require_method" label="Require Payment Method" />
            <CheckboxSetting settingKey="payment_allow_partial" label="Allow Partial Payments" />
            <CheckboxSetting settingKey="payment_show_balance_due" label="Show Balance Due" />
            <CheckboxSetting settingKey="payment_receipt_enabled" label="Enable Payment Receipts" />

            <FieldGrid>
              <TextSetting settingKey="payment_default_status_when_paid" label="Status When Paid" />
              <SelectSetting
                settingKey="payment_late_fee_type"
                label="Late Fee Type"
                options={[
                  { value: "flat", label: "Flat" },
                  { value: "percent", label: "Percent" }
                ]}
              />
              <TextSetting settingKey="payment_late_fee_value" label="Late Fee Value" type="number" />
            </FieldGrid>

            <CheckboxSetting settingKey="payment_late_fee_enabled" label="Enable Late Fees" />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Inventory" && (
        <div>
          <h3>Inventory Settings</h3>

          <Panel title="Inventory Behavior">
            <CheckboxSetting settingKey="inventory_enabled" label="Enable Inventory" />
            <CheckboxSetting settingKey="inventory_auto_deduct_on_invoice_save" label="Auto-Deduct Parts When Invoice Is Saved" />
            <CheckboxSetting settingKey="inventory_auto_deduct_on_invoice_paid" label="Auto-Deduct Parts When Invoice Is Paid" />
            <CheckboxSetting settingKey="inventory_low_stock_alerts_enabled" label="Enable Low Stock Alerts" />
            <CheckboxSetting settingKey="inventory_allow_negative_stock" label="Allow Negative Stock" />
            <CheckboxSetting settingKey="inventory_require_repair_order_when_used" label="Require Repair Order When Stock Is Used" />
            <CheckboxSetting settingKey="inventory_show_cost_to_admin_only" label="Show Cost To Admin Only" />
            <CheckboxSetting settingKey="inventory_vendor_tracking_enabled" label="Enable Vendor Tracking" />
            <CheckboxSetting settingKey="inventory_purchase_orders_enabled" label="Enable Purchase Orders" />

            <FieldGrid>
              <TextSetting settingKey="inventory_default_reorder_quantity" label="Default Reorder Quantity" type="number" />
              <TextSetting settingKey="inventory_default_markup_percent" label="Default Markup Percent" type="number" />
            </FieldGrid>
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Repair Orders" && (
        <div>
          <h3>Repair Order Settings</h3>

          <Panel title="Repair Orders">
            <CheckboxSetting settingKey="repair_orders_enabled" label="Enable Repair Orders" />
            <CheckboxSetting settingKey="repair_order_require_customer" label="Require Customer" />
            <CheckboxSetting settingKey="repair_order_require_vehicle" label="Require Vehicle" />
            <CheckboxSetting settingKey="repair_order_convert_to_invoice_enabled" label="Allow Convert To Invoice" />
            <CheckboxSetting settingKey="repair_order_technician_assignment_enabled" label="Enable Technician Assignment" />
            <CheckboxSetting settingKey="repair_order_customer_approval_required" label="Require Customer Approval" />

            <FieldGrid>
              <TextSetting settingKey="repair_order_prefix" label="Repair Order Prefix" />
              <TextSetting settingKey="repair_order_next_number" label="Next Repair Order Number" type="number" />
              <TextSetting settingKey="repair_order_statuses" label="Repair Order Statuses" />
            </FieldGrid>
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Estimates" && (
        <div>
          <h3>Estimate Settings</h3>

          <Panel title="Estimates">
            <CheckboxSetting settingKey="estimates_enabled" label="Enable Estimates" />
            <CheckboxSetting settingKey="estimate_require_customer" label="Require Customer" />
            <CheckboxSetting settingKey="estimate_require_vehicle" label="Require Vehicle" />
            <CheckboxSetting settingKey="estimate_convert_to_invoice_enabled" label="Allow Convert To Invoice" />
            <CheckboxSetting settingKey="estimate_customer_approval_enabled" label="Enable Customer Approval" />
            <CheckboxSetting settingKey="estimate_show_disclaimer" label="Show Estimate Disclaimer" />

            <FieldGrid>
              <TextSetting settingKey="estimate_prefix" label="Estimate Prefix" />
              <TextSetting settingKey="estimate_next_number" label="Next Estimate Number" type="number" />
              <TextSetting settingKey="estimate_default_expiration_days" label="Default Expiration Days" type="number" />
            </FieldGrid>

            <label style={{ display: "block", marginTop: 12 }}>
              Estimate Disclaimer
              <textarea
                value={settings.estimate_disclaimer || ""}
                onChange={(e) =>
                  updateSetting("estimate_disclaimer", e.target.value)
                }
                style={{
                  width: "100%",
                  minHeight: 90,
                  padding: 8,
                  boxSizing: "border-box",
                  marginTop: 4
                }}
              />
            </label>
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Permissions" && (
        <div>
          <h3>Role Permission Settings</h3>

          <Panel title="Permissions">
            <p>
              Use comma-separated role names. Example:{" "}
              <strong>Tech,Manager,IT,Admin,admin</strong>
            </p>

            <FieldGrid>
              <TextSetting settingKey="permission_invoice_create_roles" label="Can Create Invoices" />
              <TextSetting settingKey="permission_invoice_edit_roles" label="Can Edit Invoices" />
              <TextSetting settingKey="permission_invoice_delete_roles" label="Can Delete Invoices" />
              <TextSetting settingKey="permission_invoice_void_roles" label="Can Void Invoices" />
              <TextSetting settingKey="permission_labor_override_roles" label="Can Override Labor Rates" />
              <TextSetting settingKey="permission_markup_override_roles" label="Can Override Markup" />
              <TextSetting settingKey="permission_view_cost_profit_roles" label="Can View Cost / Profit" />
              <TextSetting settingKey="permission_pdf_generate_roles" label="Can Generate PDFs" />
              <TextSetting settingKey="permission_invoice_settings_roles" label="Can Change Invoice Settings" />
            </FieldGrid>
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Audit" && (
        <div>
          <h3>Audit / Security Settings</h3>

          <Panel title="Audit Logging">
            <CheckboxSetting settingKey="audit_invoice_create_enabled" label="Log Invoice Creation" />
            <CheckboxSetting settingKey="audit_invoice_edit_enabled" label="Log Invoice Edits" />
            <CheckboxSetting settingKey="audit_invoice_pdf_enabled" label="Log PDF Generation" />
            <CheckboxSetting settingKey="audit_invoice_delete_enabled" label="Log Invoice Deletion" />
            <CheckboxSetting settingKey="audit_invoice_void_enabled" label="Log Invoice Voiding" />
            <CheckboxSetting settingKey="audit_price_override_enabled" label="Log Price Overrides" />
            <CheckboxSetting settingKey="audit_override_reason_required" label="Require Reason For Overrides" />
            <CheckboxSetting settingKey="audit_discount_approval_required" label="Require Manager/Admin Approval For Discounts" />
            <CheckboxSetting settingKey="audit_lock_paid_invoice_enabled" label="Lock Paid Invoice" />
            <CheckboxSetting settingKey="audit_show_user_in_logs" label="Show User In Logs" />

            <TextSetting settingKey="audit_log_retention_days" label="Audit Retention Days" type="number" />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Updates" && (
        <div>
          <h3>Auto Update Settings</h3>

          <Panel title="Updates">
            <CheckboxSetting settingKey="auto_update_enabled" label="Enable Auto Updates" />
            <CheckboxSetting settingKey="auto_update_check_on_startup" label="Check On Startup" />
            <CheckboxSetting settingKey="auto_update_allow_manual_check" label="Allow Manual Check" />
            <CheckboxSetting settingKey="auto_update_download_automatically" label="Download Automatically" />
            <CheckboxSetting settingKey="auto_update_install_on_quit" label="Install On Quit" />

            <SelectSetting
              settingKey="auto_update_channel"
              label="Update Channel"
              options={[
                { value: "latest", label: "Latest" },
                { value: "beta", label: "Beta" },
                { value: "alpha", label: "Alpha" }
              ]}
            />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Backup" && (
        <div>
          <h3>Backup / Export Settings</h3>

          <Panel title="Backup Options">
            <CheckboxSetting settingKey="backup_enabled" label="Enable Backup Features" />
            <CheckboxSetting settingKey="backup_export_json_enabled" label="Allow JSON Export" />
            <CheckboxSetting settingKey="backup_export_csv_enabled" label="Allow CSV Export" />
            <CheckboxSetting settingKey="backup_export_pdf_enabled" label="Allow PDF Export" />
            <CheckboxSetting settingKey="backup_include_settings" label="Include Settings" />
            <CheckboxSetting settingKey="backup_include_invoices" label="Include Invoices" />
            <CheckboxSetting settingKey="backup_include_inventory" label="Include Inventory" />
          </Panel>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Notifications" && (
        <div>
          <h3>Notification Settings</h3>

          <Panel title="Notifications">
            <CheckboxSetting settingKey="notification_enabled" label="Enable Notifications" />
            <CheckboxSetting settingKey="notification_low_stock_enabled" label="Low Stock Notifications" />
            <CheckboxSetting settingKey="notification_overdue_invoice_enabled" label="Overdue Invoice Notifications" />
            <CheckboxSetting settingKey="notification_estimate_expiring_enabled" label="Estimate Expiring Notifications" />
            <CheckboxSetting settingKey="notification_service_reminder_enabled" label="Service Reminder Notifications" />
          </Panel>

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
