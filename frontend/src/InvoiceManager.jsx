import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function InvoiceManager({ user }) {
  const [laborRates, setLaborRates] = useState([]);
  const [markupTiers, setMarkupTiers] = useState([]);
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState("");

  // --- ADDED START ---
  const generateEstimateNumber = () => `EST-${Date.now()}`;
  // --- ADDED END ---

  const [invoice, setInvoice] = useState({
    // --- ADDED START ---
    document_status: "Estimate",
    estimate_number: generateEstimateNumber(),
    repair_order_number: "",
    // --- ADDED END ---
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

  // --- ADDED START ---
  const [inventoryParts, setInventoryParts] = useState([]);
  const [inventoryLookupMessage, setInventoryLookupMessage] = useState("");

  const INVENTORY_TABLE_CANDIDATES = [
    "inventory_parts",
    "stock_parts",
    "parts_inventory",
    "parts"
  ];

  const getInventoryPartNumber = (part) =>
    part?.part_number ||
    part?.partNumber ||
    part?.part_no ||
    part?.sku ||
    part?.stock_number ||
    "";

  const getInventoryDescription = (part) =>
    part?.description ||
    part?.name ||
    part?.part_name ||
    part?.item_name ||
    "";

  const getInventoryCost = (part) =>
    Number(
      part?.cost ??
        part?.part_price ??
        part?.price ??
        part?.unit_cost ??
        part?.sale_price ??
        0
    );

  const getInventoryQuantity = (part) =>
    Number(
      part?.quantity ??
        part?.qty ??
        part?.stock_quantity ??
        part?.quantity_on_hand ??
        part?.on_hand ??
        0
    );

  const normalizeInventoryPart = (part, tableName) => ({
    ...part,
    inventory_table_name: tableName,
    inventory_part_id: part?.id || "",
    part_number: getInventoryPartNumber(part),
    description: getInventoryDescription(part),
    part_price: getInventoryCost(part),
    cost: getInventoryCost(part),
    available_quantity: getInventoryQuantity(part)
  });

  const loadInventoryParts = async () => {
    setInventoryLookupMessage("");

    for (const tableName of INVENTORY_TABLE_CANDIDATES) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(500);

      if (!error && Array.isArray(data)) {
        setInventoryParts(
          data.map((part) => normalizeInventoryPart(part, tableName))
        );
        setInventoryLookupMessage(
          `Inventory lookup connected to ${tableName}.`
        );
        return;
      }
    }

    setInventoryParts([]);
    setInventoryLookupMessage(
      "Inventory lookup could not find a supported inventory table. Manual parts still work."
    );
  };

  const findInventoryPart = (value) => {
    const lookup = String(value || "").trim().toLowerCase();
    if (!lookup) return null;

    return (
      inventoryParts.find((part) =>
        String(part.part_number || "").toLowerCase() === lookup
      ) ||
      inventoryParts.find((part) =>
        String(part.description || "").toLowerCase().includes(lookup)
      ) ||
      null
    );
  };

  const applyInventoryPartData = (part, inventoryPart) => {
    if (!inventoryPart) return part;

    const markupPercent = findMarkupPercent(inventoryPart.part_price);

    return {
      ...part,
      part_number: inventoryPart.part_number || part.part_number || "",
      description: inventoryPart.description || part.description || "",
      part_price: Number(inventoryPart.part_price || 0),
      cost: Number(inventoryPart.cost || inventoryPart.part_price || 0),
      markup_percent: markupPercent,
      sale_price: calculatePartSalePrice(inventoryPart.part_price, markupPercent),
      inventory_part_id: inventoryPart.inventory_part_id || "",
      inventory_table_name: inventoryPart.inventory_table_name || "",
      available_quantity: Number(inventoryPart.available_quantity || 0),
      source: "inventory"
    };
  };

  const lookupPartByNumber = (partNumber, target = {}) => {
    const found = findInventoryPart(partNumber);

    if (!found) {
      setInventoryLookupMessage(
        partNumber
          ? `No inventory match found for "${partNumber}".`
          : "Enter a part number to search inventory."
      );
      return;
    }

    if (target.laborId && target.partId) {
      setLaborItems((prev) =>
        prev.map((labor) => {
          if (labor.id !== target.laborId) return labor;

          return {
            ...labor,
            parts: (labor.parts || []).map((part) =>
              part.id === target.partId ? applyInventoryPartData(part, found) : part
            )
          };
        })
      );
    }

    if (target.partId && !target.laborId) {
      setPartItems((prev) =>
        prev.map((part) =>
          part.id === target.partId ? applyInventoryPartData(part, found) : part
        )
      );
    }

    setInventoryLookupMessage(`Loaded part ${found.part_number} from inventory.`);
  };

  const getAllInvoiceParts = () => [
    ...laborItems.flatMap((labor) =>
      (labor.parts || []).map((part) => ({
        ...part,
        attached_labor_id: labor.id
      }))
    ),
    ...partItems
  ];

  const deductInventoryForInvoice = async () => {
    const partsToDeduct = getAllInvoiceParts().filter(
      (part) => part.inventory_part_id && part.inventory_table_name
    );

    if (partsToDeduct.length === 0) return true;

    for (const part of partsToDeduct) {
      const currentQuantity = Number(part.available_quantity || 0);
      const usedQuantity = Number(part.quantity || 0);
      const nextQuantity = Math.max(0, currentQuantity - usedQuantity);

      const { error } = await supabase
        .from(part.inventory_table_name)
        .update({
          quantity: nextQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", part.inventory_part_id);

      if (error) {
        console.warn("Inventory deduction failed:", error);
        setMessage(
          `Saved, but inventory deduction failed for ${part.part_number || "a part"}: ${error.message}`
        );
        return false;
      }
    }

    return true;
  };
  // --- ADDED END ---

  useEffect(() => {
    loadInvoiceData();
    // --- ADDED START ---
    loadInventoryParts();
    // --- ADDED END ---
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

  // --- ADDED START ---
  const getSharedDocumentNumber = () =>
    invoice.estimate_number ||
    invoice.repair_order_number ||
    invoice.invoice_number ||
    generateEstimateNumber();

  const generateNewEstimateNumber = () => {
    const newNumber = generateEstimateNumber();

    setInvoice((prev) => ({
      ...prev,
      document_status: "Estimate",
      estimate_number: newNumber,
      repair_order_number: newNumber,
      invoice_number: newNumber
    }));
  };

  const moveToEstimate = () => {
    const sharedNumber = getSharedDocumentNumber();

    setInvoice((prev) => ({
      ...prev,
      document_status: "Estimate",
      estimate_number: sharedNumber,
      repair_order_number: sharedNumber,
      invoice_number: sharedNumber
    }));
  };

  const moveToRepairOrder = () => {
    const sharedNumber = getSharedDocumentNumber();

    setInvoice((prev) => ({
      ...prev,
      document_status: "Repair Order",
      estimate_number: sharedNumber,
      repair_order_number: sharedNumber,
      invoice_number: sharedNumber
    }));
  };

  const moveToInvoice = () => {
    const sharedNumber = getSharedDocumentNumber();

    setInvoice((prev) => ({
      ...prev,
      document_status: "Invoice",
      estimate_number: sharedNumber,
      repair_order_number: sharedNumber,
      invoice_number: sharedNumber
    }));
  };
  // --- ADDED END ---

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

  // --- ADDED START ---
  const calculatePartSalePrice = (partPrice, markupPercent) => {
    return Number(partPrice || 0) * (1 + Number(markupPercent || 0) / 100);
  };

  const calculatePartTotal = (part) => {
    return Number(part.sale_price || 0) * Number(part.quantity || 0);
  };

  const buildBlankPart = () => ({
    id: makeId(),
    part_number: "",
    inventory_part_id: "",
    inventory_table_name: "",
    part_price: 0,
    quantity: 1,
    markup_percent: 0,
    sale_price: 0,
    description: "",
    available_quantity: null,
    source: "manual"
  });
  // --- ADDED END ---

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
        description: "",
        // --- ADDED START ---
        parts: []
        // --- ADDED END ---
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

  // --- ADDED START ---
  const addPartToLabor = (laborId) => {
    setLaborItems((prev) =>
      prev.map((labor) => {
        if (labor.id !== laborId) return labor;

        return {
          ...labor,
          parts: [...(labor.parts || []), buildBlankPart()]
        };
      })
    );
  };

  const updateLaborPartItem = (laborId, partId, field, value) => {
    setLaborItems((prev) =>
      prev.map((labor) => {
        if (labor.id !== laborId) return labor;

        return {
          ...labor,
          parts: (labor.parts || []).map((part) => {
            if (part.id !== partId) return part;

            const numericFields = [
              "part_price",
              "cost",
              "quantity",
              "markup_percent",
              "sale_price"
            ];

            const updated = {
              ...part,
              [field]: numericFields.includes(field) ? Number(value || 0) : value
            };

            if (field === "part_price" || field === "cost") {
              const markupPercent = findMarkupPercent(value);
              updated.part_price = Number(value || 0);
              updated.cost = Number(value || 0);
              updated.markup_percent = markupPercent;
              updated.sale_price = calculatePartSalePrice(value, markupPercent);
            }

            if (field === "markup_percent") {
              updated.sale_price = calculatePartSalePrice(
                updated.part_price ?? updated.cost,
                value
              );
            }

            return updated;
          })
        };
      })
    );
  };

  const removeLaborPartItem = (laborId, partId) => {
    setLaborItems((prev) =>
      prev.map((labor) => {
        if (labor.id !== laborId) return labor;

        return {
          ...labor,
          parts: (labor.parts || []).filter((part) => part.id !== partId)
        };
      })
    );
  };
  // --- ADDED END ---

  const addPartItem = () => {
    setPartItems((prev) => [...prev, buildBlankPart()]);
  };

  const updatePartItem = (id, field, value) => {
    setPartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        // --- ADDED START ---
        const numericFields = [
          "part_price",
          "cost",
          "quantity",
          "markup_percent",
          "sale_price"
        ];
        // --- ADDED END ---

        const updated = {
          ...item,
          [field]:
            // --- ADDED START ---
            numericFields.includes(field)
              ? Number(value || 0)
              : value
            // --- ADDED END ---
        };

        // --- ADDED START ---
        if (field === "part_price" || field === "cost") {
          const markupPercent = findMarkupPercent(value);
          updated.part_price = Number(value || 0);
          updated.cost = Number(value || 0);
          updated.markup_percent = markupPercent;
          updated.sale_price = calculatePartSalePrice(value, markupPercent);
        }
        // --- ADDED END ---

        if (field === "markup_percent") {
          updated.sale_price = calculatePartSalePrice(
            updated.part_price ?? updated.cost,
            value
          );
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

  // --- ADDED START ---
  const groupedPartsSubtotal = laborItems.reduce(
    (sum, labor) =>
      sum +
      (labor.parts || []).reduce(
        (partSum, part) => partSum + calculatePartTotal(part),
        0
      ),
    0
  );
  // --- ADDED END ---

  const partsSubtotal = partItems.reduce(
    (sum, item) =>
      // --- ADDED START ---
      sum + calculatePartTotal(item),
    groupedPartsSubtotal
    // --- ADDED END ---
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
          // --- ADDED START ---
          estimate_number: invoice.estimate_number,
          repair_order_number: invoice.repair_order_number,
          document_status: invoice.document_status,
          // --- ADDED END ---
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

    const sharedNumber = getSharedDocumentNumber();

    const payload = {
      // --- ADDED START ---
      document_status: invoice.document_status,
      estimate_number: sharedNumber,
      repair_order_number: sharedNumber,
      // --- ADDED END ---
      invoice_number: sharedNumber,
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

    // --- ADDED START ---
    if (
      invoice.document_status === "Invoice" &&
      boolSetting("inventory_auto_deduct_on_invoice_save", false)
    ) {
      await deductInventoryForInvoice();
    }
    // --- ADDED END ---

    await writeAuditLog(data?.id || null);

    setMessage(`${invoice.document_status || "Invoice"} saved.`);
    return data?.id || null;
  };

  const generatePdf = async () => {
    const doc = new jsPDF("p", "pt", "letter");

    // --- ADDED START ---
    let customLayout = null;

    try {
      if (settings.pdf_layout_enabled === "true" && settings.pdf_layout_json) {
        customLayout = JSON.parse(settings.pdf_layout_json);
      }
    } catch (err) {
      console.warn("Invalid PDF layout JSON. Default PDF layout will be used.", err);
      customLayout = null;
    }
    // --- ADDED END ---

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
    const showShopFee = boolSetting("pdf_show_shop_fee", true);
    const showFooter = boolSetting("pdf_show_footer", true);

    const companyName = settings.company_name || "NPRAFS Service Center";
    const invoiceTitle =
      // --- ADDED START ---
      invoice.document_status === "Estimate"
        ? settings.estimate_title || "ESTIMATE"
        : invoice.document_status === "Repair Order"
        ? settings.repair_order_title || "REPAIR ORDER"
        : settings.invoice_title || "INVOICE";
      // --- ADDED END ---

    let y = 40;

    // --- ADDED START ---
    const getLayoutItem = (key, fallback = {}) => {
      if (!customLayout) return fallback;

      if (customLayout[key]) return { ...fallback, ...customLayout[key] };

      if (Array.isArray(customLayout.elements)) {
        const found = customLayout.elements.find((item) => item.id === key);
        if (found) return { ...fallback, ...found };
      }

      if (Array.isArray(customLayout)) {
        const found = customLayout.find((item) => item.id === key);
        if (found) return { ...fallback, ...found };
      }

      return fallback;
    };

    const getLayoutNumber = (value, fallback) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };

    const getLayoutX = (key, fallback) => {
      const item = getLayoutItem(key, {});
      return getLayoutNumber(item.x, fallback);
    };

    const getLayoutY = (key, fallback) => {
      const item = getLayoutItem(key, {});
      return getLayoutNumber(item.y, fallback);
    };

    const getLayoutWidth = (key, fallback) => {
      const item = getLayoutItem(key, {});
      return getLayoutNumber(item.width, fallback);
    };

    const useCustomPdfLayout = Boolean(customLayout);
    // --- ADDED END ---

    // --- ADDED START ---
    const sharedPdfNumber = getSharedDocumentNumber();
    const numberLabel =
      invoice.document_status === "Estimate"
        ? "Estimate #"
        : invoice.document_status === "Repair Order"
        ? "Repair Order #"
        : "Invoice #";
    // --- ADDED END ---

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
      doc.text(`${numberLabel}: ${sharedPdfNumber}`, pageWidth - margin, 75, {
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
        `${numberLabel}: ${sharedPdfNumber}    Date: ${invoice.invoice_date}`,
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
      doc.text(`${numberLabel}: ${sharedPdfNumber}`, pageWidth - margin, 82, {
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

    // --- ADDED START ---
    const billToX = getLayoutX("bill_to_block", margin);
    const billToY = getLayoutY("bill_to_block", y);
    const vehicleX = getLayoutX("vehicle_block", pageWidth / 2 + 20);
    const vehicleY = getLayoutY("vehicle_block", y);
    // --- ADDED END ---

    doc.text("Bill To", billToX, billToY);
    doc.text("Vehicle", vehicleX, vehicleY);

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
      doc.text(String(line), billToX, billToY + 18 + index * 14);
    });

    vehicleLines.forEach((line, index) => {
      doc.text(String(line), vehicleX, vehicleY + 18 + index * 14);
    });

    y += Math.max(customerLines.length, vehicleLines.length) * 14 + 30;

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(14);

    // --- ADDED START ---
    const laborTitleX = getLayoutX("labor_title", margin);
    const laborTitleY = getLayoutY("labor_title", y);
    doc.text("Labor / Parts", laborTitleX, laborTitleY);

    const laborTableY = getLayoutY("labor_table", laborTitleY + 10);
    const laborTableX = getLayoutX("labor_table", margin);
    const laborTableWidth = getLayoutWidth(
      "labor_table",
      pageWidth - margin * 2
    );

    y = laborTableY;
    // --- ADDED END ---

    const laborHead = showLaborRate
      ? [["Description", "Part #", "Rate / Price", "Hours / Qty", "Total"]]
      : [["Description", "Part #", "Hours / Qty", "Total"]];

    // --- ADDED START ---
    const groupedBodyRows = [];

    laborItems.forEach((item) => {
      if (showLaborRate) {
        groupedBodyRows.push([
          `Labor - ${item.description || item.rate_name || "Labor"} - ${Number(
            item.hours || 0
          )} Hours`,
          "",
          `$${money(item.hourly_rate)}`,
          String(Number(item.hours || 0)),
          `$${money(Number(item.hourly_rate || 0) * Number(item.hours || 0))}`
        ]);
      } else {
        groupedBodyRows.push([
          `Labor - ${item.description || item.rate_name || "Labor"} - ${Number(
            item.hours || 0
          )} Hours`,
          "",
          String(Number(item.hours || 0)),
          `$${money(Number(item.hourly_rate || 0) * Number(item.hours || 0))}`
        ]);
      }

      (item.parts || []).forEach((part) => {
        const partTotal = calculatePartTotal(part);

        if (showLaborRate) {
          groupedBodyRows.push([
            `-- Parts - ${part.description || "Part"}`,
            part.part_number || "",
            showPartUnitPrice ? `$${money(part.sale_price)}` : "",
            String(Number(part.quantity || 0)),
            `$${money(partTotal)}`
          ]);
        } else {
          groupedBodyRows.push([
            `-- Parts - ${part.description || "Part"}`,
            part.part_number || "",
            String(Number(part.quantity || 0)),
            `$${money(partTotal)}`
          ]);
        }
      });
    });

    partItems.forEach((part) => {
      const partTotal = calculatePartTotal(part);

      if (showLaborRate) {
        groupedBodyRows.push([
          `-- Parts - ${part.description || "Unassigned Part"}`,
          part.part_number || "",
          showPartUnitPrice ? `$${money(part.sale_price)}` : "",
          String(Number(part.quantity || 0)),
          `$${money(partTotal)}`
        ]);
      } else {
        groupedBodyRows.push([
          `-- Parts - ${part.description || "Unassigned Part"}`,
          part.part_number || "",
          String(Number(part.quantity || 0)),
          `$${money(partTotal)}`
        ]);
      }
    });

    const laborBody =
      groupedBodyRows.length > 0
        ? groupedBodyRows
        : showLaborRate
        ? [["No labor or part items", "", "", "", "$0.00"]]
        : [["No labor or part items", "", "", "$0.00"]];
    // --- ADDED END ---

    autoTable(doc, {
      startY: y,
      // --- ADDED START ---
      margin: useCustomPdfLayout
        ? {
            left: laborTableX,
            right: Math.max(20, pageWidth - laborTableX - laborTableWidth)
          }
        : { left: margin, right: margin },
      // --- ADDED END ---
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

    // --- ADDED START ---
    const totalsBlock = getLayoutItem("totals_block", {
      x: pageWidth - margin - 230,
      y,
      width: 230
    });

    const totalsX = getLayoutNumber(totalsBlock.x, pageWidth - margin - 230);
    const totalsWidth = getLayoutNumber(totalsBlock.width, 230);
    const valueX = totalsX + totalsWidth;
    y = getLayoutNumber(totalsBlock.y, y);
    // --- ADDED END ---

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

    // --- ADDED START ---
    // Move the separator line above the grand total with enough padding so it
    // does not cut through the Grand Total text on the PDF.
    y += 6;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(totalsX, y, valueX, y);
    y += 16;
    // --- ADDED END ---
    totalLine("Grand Total:", `$${money(grandTotal)}`, true);

    if (boolSetting("invoice_show_terms", true) && settings.invoice_disclaimer) {
      y += 20;

      if (y > pageHeight - 120) {
        doc.addPage();
        y = 50;
      }

      doc.setFont(fontFamily, "bold");
      doc.setFontSize(12);

      // --- ADDED START ---
      const termsX = getLayoutX("terms_block", margin);
      const termsY = getLayoutY("terms_block", y);
      const termsWidth = getLayoutWidth("terms_block", pageWidth - margin * 2);

      y = termsY;
      doc.text(settings.pdf_terms_title || "Terms / Disclaimer", termsX, y);
      // --- ADDED END ---

      y += 16;

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(bodySize - 1);

      const disclaimerLines = doc.splitTextToSize(
        String(settings.invoice_disclaimer),
        termsWidth
      );

      doc.text(disclaimerLines, termsX, y);
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
        `${invoice.document_status || "Invoice"} ${sharedPdfNumber}`,
        pageWidth - margin,
        pageHeight - 25,
        { align: "right" }
      );
    }

    doc.save(`${sharedPdfNumber || "invoice"}.pdf`);
  };

  const saveAndGeneratePdf = async () => {
    const savedId = await saveInvoice();

    if (savedId) {
      generatePdf();
    }
  };

  // --- ADDED START ---
  const renderPartInputs = ({
    part,
    onChange,
    onRemove,
    onLookup,
    removeLabel = "Remove Part"
  }) => (
    <div
      key={part.id}
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "1fr 1fr 1fr 2fr 1fr auto",
        marginTop: 8,
        alignItems: "start"
      }}
    >
      <label style={{ display: "block" }}>
        Part Number
        <input
          value={part.part_number || ""}
          onChange={(e) => onChange(part.id, "part_number", e.target.value)}
          onBlur={() => onLookup && onLookup(part.part_number)}
          placeholder="Enter or scan part number"
          list="inventory-parts-list"
          style={{ width: "100%" }}
        />
        <button
          type="button"
          onClick={() => onLookup && onLookup(part.part_number)}
          style={{ marginTop: 4 }}
        >
          Lookup
        </button>
      </label>

      <label style={{ display: "block" }}>
        Part Price
        <input
          type="number"
          value={part.part_price ?? part.cost ?? 0}
          onChange={(e) => onChange(part.id, "part_price", e.target.value)}
          placeholder="Enter part price"
          style={{ width: "100%" }}
        />
      </label>

      <label style={{ display: "block" }}>
        Quantity
        <input
          type="number"
          value={part.quantity}
          onChange={(e) => onChange(part.id, "quantity", e.target.value)}
          placeholder="Enter quantity"
          style={{ width: "100%" }}
        />
      </label>

      <label style={{ display: "block" }}>
        Part Description
        <input
          value={part.description}
          onChange={(e) => onChange(part.id, "description", e.target.value)}
          placeholder="Enter part description"
          style={{ width: "100%" }}
        />
      </label>

      <div>
        <div>
          <strong>Total:</strong> ${money(calculatePartTotal(part))}
        </div>
        <small>
          Markup: {money(part.markup_percent)}% | Unit: ${money(part.sale_price)}
        </small>
      </div>

      <button type="button" onClick={onRemove}>
        {removeLabel}
      </button>
    </div>
  );
  // --- ADDED END ---

  return (
    <div>
      <h2>Invoices</h2>

      {/* --- ADDED START --- */}
      <datalist id="inventory-parts-list">
        {inventoryParts.map((part) => (
          <option
            key={`${part.inventory_table_name}-${part.inventory_part_id}`}
            value={part.part_number}
          >
            {part.description} | Qty: {part.available_quantity}
          </option>
        ))}
      </datalist>

      {inventoryLookupMessage && (
        <p style={{ color: inventoryParts.length > 0 ? "#2563eb" : "#b45309" }}>
          {inventoryLookupMessage}
        </p>
      )}
      {/* --- ADDED END --- */}

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

      {/* --- ADDED START --- */}
      <h3>Estimate / Repair Order / Invoice Workflow</h3>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          marginBottom: 15
        }}
      >
        <button type="button" onClick={generateNewEstimateNumber}>
          Generate Estimate Number
        </button>

        <button type="button" onClick={moveToEstimate}>
          Mark as Estimate
        </button>

        <button type="button" onClick={moveToRepairOrder}>
          Convert to Repair Order
        </button>

        <button type="button" onClick={moveToInvoice}>
          Convert to Invoice
        </button>
      </div>

      <p>
        <strong>Current Type:</strong> {invoice.document_status}
      </p>
      <p>
        <strong>Shared Number:</strong> {getSharedDocumentNumber()}
      </p>
      {/* --- ADDED END --- */}

      <h3>Customer Info</h3>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        {/* --- ADDED START --- */}
        <input
          value={invoice.estimate_number}
          onChange={(e) => {
            const value = e.target.value;
            setInvoice((prev) => ({
              ...prev,
              estimate_number: value,
              repair_order_number: value,
              invoice_number: value
            }));
          }}
          placeholder="Estimate / RO / Invoice Number"
        />
        {/* --- ADDED END --- */}

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

      <h3>Labor With Attached Parts</h3>

      <button type="button" onClick={addLaborItem}>
        Add Labor
      </button>

      {laborItems.map((item) => (
        <div
          key={item.id}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginTop: 12,
            borderRadius: 6
          }}
        >
          <div
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
              placeholder="Enter labor hours"
            />

            <input
              type="number"
              value={item.hourly_rate}
              onChange={(e) =>
                updateLaborItem(item.id, "hourly_rate", e.target.value)
              }
              placeholder="Enter labor rate"
            />

            <input
              value={item.description}
              onChange={(e) =>
                updateLaborItem(item.id, "description", e.target.value)
              }
              placeholder="Enter labor description"
            />

            <button type="button" onClick={() => removeLaborItem(item.id)}>
              Remove Labor
            </button>
          </div>

          {/* --- ADDED START --- */}
          <div style={{ marginTop: 10, marginLeft: 20 }}>
            <button type="button" onClick={() => addPartToLabor(item.id)}>
              Add Part To This Labor
            </button>

            {(item.parts || []).map((part) =>
              renderPartInputs({
                part,
                onChange: (partId, field, value) =>
                  updateLaborPartItem(item.id, partId, field, value),
                onLookup: (partNumber) =>
                  lookupPartByNumber(partNumber, {
                    laborId: item.id,
                    partId: part.id
                  }),
                onRemove: () => removeLaborPartItem(item.id, part.id)
              })
            )}
          </div>
          {/* --- ADDED END --- */}
        </div>
      ))}

      <hr />

      <h3>Unassigned Parts</h3>
      <p>
        These are preserved from your original parts system. Use these only when
        a part does not belong under a labor line.
      </p>

      <button type="button" onClick={addPartItem}>
        Add Unassigned Part
      </button>

      {partItems.map((item) =>
        renderPartInputs({
          part: item,
          onChange: updatePartItem,
          onLookup: (partNumber) =>
            lookupPartByNumber(partNumber, {
              partId: item.id
            }),
          onRemove: () => removePartItem(item.id),
          removeLabel: "Remove"
        })
      )}

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
        Save {invoice.document_status}
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
