import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function InvoiceManager({ user }) {
  const [laborRates, setLaborRates] = useState([]);
  const [markupTiers, setMarkupTiers] = useState([]);
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState("");

  const [invoice, setInvoice] = useState({
    invoice_number: `INV-${Date.now()}`,
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    vehicle_year: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_vin: "",
    vehicle_mileage: "",
    invoice_date: new Date().toISOString().slice(0, 10)
  });

  const [laborItems, setLaborItems] = useState([]);
  const [partItems, setPartItems] = useState([]);

  useEffect(() => {
    loadInvoiceData();
  }, []);

  const makeId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const loadInvoiceData = async () => {
    setMessage("");

    const { data: laborData, error: laborError } = await supabase
      .from("labor_rates")
      .select("*")
      .order("name", { ascending: true });

    const { data: markupData, error: markupError } = await supabase
      .from("markup_tiers")
      .select("*")
      .order("min", { ascending: true });

    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("*");

    if (laborError || markupError || settingsError) {
      setMessage(
        laborError?.message || markupError?.message || settingsError?.message
      );
      return;
    }

    const loadedSettings = {};
    (settingsData || []).forEach((setting) => {
      loadedSettings[setting.setting_key] = setting.setting_value;
    });

    setLaborRates(laborData || []);
    setMarkupTiers(markupData || []);
    setSettings(loadedSettings);
  };

  const money = (value) => Number(value || 0).toFixed(2);

  const boolSetting = (key, fallback = true) => {
    if (settings[key] === undefined || settings[key] === null) return fallback;
    return String(settings[key]).toLowerCase() === "true";
  };

  const updateInvoiceField = (field, value) => {
    setInvoice((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const findMarkupPercent = (cost) => {
    const numericCost = Number(cost || 0);

    const tier = markupTiers.find((item) => {
      const min = Number(item.min || 0);
      const max =
        item.max === null || item.max === undefined || item.max === ""
          ? Infinity
          : Number(item.max);

      return numericCost >= min && numericCost <= max;
    });

    return Number(tier?.percent || 0);
  };

  const addLaborItem = () => {
    const firstRate = laborRates[0];

    setLaborItems((prev) => [
      ...prev,
      {
        id: makeId(),
        labor_rate_id: firstRate?.id || "",
        rate_name: firstRate?.name || "",
        hourly_rate: Number(firstRate?.hourly_rate || 0),
        hours: 1,
        description: ""
      }
    ]);
  };

  const updateLaborItem = (id, field, value) => {
    setLaborItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (field === "labor_rate_id") {
          const selectedRate = laborRates.find((rate) => rate.id === value);

          return {
            ...item,
            labor_rate_id: value,
            rate_name: selectedRate?.name || "",
            hourly_rate: Number(selectedRate?.hourly_rate || 0)
          };
        }

        return {
          ...item,
          [field]:
            field === "hours" || field === "hourly_rate"
              ? Number(value || 0)
              : value
        };
      })
    );
  };

  const removeLaborItem = (id) => {
    setLaborItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addPartItem = () => {
    setPartItems((prev) => [
      ...prev,
      {
        id: makeId(),
        cost: 0,
        quantity: 1,
        markup_percent: 0,
        sale_price: 0,
        description: ""
      }
    ]);
  };

  const updatePartItem = (id, field, value) => {
    setPartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = {
          ...item,
          [field]:
            field === "cost" ||
            field === "quantity" ||
            field === "markup_percent" ||
            field === "sale_price"
              ? Number(value || 0)
              : value
        };

        if (field === "cost") {
          const markupPercent = findMarkupPercent(value);
          const salePrice = Number(value || 0) * (1 + markupPercent / 100);

          updated.markup_percent = markupPercent;
          updated.sale_price = salePrice;
        }

        if (field === "markup_percent") {
          updated.sale_price =
            Number(item.cost || 0) * (1 + Number(value || 0) / 100);
        }

        return updated;
      })
    );
  };

  const removePartItem = (id) => {
    setPartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const laborSubtotal = laborItems.reduce(
    (sum, item) => sum + Number(item.hourly_rate || 0) * Number(item.hours || 0),
    0
  );

  const partsSubtotal = partItems.reduce(
    (sum, item) =>
      sum + Number(item.sale_price || 0) * Number(item.quantity || 0),
    0
  );

  const shopFeeType = settings.shop_fee_type || "percent";
  const shopFeeValue = Number(settings.shop_fee_value || 0);

  const shopFee =
    shopFeeType === "flat" ? shopFeeValue : laborSubtotal * (shopFeeValue / 100);

  const taxableSubtotal = laborSubtotal + partsSubtotal + shopFee;
  const taxRate = Number(settings.tax_rate || 0);
  const taxTotal = taxableSubtotal * (taxRate / 100);
  const grandTotal = taxableSubtotal + taxTotal;

  const writeAuditLog = async (invoiceId) => {
    try {
      await supabase.from("audit_logs").insert({
        user_id: user?.id || null,
        action: "Created invoice",
        table_name: "invoices",
        record_id: invoiceId,
        details: {
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          grand_total: grandTotal
        },
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Audit log skipped:", err);
    }
  };

  const saveInvoice = async () => {
    setMessage("");

    const payload = {
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      customer_phone: invoice.customer_phone,
      customer_email: invoice.customer_email,
      customer_address: invoice.customer_address,
      vehicle_year: invoice.vehicle_year,
      vehicle_make: invoice.vehicle_make,
      vehicle_model: invoice.vehicle_model,
      vehicle_vin: invoice.vehicle_vin,
      vehicle_mileage: invoice.vehicle_mileage,
      invoice_date: invoice.invoice_date,
      labor_items: laborItems,
      part_items: partItems,
      labor_subtotal: laborSubtotal,
      parts_subtotal: partsSubtotal,
      shop_fee: shopFee,
      tax_total: taxTotal,
      grand_total: grandTotal,
      created_by: user?.id || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("invoices")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      return null;
    }

    await writeAuditLog(data?.id || null);

    setMessage("Invoice saved.");
    return data?.id || null;
  };

  const generatePdf = async () => {
    const doc = new jsPDF("p", "pt", "letter");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    const hexToRgb = (hex, fallback) => {
      const clean = String(hex || "").replace("#", "");

      if (clean.length !== 6) return fallback;

      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16)
      ];
    };

    const primaryColor = hexToRgb(settings.pdf_primary_color, [31, 41, 55]);
    const accentColor = hexToRgb(settings.pdf_accent_color, [229, 231, 235]);
    const textColor = hexToRgb(settings.pdf_text_color, [17, 24, 39]);

    const fontFamily = settings.pdf_font_family || "helvetica";
    const titleSize = Number(settings.pdf_title_size || 26);
    const companySize = Number(settings.pdf_company_size || 20);
    const bodySize = Number(settings.pdf_body_size || 10);
    const tableSize = Number(settings.pdf_table_size || 9);
    const headerStyle = settings.pdf_header_style || "classic";

    const showLaborRate = boolSetting("pdf_show_labor_rate", true);
    const showPartUnitPrice = boolSetting("pdf_show_part_unit_price", true);
    const showPartMarkup = boolSetting("pdf_show_part_markup", false);
    const showShopFee = boolSetting("pdf_show_shop_fee", true);
    const showFooter = boolSetting("pdf_show_footer", true);

    const companyName = settings.company_name || "NPRAFS Service Center";
    const invoiceTitle = settings.invoice_title || "INVOICE";

    let y = 40;

    doc.setFont(fontFamily, "normal");
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    if (headerStyle === "boxed") {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 120, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(companySize);
      doc.text(companyName, margin, 45);

      doc.setFontSize(titleSize);
      doc.text(invoiceTitle, pageWidth - margin, 45, { align: "right" });

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize);
      doc.text(`Invoice #: ${invoice.invoice_number}`, pageWidth - margin, 75, {
        align: "right"
      });
      doc.text(`Date: ${invoice.invoice_date}`, pageWidth - margin, 92, {
        align: "right"
      });

      y = 145;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    } else if (headerStyle === "centered") {
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(companySize);
      doc.text(companyName, pageWidth / 2, y, { align: "center" });

      y += 22;

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize);

      if (settings.company_address) {
        doc.text(String(settings.company_address), pageWidth / 2, y, {
          align: "center"
        });
        y += 14;
      }

      if (settings.company_phone || settings.company_email) {
        doc.text(
          `${settings.company_phone || ""}${
            settings.company_phone && settings.company_email ? " | " : ""
          }${settings.company_email || ""}`,
          pageWidth / 2,
          y,
          { align: "center" }
        );
        y += 14;
      }

      if (boolSetting("invoice_show_website", true) && settings.company_website) {
        doc.text(String(settings.company_website), pageWidth / 2, y, {
          align: "center"
        });
        y += 14;
      }

      y += 15;

      doc.setFont(fontFamily, "bold");
      doc.setFontSize(titleSize);
      doc.text(invoiceTitle, pageWidth / 2, y, { align: "center" });

      y += 20;

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize);
      doc.text(
        `Invoice #: ${invoice.invoice_number}    Date: ${invoice.invoice_date}`,
        pageWidth / 2,
        y,
        { align: "center" }
      );

      y += 30;
    } else {
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(companySize);
      doc.text(companyName, margin, y);

      y += 22;

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize);

      if (settings.company_address) {
        doc.text(String(settings.company_address), margin, y);
        y += 14;
      }

      if (settings.company_phone || settings.company_email) {
        doc.text(
          `${settings.company_phone || ""}${
            settings.company_phone && settings.company_email ? " | " : ""
          }${settings.company_email || ""}`,
          margin,
          y
        );
        y += 14;
      }

      if (boolSetting("invoice_show_website", true) && settings.company_website) {
        doc.text(String(settings.company_website), margin, y);
        y += 14;
      }

      doc.setFont(fontFamily, "bold");
      doc.setFontSize(titleSize);
      doc.text(invoiceTitle, pageWidth - margin, 50, { align: "right" });

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize + 1);
      doc.text(`Invoice #: ${invoice.invoice_number}`, pageWidth - margin, 82, {
        align: "right"
      });
      doc.text(`Date: ${invoice.invoice_date}`, pageWidth - margin, 100, {
        align: "right"
      });

      y = Math.max(y + 20, 130);
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.line(margin, y, pageWidth - margin, y);
      y += 25;
    }

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(13);
    doc.text("Bill To", margin, y);
    doc.text("Vehicle", pageWidth / 2 + 20, y);

    y += 18;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(bodySize);

    const customerLines = [
      invoice.customer_name || "-",
      invoice.customer_phone || "",
      boolSetting("invoice_show_customer_email", true)
        ? invoice.customer_email || ""
        : "",
      invoice.customer_address || ""
    ].filter(Boolean);

    const vehicleLines = [
      [invoice.vehicle_year, invoice.vehicle_make, invoice.vehicle_model]
        .filter(Boolean)
        .join(" ") || "-",
      boolSetting("invoice_show_vehicle_vin", true)
        ? `VIN: ${invoice.vehicle_vin || "-"}`
        : "",
      `Mileage: ${invoice.vehicle_mileage || "-"}`
    ].filter(Boolean);

    customerLines.forEach((line, index) => {
      doc.text(String(line), margin, y + index * 14);
    });

    vehicleLines.forEach((line, index) => {
      doc.text(String(line), pageWidth / 2 + 20, y + index * 14);
    });

    y += Math.max(customerLines.length, vehicleLines.length) * 14 + 30;

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(14);
    doc.text("Labor", margin, y);
    y += 10;

    const laborHead = showLaborRate
      ? [["Description", "Rate", "Hours", "Total"]]
      : [["Description", "Hours", "Total"]];

    const laborBody =
      laborItems.length > 0
        ? laborItems.map((item) =>
            showLaborRate
              ? [
                  item.description || item.rate_name || "Labor",
                  `$${money(item.hourly_rate)}`,
                  String(Number(item.hours || 0)),
                  `$${money(
                    Number(item.hourly_rate || 0) * Number(item.hours || 0)
                  )}`
                ]
              : [
                  item.description || item.rate_name || "Labor",
                  String(Number(item.hours || 0)),
                  `$${money(
                    Number(item.hourly_rate || 0) * Number(item.hours || 0)
                  )}`
                ]
          )
        : showLaborRate
        ? [["No labor items", "", "", "$0.00"]]
        : [["No labor items", "", "$0.00"]];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: laborHead,
      body: laborBody,
      styles: {
        font: fontFamily,
        fontSize: tableSize,
        cellPadding: 6,
        textColor
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: accentColor
      }
    });

    y = doc.lastAutoTable.finalY + 25;

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(14);
    doc.text("Parts", margin, y);
    y += 10;

    const partHead = ["Description", "Qty"];

    if (showPartMarkup) partHead.push("Markup %");
    if (showPartUnitPrice) partHead.push("Unit Price");

    partHead.push("Total");

    const partBody =
      partItems.length > 0
        ? partItems.map((item) => {
            const row = [
              item.description || "Part",
              String(Number(item.quantity || 0))
            ];

            if (showPartMarkup) row.push(`${money(item.markup_percent)}%`);
            if (showPartUnitPrice) row.push(`$${money(item.sale_price)}`);

            row.push(
              `$${money(
                Number(item.sale_price || 0) * Number(item.quantity || 0)
              )}`
            );

            return row;
          })
        : [
            [
              "No part items",
              "",
              ...(showPartMarkup ? [""] : []),
              ...(showPartUnitPrice ? [""] : []),
              "$0.00"
            ]
          ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [partHead],
      body: partBody,
      styles: {
        font: fontFamily,
        fontSize: tableSize,
        cellPadding: 6,
        textColor
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: accentColor
      }
    });

    y = doc.lastAutoTable.finalY + 25;

    const totalsX = pageWidth - margin - 230;
    const valueX = pageWidth - margin;

    const totalLine = (label, value, bold = false) => {
      doc.setFont(fontFamily, bold ? "bold" : "normal");
      doc.setFontSize(bold ? 13 : bodySize);
      doc.text(label, totalsX, y);
      doc.text(value, valueX, y, { align: "right" });
      y += bold ? 20 : 16;
    };

    totalLine("Labor Subtotal:", `$${money(laborSubtotal)}`);
    totalLine("Parts Subtotal:", `$${money(partsSubtotal)}`);

    if (showShopFee) {
      totalLine(
        shopFeeType === "percent"
          ? `Shop Fee (${money(shopFeeValue)}% labor):`
          : "Shop Fee:",
        `$${money(shopFee)}`
      );
    }

    totalLine(`Tax (${money(taxRate)}%):`, `$${money(taxTotal)}`);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(totalsX, y - 6, valueX, y - 6);
    totalLine("Grand Total:", `$${money(grandTotal)}`, true);

    if (boolSetting("invoice_show_terms", true) && settings.invoice_disclaimer) {
      y += 20;

      if (y > pageHeight - 120) {
        doc.addPage();
        y = 50;
      }

      doc.setFont(fontFamily, "bold");
      doc.setFontSize(12);
      doc.text(settings.pdf_terms_title || "Terms / Disclaimer", margin, y);

      y += 16;

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize - 1);

      const disclaimerLines = doc.splitTextToSize(
        String(settings.invoice_disclaimer),
        pageWidth - margin * 2
      );

      doc.text(disclaimerLines, margin, y);
    }

    if (showFooter) {
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      doc.text(
        settings.pdf_footer_text || "Thank you for your business.",
        margin,
        pageHeight - 25
      );

      doc.text(
        `Invoice ${invoice.invoice_number}`,
        pageWidth - margin,
        pageHeight - 25,
        { align: "right" }
      );
    }

    doc.save(`${invoice.invoice_number || "invoice"}.pdf`);
  };

  const saveAndGeneratePdf = async () => {
    const savedId = await saveInvoice();

    if (savedId) {
      generatePdf();
    }
  };

  return (
    <div>
      <h2>Invoices</h2>

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

      <h3>Customer Info</h3>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <input
          value={invoice.invoice_number}
          onChange={(e) => updateInvoiceField("invoice_number", e.target.value)}
          placeholder="Invoice Number"
        />

        <input
          type="date"
          value={invoice.invoice_date}
          onChange={(e) => updateInvoiceField("invoice_date", e.target.value)}
        />

        <input
          value={invoice.customer_name}
          onChange={(e) => updateInvoiceField("customer_name", e.target.value)}
          placeholder="Customer Name"
        />

        <input
          value={invoice.customer_phone}
          onChange={(e) => updateInvoiceField("customer_phone", e.target.value)}
          placeholder="Customer Phone"
        />

        <input
          value={invoice.customer_email}
          onChange={(e) => updateInvoiceField("customer_email", e.target.value)}
          placeholder="Customer Email"
        />

        <input
          value={invoice.customer_address}
          onChange={(e) => updateInvoiceField("customer_address", e.target.value)}
          placeholder="Customer Address"
        />
      </div>

      <h3>Vehicle Info</h3>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <input
          value={invoice.vehicle_year}
          onChange={(e) => updateInvoiceField("vehicle_year", e.target.value)}
          placeholder="Vehicle Year"
        />

        <input
          value={invoice.vehicle_make}
          onChange={(e) => updateInvoiceField("vehicle_make", e.target.value)}
          placeholder="Vehicle Make"
        />

        <input
          value={invoice.vehicle_model}
          onChange={(e) => updateInvoiceField("vehicle_model", e.target.value)}
          placeholder="Vehicle Model"
        />

        <input
          value={invoice.vehicle_vin}
          onChange={(e) => updateInvoiceField("vehicle_vin", e.target.value)}
          placeholder="VIN"
        />

        <input
          value={invoice.vehicle_mileage}
          onChange={(e) => updateInvoiceField("vehicle_mileage", e.target.value)}
          placeholder="Mileage"
        />
      </div>

      <hr />

      <h3>Labor</h3>

      <button type="button" onClick={addLaborItem}>
        Add Labor
      </button>

      {laborItems.map((item) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1.5fr 1fr 1fr 2fr auto",
            marginTop: 8
          }}
        >
          <select
            value={item.labor_rate_id}
            onChange={(e) =>
              updateLaborItem(item.id, "labor_rate_id", e.target.value)
            }
          >
            <option value="">Select Labor Rate</option>
            {laborRates.map((rate) => (
              <option key={rate.id} value={rate.id}>
                {rate.name} - ${money(rate.hourly_rate)}/hr
              </option>
            ))}
          </select>

          <input
            type="number"
            value={item.hours}
            onChange={(e) => updateLaborItem(item.id, "hours", e.target.value)}
            placeholder="Hours"
          />

          <input
            type="number"
            value={item.hourly_rate}
            onChange={(e) =>
              updateLaborItem(item.id, "hourly_rate", e.target.value)
            }
            placeholder="Rate Override"
          />

          <input
            value={item.description}
            onChange={(e) =>
              updateLaborItem(item.id, "description", e.target.value)
            }
            placeholder="Labor Description"
          />

          <button type="button" onClick={() => removeLaborItem(item.id)}>
            Remove
          </button>
        </div>
      ))}

      <hr />

      <h3>Parts</h3>

      <button type="button" onClick={addPartItem}>
        Add Part
      </button>

      {partItems.map((item) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr auto",
            marginTop: 8
          }}
        >
          <input
            type="number"
            value={item.cost}
            onChange={(e) => updatePartItem(item.id, "cost", e.target.value)}
            placeholder="Cost"
          />

          <input
            type="number"
            value={item.quantity}
            onChange={(e) => updatePartItem(item.id, "quantity", e.target.value)}
            placeholder="Qty"
          />

          <input
            type="number"
            value={item.markup_percent}
            onChange={(e) =>
              updatePartItem(item.id, "markup_percent", e.target.value)
            }
            placeholder="Markup %"
          />

          <input
            type="number"
            value={item.sale_price}
            onChange={(e) =>
              updatePartItem(item.id, "sale_price", e.target.value)
            }
            placeholder="Sale Price"
          />

          <input
            value={item.description}
            onChange={(e) =>
              updatePartItem(item.id, "description", e.target.value)
            }
            placeholder="Part Description"
          />

          <button type="button" onClick={() => removePartItem(item.id)}>
            Remove
          </button>
        </div>
      ))}

      <hr />

      <h3>Totals</h3>

      <p>Labor Subtotal: ${money(laborSubtotal)}</p>
      <p>Parts Subtotal: ${money(partsSubtotal)}</p>
      <p>
        Shop Fee: ${money(shopFee)}{" "}
        {shopFeeType === "percent"
          ? `(${money(shopFeeValue)}% of labor)`
          : "(flat fee)"}
      </p>
      <p>Tax Rate: {money(taxRate)}%</p>
      <p>Tax: ${money(taxTotal)}</p>
      <h2>Grand Total: ${money(grandTotal)}</h2>

      <button type="button" onClick={saveInvoice}>
        Save Invoice
      </button>

      <button type="button" onClick={generatePdf} style={{ marginLeft: 10 }}>
        Generate Professional PDF
      </button>

      <button type="button" onClick={saveAndGeneratePdf} style={{ marginLeft: 10 }}>
        Save + Generate PDF
      </button>
    </div>
  );
}

export default InvoiceManager;