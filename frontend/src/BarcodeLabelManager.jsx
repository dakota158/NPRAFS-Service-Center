import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function BarcodeLabelManager() {
  const [parts, setParts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [labelTitle, setLabelTitle] = useState("Shop Label");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partsResult, docsResult] = await Promise.all([
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(200)
    ]);

    if (partsResult.error || docsResult.error) {
      setMessage(partsResult.error?.message || docsResult.error?.message);
      return;
    }

    setParts(partsResult.data || []);
    setDocuments(docsResult.data || []);
  };

  const activeValue = customValue || selectedValue;

  const printLabel = () => {
    if (!activeValue) {
      setMessage("Select or enter a label value first.");
      return;
    }

    window.print();
  };

  const copyValue = async () => {
    if (!activeValue) return;

    try {
      await navigator.clipboard.writeText(activeValue);
      setMessage("Label value copied.");
    } catch {
      setMessage("Could not copy label value.");
    }
  };

  const barcodeBars = String(activeValue || "")
    .split("")
    .map((char, index) => {
      const width = (char.charCodeAt(0) % 4) + 1;
      return (
        <span
          key={`${char}-${index}`}
          style={{
            display: "inline-block",
            width,
            height: 70,
            background: index % 2 === 0 ? "#111827" : "#374151",
            marginRight: 2
          }}
        />
      );
    });

  return (
    <div>
      <h2>Barcode / Label Utility</h2>

      {message && (
        <p style={{ color: message.includes("copied") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle} className="no-print">
        <h3>Create Label</h3>

        <div style={gridStyle}>
          <label>
            Label Title
            <input
              value={labelTitle}
              onChange={(e) => setLabelTitle(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Select Part
            <select
              value={selectedValue}
              onChange={(e) => {
                setSelectedValue(e.target.value);
                setCustomValue("");
              }}
              style={inputStyle}
            >
              <option value="">Select part</option>
              {parts.map((part) => (
                <option key={part.id} value={part.part_number || part.name}>
                  {part.part_number || "No Part #"} - {part.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Select Document
            <select
              value={selectedValue}
              onChange={(e) => {
                setSelectedValue(e.target.value);
                setCustomValue("");
              }}
              style={inputStyle}
            >
              <option value="">Select invoice / RO</option>
              {documents.map((doc) => (
                <option
                  key={doc.id}
                  value={doc.invoice_number || doc.repair_order_number || doc.estimate_number}
                >
                  {doc.invoice_number || doc.repair_order_number || doc.estimate_number} -{" "}
                  {doc.customer_name || "Customer"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Custom Value
            <input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Enter custom barcode/label value"
              style={inputStyle}
            />
          </label>
        </div>

        <button type="button" onClick={printLabel}>
          Print Label
        </button>{" "}
        <button type="button" onClick={copyValue}>
          Copy Value
        </button>
      </div>

      <div style={labelPreview} className="print-label">
        <h3 style={{ margin: "0 0 8px" }}>{labelTitle}</h3>
        <div style={{ minHeight: 80, whiteSpace: "nowrap", overflow: "hidden" }}>
          {activeValue ? barcodeBars : <span>Select or enter a value</span>}
        </div>
        <p style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 2 }}>
          {activeValue || "-"}
        </p>
      </div>

      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-label, .print-label * {
              visibility: visible;
            }
            .print-label {
              position: absolute;
              left: 20px;
              top: 20px;
              width: 360px;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const labelPreview = { border: "2px solid #111827", background: "white", borderRadius: 8, padding: 18, width: 420, maxWidth: "100%", textAlign: "center" };

export default BarcodeLabelManager;
