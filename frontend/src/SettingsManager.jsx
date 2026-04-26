import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function SettingsManager({ user, activeSettingsTab = "Settings General" }) {
  const role = user?.role || "Tech";

  const canEditSettings =
    role === "IT" || role === "admin" || role === "Admin";

  const [message, setMessage] = useState("");
  const [laborRates, setLaborRates] = useState([]);
  const [markupTiers, setMarkupTiers] = useState([]);

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

  const saveSettings = async () => {
    setMessage("");

    for (const key of Object.keys(settings)) {
      const { error } = await supabase.from("app_settings").upsert({
        setting_key: key,
        setting_value: String(settings[key] ?? ""),
        description: "System setting",
        updated_at: new Date().toISOString()
      });

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
              message.includes("saved") || message.includes("deleted")
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

      {activeSettingsTab === "Settings PDF" && (
        <div>
          <h3>PDF Layout Customization</h3>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <label>
              Primary Color
              <input
                type="color"
                value={settings.pdf_primary_color || "#1f2937"}
                onChange={(e) => updateSetting("pdf_primary_color", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Accent Color
              <input
                type="color"
                value={settings.pdf_accent_color || "#e5e7eb"}
                onChange={(e) => updateSetting("pdf_accent_color", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Text Color
              <input
                type="color"
                value={settings.pdf_text_color || "#111827"}
                onChange={(e) => updateSetting("pdf_text_color", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <SelectSetting
              settingKey="pdf_font_family"
              label="Font"
              options={[
                { value: "helvetica", label: "Helvetica" },
                { value: "times", label: "Times" },
                { value: "courier", label: "Courier" }
              ]}
            />

            <SelectSetting
              settingKey="pdf_header_style"
              label="Header Style"
              options={[
                { value: "classic", label: "Classic" },
                { value: "centered", label: "Centered" },
                { value: "boxed", label: "Boxed" }
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

            <SelectSetting
              settingKey="pdf_orientation"
              label="Orientation"
              options={[
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" }
              ]}
            />

            <SelectSetting
              settingKey="pdf_logo_position"
              label="Logo Position"
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" }
              ]}
            />

            <SelectSetting
              settingKey="pdf_footer_style"
              label="Footer Style"
              options={[
                { value: "simple", label: "Simple" },
                { value: "centered", label: "Centered" },
                { value: "none", label: "None" }
              ]}
            />

            <TextSetting settingKey="pdf_logo_width" label="Logo Width" type="number" />
            <TextSetting settingKey="pdf_title_size" label="Invoice Title Size" type="number" />
            <TextSetting settingKey="pdf_company_size" label="Company Name Size" type="number" />
            <TextSetting settingKey="pdf_body_size" label="Body Font Size" type="number" />
            <TextSetting settingKey="pdf_table_size" label="Table Font Size" type="number" />
            <TextSetting settingKey="pdf_terms_title" label="Terms Title" />
            <TextSetting settingKey="pdf_footer_text" label="Footer Text" />
            <TextSetting settingKey="pdf_paid_stamp_text" label="Paid Stamp Text" />
            <TextSetting settingKey="pdf_void_stamp_text" label="Void Stamp Text" />
          </div>

          <h4>PDF Visibility</h4>
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

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Features" && (
        <div>
          <h3>Feature Toggles</h3>

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

      {activeSettingsTab === "Settings Tax" && (
        <div>
          <h3>Tax Settings</h3>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <TextSetting settingKey="tax_label" label="Tax Label" />
            <TextSetting settingKey="tax_rate" label="Tax Rate %" type="number" />
          </div>

          <h4>Tax Rules</h4>
          <CheckboxSetting settingKey="tax_enabled" label="Enable Tax" />
          <CheckboxSetting settingKey="tax_labor_enabled" label="Tax Labor" />
          <CheckboxSetting settingKey="tax_parts_enabled" label="Tax Parts" />
          <CheckboxSetting settingKey="tax_shop_fee_enabled" label="Tax Shop Fee" />
          <CheckboxSetting settingKey="tax_exempt_enabled" label="Allow Tax-Exempt Customer Option" />
          <CheckboxSetting settingKey="tax_exempt_reason_required" label="Require Tax-Exempt Reason" />

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Shop Fees" && (
        <div>
          <h3>Shop Fee Settings</h3>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <TextSetting settingKey="shop_fee_label" label="Shop Fee Label" />

            <SelectSetting
              settingKey="shop_fee_type"
              label="Shop Fee Type"
              options={[
                { value: "percent", label: "Percent of Labor" },
                { value: "flat", label: "Flat Fee" }
              ]}
            />

            <TextSetting settingKey="shop_fee_value" label="Shop Fee Value" type="number" />
            <TextSetting settingKey="shop_fee_minimum" label="Minimum Shop Fee" type="number" />
            <TextSetting settingKey="shop_fee_maximum" label="Maximum Shop Fee / Cap" type="number" />
          </div>

          <h4>Shop Fee Rules</h4>
          <CheckboxSetting settingKey="shop_fee_enabled" label="Enable Shop Fee" />
          <CheckboxSetting settingKey="shop_fee_taxable" label="Shop Fee Is Taxable" />
          <CheckboxSetting settingKey="shop_fee_override_enabled" label="Allow Shop Fee Override Per Invoice" />

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Permissions" && (
        <div>
          <h3>Role Permission Settings</h3>
          <p>
            Use comma-separated role names. Example:{" "}
            <strong>Tech,Manager,IT,Admin,admin</strong>
          </p>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <TextSetting settingKey="permission_invoice_create_roles" label="Can Create Invoices" />
            <TextSetting settingKey="permission_invoice_edit_roles" label="Can Edit Invoices" />
            <TextSetting settingKey="permission_invoice_delete_roles" label="Can Delete Invoices" />
            <TextSetting settingKey="permission_invoice_void_roles" label="Can Void Invoices" />
            <TextSetting settingKey="permission_labor_override_roles" label="Can Override Labor Rates" />
            <TextSetting settingKey="permission_markup_override_roles" label="Can Override Markup" />
            <TextSetting settingKey="permission_view_cost_profit_roles" label="Can View Cost / Profit" />
            <TextSetting settingKey="permission_pdf_generate_roles" label="Can Generate PDFs" />
            <TextSetting settingKey="permission_invoice_settings_roles" label="Can Change Invoice Settings" />
          </div>

          <SectionActions />
        </div>
      )}

      {activeSettingsTab === "Settings Audit" && (
        <div>
          <h3>Audit / Security Settings</h3>

          <CheckboxSetting settingKey="audit_invoice_create_enabled" label="Log Invoice Creation" />
          <CheckboxSetting settingKey="audit_invoice_edit_enabled" label="Log Invoice Edits" />
          <CheckboxSetting settingKey="audit_invoice_pdf_enabled" label="Log PDF Generation" />
          <CheckboxSetting settingKey="audit_invoice_delete_enabled" label="Log Invoice Deletion" />
          <CheckboxSetting settingKey="audit_invoice_void_enabled" label="Log Invoice Voiding" />
          <CheckboxSetting settingKey="audit_price_override_enabled" label="Log Price Overrides" />
          <CheckboxSetting settingKey="audit_override_reason_required" label="Require Reason For Overrides" />
          <CheckboxSetting settingKey="audit_discount_approval_required" label="Require Manager/Admin Approval For Discounts" />
          <CheckboxSetting settingKey="audit_lock_paid_invoice_enabled" label="Lock Invoice After Marked Paid" />

          <SectionActions />
        </div>
      )}
    </div>
  );
}

export default SettingsManager;