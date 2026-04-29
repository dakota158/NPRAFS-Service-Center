import { useEffect, useMemo, useState } from "react";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const GRID_SIZE = 10;
const SNAP_TOLERANCE = 6;

const DEFAULT_LAYOUT = [
  {
    id: "bill_to_block",
    label: "Bill To Block",
    type: "text",
    x: 40,
    y: 160,
    width: 240,
    height: 90,
    visible: true
  },
  {
    id: "vehicle_block",
    label: "Vehicle Block",
    type: "text",
    x: 330,
    y: 160,
    width: 240,
    height: 90,
    visible: true
  },
  {
    id: "labor_title",
    label: "Labor Title",
    type: "text",
    x: 40,
    y: 290,
    width: 160,
    height: 30,
    visible: true
  },
  {
    id: "labor_table",
    label: "Labor Table",
    type: "table",
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
    x: 40,
    y: 450,
    width: 160,
    height: 30,
    visible: true
  },
  {
    id: "parts_table",
    label: "Parts Table",
    type: "table",
    x: 40,
    y: 475,
    width: 532,
    height: 110,
    visible: true
  },
  {
    id: "totals_block",
    label: "Totals Block",
    type: "totals",
    x: 340,
    y: 620,
    width: 230,
    height: 110,
    visible: true
  },
  {
    id: "terms_block",
    label: "Terms / Disclaimer",
    type: "text",
    x: 40,
    y: 690,
    width: 532,
    height: 60,
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
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.72);

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
    () => layout.find((item) => item.id === selectedId) || null,
    [layout, selectedId]
  );

  const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };

  const updateElement = (id, updates) => {
    setLayout((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
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
      return {
        x: nextX,
        y: nextY,
        guides: []
      };
    }

    let adjustedX = nextX;
    let adjustedY = nextY;
    const guides = [];

    const movingEdges = getEdges(
      movingItem,
      nextX,
      nextY,
      nextWidth,
      nextHeight
    );

    const pageGuides = {
      vertical: [0, PAGE_WIDTH / 2, PAGE_WIDTH],
      horizontal: [0, PAGE_HEIGHT / 2, PAGE_HEIGHT]
    };

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

    return {
      x: adjustedX,
      y: adjustedY,
      guides
    };
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
        field === "height"
          ? Number(value || 0)
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

  const resetToDefault = () => {
    setLayout(DEFAULT_LAYOUT);

    if (onResetDefault) {
      onResetDefault();
    }
  };

  const saveLayout = () => {
    onSave(JSON.stringify(layout, null, 2));
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
  };

  const getElementBackground = (type) => {
    if (type === "table") return "#dbeafe";
    if (type === "totals") return "#dcfce7";
    return "#fde68a";
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

    return {
      ...base,
      ...positions[handle]
    };
  };

  const getPreviewElement = (id) => {
    return layout.find((item) => item.id === id && item.visible !== false);
  };

  const previewBoxStyle = (id, fallback = {}) => {
    const item = getPreviewElement(id);

    return {
      position: "absolute",
      left: safeNumber(item?.x, fallback.x || 0),
      top: safeNumber(item?.y, fallback.y || 0),
      width: safeNumber(item?.width, fallback.width || 100),
      height: safeNumber(item?.height, fallback.height || 30),
      overflow: "hidden",
      boxSizing: "border-box"
    };
  };

  const renderPreviewTable = (type) => {
    const isLabor = type === "labor";

    const rows = isLabor
      ? [
          ["Oil change labor", "$100.00", "1.0", "$100.00"],
          ["Brake inspection", "$100.00", "0.5", "$50.00"]
        ]
      : [
          ["Oil Filter", "1", "$18.99", "$18.99"],
          ["Brake Cleaner", "2", "$8.50", "$17.00"]
        ];

    const headers = isLabor
      ? ["Description", "Rate", "Hours", "Total"]
      : ["Description", "Qty", "Unit", "Total"];

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

  if (!open) return null;
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
        gridTemplateColumns: "1fr 1fr 340px",
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
                  padding: 4,
                  boxSizing: "border-box",
                  userSelect: "none",
                  fontSize: 12,
                  fontWeight: isSelected ? "bold" : "normal",
                  overflow: "hidden"
                }}
              >
                {item.label}

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

        <div style={{ marginBottom: 8 }}>
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
        </div>

        <div
          style={{
            width: PAGE_WIDTH * previewZoom,
            height: PAGE_HEIGHT * previewZoom,
            margin: "auto",
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
              fontSize: 10,
              color: "#111827"
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 40,
                top: 35,
                width: 300,
                fontWeight: "bold",
                fontSize: 18
              }}
            >
              NPRAFS Service Center
            </div>

            <div
              style={{
                position: "absolute",
                right: 40,
                top: 35,
                textAlign: "right",
                fontWeight: "bold",
                fontSize: 24
              }}
            >
              INVOICE
            </div>

            <div
              style={{
                position: "absolute",
                right: 40,
                top: 72,
                textAlign: "right",
                fontSize: 10
              }}
            >
              Invoice #: INV-1001
              <br />
              Date: 2026-04-28
            </div>

            <div style={previewBoxStyle("bill_to_block", { x: 40, y: 160, width: 240, height: 90 })}>
              <strong>Bill To</strong>
              <br />
              John Smith
              <br />
              555-123-4567
              <br />
              customer@email.com
              <br />
              123 Main Street
            </div>

            <div style={previewBoxStyle("vehicle_block", { x: 330, y: 160, width: 240, height: 90 })}>
              <strong>Vehicle</strong>
              <br />
              2018 Ford F-150
              <br />
              VIN: 1FTFW1EG0JFA00000
              <br />
              Mileage: 125,430
            </div>

            <div style={previewBoxStyle("labor_title", { x: 40, y: 290, width: 160, height: 30 })}>
              <strong style={{ fontSize: 14 }}>Labor</strong>
            </div>

            <div style={previewBoxStyle("labor_table", { x: 40, y: 315, width: 532, height: 110 })}>
              {renderPreviewTable("labor")}
            </div>

            <div style={previewBoxStyle("parts_title", { x: 40, y: 450, width: 160, height: 30 })}>
              <strong style={{ fontSize: 14 }}>Parts</strong>
            </div>

            <div style={previewBoxStyle("parts_table", { x: 40, y: 475, width: 532, height: 110 })}>
              {renderPreviewTable("parts")}
            </div>

            <div
              style={{
                ...previewBoxStyle("totals_block", { x: 340, y: 620, width: 230, height: 110 }),
                fontSize: 10
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Labor Subtotal:</span>
                <span>$150.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Parts Subtotal:</span>
                <span>$35.99</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Shop Fee:</span>
                <span>$15.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Tax:</span>
                <span>$8.04</span>
              </div>
              <hr />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "bold",
                  fontSize: 13
                }}
              >
                <span>Grand Total:</span>
                <span>$209.03</span>
              </div>
            </div>

            <div style={previewBoxStyle("terms_block", { x: 40, y: 690, width: 532, height: 60 })}>
              <strong>Terms / Disclaimer</strong>
              <br />
              Thank you for your business. Parts and labor are subject to shop policy.
            </div>

            <div
              style={{
                position: "absolute",
                left: 40,
                bottom: 25,
                fontSize: 8
              }}
            >
              Thank you for your business.
            </div>

            <div
              style={{
                position: "absolute",
                right: 40,
                bottom: 25,
                fontSize: 8
              }}
            >
              Invoice INV-1001
            </div>
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

        <p style={{ fontSize: 12, color: "#555" }}>
          Tip: select an element and use arrow keys to nudge it.
        </p>

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
          </div>
        )}

        <label style={{ display: "block", marginTop: 16 }}>
          <input
            type="checkbox"
            checked={showJsonPreview}
            onChange={(e) => setShowJsonPreview(e.target.checked)}
          />{" "}
          Show JSON preview
        </label>

        {showJsonPreview && (
          <textarea
            readOnly
            value={JSON.stringify(layout, null, 2)}
            style={{
              width: "100%",
              minHeight: 180,
              marginTop: 8,
              fontFamily: "monospace",
              fontSize: 11
            }}
          />
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
