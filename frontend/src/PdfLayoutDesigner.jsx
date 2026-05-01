import { useEffect, useMemo, useState } from "react";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const GRID_SIZE = 10;
const SNAP_TOLERANCE = 6;

const makeId = (prefix = "custom") =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const DEFAULT_LAYOUT = [
  {
    id: "company_name",
    label: "Company Name",
    type: "text",
    text: "NPRAFS Service Center",
    x: 40,
    y: 35,
    width: 280,
    height: 26,
    fontSize: 18,
    bold: true,
    align: "left",
    visible: true
  },
  {
    id: "company_address",
    label: "Company Address",
    type: "text",
    text: "123 Shop Road",
    x: 40,
    y: 64,
    width: 260,
    height: 18,
    fontSize: 9,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "company_phone",
    label: "Company Phone",
    type: "text",
    text: "555-123-4567",
    x: 40,
    y: 82,
    width: 180,
    height: 18,
    fontSize: 9,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "company_email",
    label: "Company Email",
    type: "text",
    text: "shop@example.com",
    x: 40,
    y: 100,
    width: 220,
    height: 18,
    fontSize: 9,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "invoice_title",
    // --- ADDED START ---
    label: "Document Title",
    // --- ADDED END ---
    type: "text",
    // --- ADDED START ---
    text: "ESTIMATE / REPAIR ORDER / INVOICE",
    // --- ADDED END ---
    x: 420,
    y: 35,
    width: 150,
    height: 34,
    fontSize: 24,
    bold: true,
    align: "right",
    visible: true
  },
  {
    id: "invoice_number",
    // --- ADDED START ---
    label: "Shared Estimate / RO / Invoice Number",
    // --- ADDED END ---
    type: "text",
    // --- ADDED START ---
    text: "Estimate #: EST-1001",
    // --- ADDED END ---
    x: 410,
    y: 76,
    width: 160,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "right",
    visible: true
  },
  {
    id: "invoice_date",
    label: "Invoice Date",
    type: "text",
    text: "Date: 2026-04-28",
    x: 410,
    y: 96,
    width: 160,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "right",
    visible: true
  },
    {
    id: "bill_to_title",
    label: "Bill To Title",
    type: "text",
    text: "Bill To",
    x: 40,
    y: 155,
    width: 120,
    height: 20,
    fontSize: 12,
    bold: true,
    align: "left",
    visible: true
  },
  {
    id: "customer_name",
    label: "Customer Name",
    type: "text",
    text: "John Smith",
    x: 40,
    y: 178,
    width: 220,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "customer_phone",
    label: "Customer Phone",
    type: "text",
    text: "555-123-4567",
    x: 40,
    y: 196,
    width: 220,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "customer_email",
    label: "Customer Email",
    type: "text",
    text: "customer@email.com",
    x: 40,
    y: 214,
    width: 220,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "customer_address",
    label: "Customer Address",
    type: "text",
    text: "123 Main Street",
    x: 40,
    y: 232,
    width: 240,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "vehicle_title",
    label: "Vehicle Title",
    type: "text",
    text: "Vehicle",
    x: 330,
    y: 155,
    width: 120,
    height: 20,
    fontSize: 12,
    bold: true,
    align: "left",
    visible: true
  },
  {
    id: "vehicle_info",
    label: "Vehicle Info",
    type: "text",
    text: "2018 Ford F-150",
    x: 330,
    y: 178,
    width: 220,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "vehicle_vin",
    label: "Vehicle VIN",
    type: "text",
    text: "VIN: 1FTFW1EG0JFA00000",
    x: 330,
    y: 196,
    width: 240,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "vehicle_mileage",
    label: "Vehicle Mileage",
    type: "text",
    text: "Mileage: 125,430",
    x: 330,
    y: 214,
    width: 220,
    height: 18,
    fontSize: 10,
    bold: false,
    align: "left",
    visible: true
  },
  {
    id: "labor_title",
    label: "Labor Title",
    type: "text",
    // --- ADDED START ---
    text: "Labor / Parts",
    // --- ADDED END ---
    x: 40,
    y: 290,
    width: 160,
    height: 30,
    fontSize: 14,
    bold: true,
    align: "left",
    visible: true
  },
  {
    id: "labor_table",
    // --- ADDED START ---
    label: "Grouped Labor / Parts Table",
    // --- ADDED END ---
    type: "table",
    // --- ADDED START ---
    tableType: "laborParts",
    // --- ADDED END ---
    x: 40,
    y: 315,
    width: 532,
    height: 110,
    visible: true
  },
    {
    id: "parts_title",
    label: "Parts Title",
    type: "text",
    text: "Parts",
    x: 40,
    y: 450,
    width: 160,
    height: 30,
    fontSize: 14,
    bold: true,
    align: "left",
    // --- ADDED START ---
    visible: false
    // --- ADDED END ---
  },
  {
    id: "parts_table",
    label: "Parts Table",
    type: "table",
    tableType: "parts",
    x: 40,
    y: 475,
    width: 532,
    height: 110,
    // --- ADDED START ---
    visible: false
    // --- ADDED END ---
  },

  // --- INDIVIDUAL TOTAL LINES (NO MORE GROUPED BLOCK) ---
  {
    id: "subtotal_labor",
    label: "Labor Subtotal",
    type: "text",
    text: "Labor Subtotal: $150.00",
    x: 360,
    y: 610,
    width: 210,
    height: 18,
    fontSize: 10,
    align: "right",
    visible: true
  },
  {
    id: "subtotal_parts",
    label: "Parts Subtotal",
    type: "text",
    text: "Parts Subtotal: $35.99",
    x: 360,
    y: 628,
    width: 210,
    height: 18,
    fontSize: 10,
    align: "right",
    visible: true
  },
  {
    id: "shop_fee_line",
    label: "Shop Fee",
    type: "text",
    text: "Shop Fee: $15.00",
    x: 360,
    y: 646,
    width: 210,
    height: 18,
    fontSize: 10,
    align: "right",
    visible: true
  },
  {
    id: "tax_line",
    label: "Tax Line",
    type: "text",
    text: "Tax: $8.04",
    x: 360,
    y: 664,
    width: 210,
    height: 18,
    fontSize: 10,
    align: "right",
    visible: true
  },
  {
    id: "grand_total",
    label: "Grand Total",
    type: "text",
    text: "Total: $209.03",
    x: 360,
    y: 690,
    width: 210,
    height: 22,
    fontSize: 13,
    bold: true,
    align: "right",
    visible: true
  },

  {
    id: "terms_block",
    label: "Terms / Disclaimer",
    type: "text",
    text: "Thank you for your business.",
    x: 40,
    y: 720,
    width: 532,
    height: 50,
    fontSize: 9,
    align: "left",
    visible: true
  }
];
function PdfLayoutDesigner({
  open,
  onClose,
  layoutJson,
  onSave,
  onResetDefault
}) {
  const [layout, setLayout] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToAlignment, setSnapToAlignment] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [alignmentGuides, setAlignmentGuides] = useState([]);
  const [previewZoom, setPreviewZoom] = useState(0.72);

  // --- LOAD / INIT ---
  useEffect(() => {
    if (!open) return;

    try {
      const parsed = JSON.parse(layoutJson || "[]");

      if (Array.isArray(parsed) && parsed.length > 0) {
        setLayout(parsed);
      } else {
        setLayout(DEFAULT_LAYOUT);
      }
    } catch {
      setLayout(DEFAULT_LAYOUT);
    }
  }, [open, layoutJson]);

  const selectedElement = useMemo(
    () => layout.find((i) => i.id === selectedId),
    [layout, selectedId]
  );

  const updateElement = (id, updates) => {
    setLayout((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  // --- ADDED START (CUSTOM ELEMENT CREATION) ---

  const addTextElement = () => {
    setLayout((prev) => [
      ...prev,
      {
        id: makeId("text"),
        label: "Custom Text",
        type: "text",
        text: "New Text",
        x: 100,
        y: 100,
        width: 200,
        height: 30,
        fontSize: 10,
        bold: false,
        align: "left",
        visible: true
      }
    ]);
  };

  const addBoxElement = () => {
    setLayout((prev) => [
      ...prev,
      {
        id: makeId("box"),
        label: "Box",
        type: "box",
        x: 100,
        y: 150,
        width: 200,
        height: 80,
        border: true,
        background: "#ffffff",
        visible: true
      }
    ]);
  };

  const addLineElement = () => {
    setLayout((prev) => [
      ...prev,
      {
        id: makeId("line"),
        label: "Line",
        type: "line",
        x: 100,
        y: 200,
        width: 200,
        height: 1,
        visible: true
      }
    ]);
  };

  // --- ADDED END ---

  const saveLayout = () => {
    onSave(JSON.stringify(layout, null, 2));
  };

  const resetToDefault = () => {
    setLayout(DEFAULT_LAYOUT);
    onResetDefault && onResetDefault();
  };

  if (!open) return null;
    const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };

  const snapValue = (value) => {
    if (!snapToGrid) return Math.round(value);
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const getEdges = (item, xOverride, yOverride, widthOverride, heightOverride) => {
    const x = safeNumber(xOverride ?? item?.x, 0);
    const y = safeNumber(yOverride ?? item?.y, 0);
    const width = safeNumber(widthOverride ?? item?.width, 100);
    const height = safeNumber(heightOverride ?? item?.height, 30);

    return {
      left: x,
      centerX: x + width / 2,
      right: x + width,
      top: y,
      centerY: y + height / 2,
      bottom: y + height,
      width,
      height
    };
  };

  const applyAlignmentSnap = (movingItem, nextX, nextY, nextWidth, nextHeight) => {
    if (!snapToAlignment || !movingItem) {
      return { x: nextX, y: nextY, guides: [] };
    }

    let adjustedX = nextX;
    let adjustedY = nextY;
    const guides = [];

    const pageGuides = {
      vertical: [0, PAGE_WIDTH / 2, PAGE_WIDTH],
      horizontal: [0, PAGE_HEIGHT / 2, PAGE_HEIGHT]
    };

    const movingEdges = getEdges(
      movingItem,
      nextX,
      nextY,
      nextWidth,
      nextHeight
    );

    pageGuides.vertical.forEach((guideX) => {
      if (Math.abs(movingEdges.left - guideX) <= SNAP_TOLERANCE) {
        adjustedX += guideX - movingEdges.left;
        guides.push({ type: "vertical", x: guideX });
      }

      if (Math.abs(movingEdges.centerX - guideX) <= SNAP_TOLERANCE) {
        adjustedX += guideX - movingEdges.centerX;
        guides.push({ type: "vertical", x: guideX });
      }

      if (Math.abs(movingEdges.right - guideX) <= SNAP_TOLERANCE) {
        adjustedX += guideX - movingEdges.right;
        guides.push({ type: "vertical", x: guideX });
      }
    });

    pageGuides.horizontal.forEach((guideY) => {
      if (Math.abs(movingEdges.top - guideY) <= SNAP_TOLERANCE) {
        adjustedY += guideY - movingEdges.top;
        guides.push({ type: "horizontal", y: guideY });
      }

      if (Math.abs(movingEdges.centerY - guideY) <= SNAP_TOLERANCE) {
        adjustedY += guideY - movingEdges.centerY;
        guides.push({ type: "horizontal", y: guideY });
      }

      if (Math.abs(movingEdges.bottom - guideY) <= SNAP_TOLERANCE) {
        adjustedY += guideY - movingEdges.bottom;
        guides.push({ type: "horizontal", y: guideY });
      }
    });

    layout.forEach((item) => {
      if (item.id === movingItem.id || item.visible === false) return;

      const itemEdges = getEdges(item);
      const movingNow = getEdges(
        movingItem,
        adjustedX,
        adjustedY,
        nextWidth,
        nextHeight
      );

      const verticalChecks = [
        { moving: movingNow.left, target: itemEdges.left },
        { moving: movingNow.left, target: itemEdges.right },
        { moving: movingNow.centerX, target: itemEdges.centerX },
        { moving: movingNow.right, target: itemEdges.left },
        { moving: movingNow.right, target: itemEdges.right }
      ];

      verticalChecks.forEach((check) => {
        if (Math.abs(check.moving - check.target) <= SNAP_TOLERANCE) {
          adjustedX += check.target - check.moving;
          guides.push({ type: "vertical", x: check.target });
        }
      });

      const horizontalChecks = [
        { moving: movingNow.top, target: itemEdges.top },
        { moving: movingNow.top, target: itemEdges.bottom },
        { moving: movingNow.centerY, target: itemEdges.centerY },
        { moving: movingNow.bottom, target: itemEdges.top },
        { moving: movingNow.bottom, target: itemEdges.bottom }
      ];

      horizontalChecks.forEach((check) => {
        if (Math.abs(check.moving - check.target) <= SNAP_TOLERANCE) {
          adjustedY += check.target - check.moving;
          guides.push({ type: "horizontal", y: check.target });
        }
      });
    });

    return { x: adjustedX, y: adjustedY, guides };
  };

  const startDrag = (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(item.id);

    setDragState({
      id: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: safeNumber(item.x, 0),
      startY: safeNumber(item.y, 0)
    });
  };

  const startResize = (e, item, handle) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedId(item.id);

    setResizeState({
      id: item.id,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: safeNumber(item.x, 0),
      startY: safeNumber(item.y, 0),
      startWidth: safeNumber(item.width, 100),
      startHeight: safeNumber(item.height, 30)
    });
  };
    const onMouseMove = (e) => {
    if (dragState) {
      const dx = e.clientX - dragState.startMouseX;
      const dy = e.clientY - dragState.startMouseY;

      const el = layout.find((item) => item.id === dragState.id);
      if (!el) return;

      const width = safeNumber(el.width, 100);
      const height = safeNumber(el.height, 30);

      let x = clamp(dragState.startX + dx, 0, PAGE_WIDTH - width);
      let y = clamp(dragState.startY + dy, 0, PAGE_HEIGHT - height);

      x = snapValue(x);
      y = snapValue(y);

      const snapped = applyAlignmentSnap(el, x, y, width, height);

      x = clamp(snapped.x, 0, PAGE_WIDTH - width);
      y = clamp(snapped.y, 0, PAGE_HEIGHT - height);

      setAlignmentGuides(snapped.guides);

      updateElement(dragState.id, {
        x: Math.round(x),
        y: Math.round(y)
      });

      return;
    }

    if (resizeState) {
      const dx = e.clientX - resizeState.startMouseX;
      const dy = e.clientY - resizeState.startMouseY;

      const el = layout.find((item) => item.id === resizeState.id);
      if (!el) return;

      let nextX = resizeState.startX;
      let nextY = resizeState.startY;
      let nextWidth = resizeState.startWidth;
      let nextHeight = resizeState.startHeight;

      if (resizeState.handle.includes("e")) {
        nextWidth = resizeState.startWidth + dx;
      }

      if (resizeState.handle.includes("s")) {
        nextHeight = resizeState.startHeight + dy;
      }

      if (resizeState.handle.includes("w")) {
        nextX = resizeState.startX + dx;
        nextWidth = resizeState.startWidth - dx;
      }

      if (resizeState.handle.includes("n")) {
        nextY = resizeState.startY + dy;
        nextHeight = resizeState.startHeight - dy;
      }

      nextWidth = clamp(snapValue(nextWidth), 30, PAGE_WIDTH - nextX);
      nextHeight = clamp(snapValue(nextHeight), 20, PAGE_HEIGHT - nextY);
      nextX = clamp(snapValue(nextX), 0, PAGE_WIDTH - nextWidth);
      nextY = clamp(snapValue(nextY), 0, PAGE_HEIGHT - nextHeight);

      const snapped = applyAlignmentSnap(
        el,
        nextX,
        nextY,
        nextWidth,
        nextHeight
      );

      nextX = clamp(snapped.x, 0, PAGE_WIDTH - nextWidth);
      nextY = clamp(snapped.y, 0, PAGE_HEIGHT - nextHeight);

      setAlignmentGuides(snapped.guides);

      updateElement(resizeState.id, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight)
      });
    }
  };

  const onMouseUp = () => {
    setDragState(null);
    setResizeState(null);
    setAlignmentGuides([]);
  };

  const updateSelectedField = (field, value) => {
    if (!selectedElement) return;

    updateElement(selectedElement.id, {
      [field]:
        field === "x" ||
        field === "y" ||
        field === "width" ||
        field === "height" ||
        field === "fontSize"
          ? Number(value || 0)
          : field === "bold" || field === "visible"
          ? Boolean(value)
          : value
    });
  };

  const toggleVisible = (id) => {
    setLayout((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, visible: item.visible === false } : item
      )
    );
  };

  const deleteElement = (id) => {
    setLayout((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId("");
  };

  const duplicateElement = (item) => {
    const copy = {
      ...item,
      id: makeId(item.type || "copy"),
      label: `${item.label || "Element"} Copy`,
      x: safeNumber(item.x, 0) + 20,
      y: safeNumber(item.y, 0) + 20
    };

    setLayout((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const nudgeSelected = (dx, dy) => {
    if (!selectedElement) return;

    const width = safeNumber(selectedElement.width, 100);
    const height = safeNumber(selectedElement.height, 30);
    const step = snapToGrid ? GRID_SIZE : 1;

    const nextX = clamp(
      safeNumber(selectedElement.x, 0) + dx * step,
      0,
      PAGE_WIDTH - width
    );

    const nextY = clamp(
      safeNumber(selectedElement.y, 0) + dy * step,
      0,
      PAGE_HEIGHT - height
    );

    updateElement(selectedElement.id, {
      x: Math.round(nextX),
      y: Math.round(nextY)
    });
  };

  const handleKeyDown = (e) => {
    if (!selectedElement) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudgeSelected(-1, 0);
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      nudgeSelected(1, 0);
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      nudgeSelected(0, -1);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      nudgeSelected(0, 1);
    }

    if (e.key === "Delete" && selectedElement.id.startsWith("custom")) {
      e.preventDefault();
      deleteElement(selectedElement.id);
    }
  };
    const resizeHandles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  const getResizeHandleStyle = (handle) => {
    const base = {
      position: "absolute",
      width: 8,
      height: 8,
      background: "#2563eb",
      border: "1px solid #fff",
      boxSizing: "border-box",
      zIndex: 5
    };

    const positions = {
      nw: { left: -5, top: -5, cursor: "nwse-resize" },
      n: {
        left: "50%",
        top: -5,
        transform: "translateX(-50%)",
        cursor: "ns-resize"
      },
      ne: { right: -5, top: -5, cursor: "nesw-resize" },
      e: {
        right: -5,
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "ew-resize"
      },
      se: { right: -5, bottom: -5, cursor: "nwse-resize" },
      s: {
        left: "50%",
        bottom: -5,
        transform: "translateX(-50%)",
        cursor: "ns-resize"
      },
      sw: { left: -5, bottom: -5, cursor: "nesw-resize" },
      w: {
        left: -5,
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "ew-resize"
      }
    };

    return { ...base, ...positions[handle] };
  };

  const getElementBackground = (type) => {
    if (type === "table") return "#dbeafe";
    if (type === "box") return "#f8fafc";
    if (type === "line") return "#111827";
    return "#fde68a";
  };

  const renderPreviewTable = (type) => {
    // --- ADDED START ---
    const isLaborParts = type === "laborParts";
    const isLabor = type === "labor";

    const headers = isLaborParts
      ? ["Description", "Rate", "Hours / Qty", "Total"]
      : isLabor
      ? ["Description", "Rate", "Hours", "Total"]
      : ["Description", "Qty", "Unit", "Total"];

    const rows = isLaborParts
      ? [
          ["Labor - Brakes R&R - 2 Hours", "$100.00", "2", "$200.00"],
          ["-- Parts - Brake Pads", "$65.00", "1", "$65.00"],
          ["Labor - Rotors R&R - 0.5 Hours", "$100.00", "0.5", "$50.00"],
          ["-- Parts - Rotors", "$120.00", "2", "$240.00"]
        ]
      : isLabor
      ? [
          ["Oil change labor", "$100.00", "1.0", "$100.00"],
          ["Brake inspection", "$100.00", "0.5", "$50.00"]
        ]
      : [
          ["Oil Filter", "1", "$18.99", "$18.99"],
          ["Brake Cleaner", "2", "$8.50", "$17.00"]
        ];
    // --- ADDED END ---

    return (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 8
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                style={{
                  border: "1px solid #999",
                  padding: 3,
                  textAlign: "left",
                  background: "#1f2937",
                  color: "#fff"
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  style={{
                    border: "1px solid #bbb",
                    padding: 3
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderPreviewElement = (item) => {
    if (item.visible === false) return null;

    const baseStyle = {
      position: "absolute",
      left: safeNumber(item.x, 0),
      top: safeNumber(item.y, 0),
      width: safeNumber(item.width, 100),
      height: safeNumber(item.height, 30),
      overflow: "hidden",
      boxSizing: "border-box",
      fontSize: safeNumber(item.fontSize, 10),
      fontWeight: item.bold ? "bold" : "normal",
      textAlign: item.align || "left",
      color: item.color || "#111827",
      whiteSpace: "pre-wrap"
    };

    if (item.type === "table") {
      return (
        <div key={item.id} style={baseStyle}>
          {renderPreviewTable(item.tableType)}
        </div>
      );
    }

    if (item.type === "box") {
      return (
        <div
          key={item.id}
          style={{
            ...baseStyle,
            background: item.background || "transparent",
            border: item.border === false ? "none" : "1px solid #111827"
          }}
        />
      );
    }

    if (item.type === "line") {
      return (
        <div
          key={item.id}
          style={{
            position: "absolute",
            left: safeNumber(item.x, 0),
            top: safeNumber(item.y, 0),
            width: safeNumber(item.width, 100),
            height: Math.max(1, safeNumber(item.height, 1)),
            background: item.color || "#111827"
          }}
        />
      );
    }

    return (
      <div key={item.id} style={baseStyle}>
        {item.text || item.label}
      </div>
    );
  };

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        background: "#111827",
        zIndex: 9999,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 360px",
        gap: 0,
        outline: "none"
      }}
    >
      <div style={{ padding: 16, overflow: "auto", background: "#f3f4f6" }}>
        <h3 style={{ marginTop: 0 }}>Edit Layout</h3>

        <div
          style={{
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            position: "relative",
            border: "1px solid #aaa",
            margin: "auto",
            backgroundColor: "#fff",
            backgroundImage: showGrid
              ? "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)"
              : "none",
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
          }}
        >
          {layout.map((item) => {
            if (item.visible === false) return null;

            const isSelected = selectedId === item.id;

            return (
              <div
                key={item.id}
                onMouseDown={(e) => startDrag(e, item)}
                style={{
                  position: "absolute",
                  left: safeNumber(item.x, 0),
                  top: safeNumber(item.y, 0),
                  width: safeNumber(item.width, 100),
                  height: safeNumber(item.height, 30),
                  border: isSelected
                    ? "2px solid #2563eb"
                    : "1px dashed #444",
                  background: getElementBackground(item.type),
                  cursor: "move",
                  padding: item.type === "line" ? 0 : 4,
                  boxSizing: "border-box",
                  userSelect: "none",
                  fontSize: 12,
                  fontWeight: isSelected ? "bold" : "normal",
                  overflow: "hidden"
                }}
              >
                {item.type === "line" ? "" : item.label}

                {isSelected &&
                  resizeHandles.map((handle) => (
                    <span
                      key={handle}
                      onMouseDown={(e) => startResize(e, item, handle)}
                      style={getResizeHandleStyle(handle)}
                    />
                  ))}
              </div>
            );
          })}

          {alignmentGuides.map((guide, index) =>
            guide.type === "vertical" ? (
              <div
                key={`v-${index}`}
                style={{
                  position: "absolute",
                  left: guide.x,
                  top: 0,
                  width: 1,
                  height: PAGE_HEIGHT,
                  background: "red",
                  pointerEvents: "none"
                }}
              />
            ) : (
              <div
                key={`h-${index}`}
                style={{
                  position: "absolute",
                  left: 0,
                  top: guide.y,
                  width: PAGE_WIDTH,
                  height: 1,
                  background: "red",
                  pointerEvents: "none"
                }}
              />
            )
          )}
        </div>
      </div>

      <div style={{ padding: 16, overflow: "auto", background: "#e5e7eb" }}>
        <h3 style={{ marginTop: 0 }}>Live PDF Preview</h3>

        <label>
          Preview Zoom{" "}
          <input
            type="range"
            min="0.45"
            max="1"
            step="0.05"
            value={previewZoom}
            onChange={(e) => setPreviewZoom(Number(e.target.value))}
          />
        </label>

        <div
          style={{
            width: PAGE_WIDTH * previewZoom,
            height: PAGE_HEIGHT * previewZoom,
            margin: "12px auto",
            background: "#fff",
            boxShadow: "0 0 12px rgba(0,0,0,0.25)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              transform: `scale(${previewZoom})`,
              transformOrigin: "top left",
              position: "relative",
              background: "#fff",
              fontFamily: "Arial, sans-serif",
              color: "#111827"
            }}
          >
            {layout.map((item) => renderPreviewElement(item))}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 16,
          background: "#ffffff",
          borderLeft: "1px solid #ddd",
          overflow: "auto"
        }}
      >
        <h3 style={{ marginTop: 0 }}>Designer Controls</h3>

        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={addTextElement}>
            Add Custom Text
          </button>

          <button type="button" onClick={addBoxElement}>
            Add Box
          </button>

          <button type="button" onClick={addLineElement}>
            Add Line
          </button>
        </div>

        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />{" "}
          Snap to grid
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={snapToAlignment}
            onChange={(e) => setSnapToAlignment(e.target.checked)}
          />{" "}
          Snap to alignment guides
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />{" "}
          Show grid background
        </label>

        <h4>Elements</h4>

        {layout.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 6
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              style={{
                flex: 1,
                textAlign: "left",
                fontWeight: selectedId === item.id ? "bold" : "normal"
              }}
            >
              {item.label}
            </button>

            <button type="button" onClick={() => toggleVisible(item.id)}>
              {item.visible === false ? "Show" : "Hide"}
            </button>

            <button type="button" onClick={() => duplicateElement(item)}>
              Copy
            </button>

            <button type="button" onClick={() => deleteElement(item.id)}>
              X
            </button>
          </div>
        ))}

        {selectedElement && (
          <div style={{ marginTop: 16 }}>
            <h4>Selected Element</h4>

            <label style={{ display: "block", marginBottom: 8 }}>
              Label
              <input
                value={selectedElement.label || ""}
                onChange={(e) => updateSelectedField("label", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            {selectedElement.type === "text" && (
              <label style={{ display: "block", marginBottom: 8 }}>
                Text
                <textarea
                  value={selectedElement.text || ""}
                  onChange={(e) => updateSelectedField("text", e.target.value)}
                  style={{ width: "100%", minHeight: 70 }}
                />
              </label>
            )}

            <label style={{ display: "block", marginBottom: 8 }}>
              X
              <input
                type="number"
                value={selectedElement.x || 0}
                onChange={(e) => updateSelectedField("x", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Y
              <input
                type="number"
                value={selectedElement.y || 0}
                onChange={(e) => updateSelectedField("y", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Width
              <input
                type="number"
                value={selectedElement.width || 0}
                onChange={(e) => updateSelectedField("width", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Height
              <input
                type="number"
                value={selectedElement.height || 0}
                onChange={(e) => updateSelectedField("height", e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            {selectedElement.type === "text" && (
              <>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Font Size
                  <input
                    type="number"
                    value={selectedElement.fontSize || 10}
                    onChange={(e) =>
                      updateSelectedField("fontSize", e.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: 8 }}>
                  Text Align
                  <select
                    value={selectedElement.align || "left"}
                    onChange={(e) =>
                      updateSelectedField("align", e.target.value)
                    }
                    style={{ width: "100%" }}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>

                <label style={{ display: "block", marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.bold)}
                    onChange={(e) =>
                      updateSelectedField("bold", e.target.checked)
                    }
                  />{" "}
                  Bold
                </label>
              </>
            )}

            {(selectedElement.type === "text" ||
              selectedElement.type === "line") && (
              <label style={{ display: "block", marginBottom: 8 }}>
                Color
                <input
                  type="color"
                  value={selectedElement.color || "#111827"}
                  onChange={(e) => updateSelectedField("color", e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            )}

            {selectedElement.type === "box" && (
              <>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Background
                  <input
                    type="color"
                    value={selectedElement.background || "#ffffff"}
                    onChange={(e) =>
                      updateSelectedField("background", e.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedElement.border !== false}
                    onChange={(e) =>
                      updateSelectedField("border", e.target.checked)
                    }
                  />{" "}
                  Show Border
                </label>
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
          <button type="button" onClick={saveLayout}>
            Save Layout
          </button>

          <button type="button" onClick={resetToDefault}>
            Reset Default
          </button>

          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PdfLayoutDesigner;
