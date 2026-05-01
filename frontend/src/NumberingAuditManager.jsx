import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function NumberingAuditManager() {
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments(data || []);
  };

  const audit = useMemo(() => {
    const numbers = {};

    documents.forEach((doc) => {
      const docNumbers = [
        doc.estimate_number,
        doc.repair_order_number,
        doc.invoice_number
      ].filter(Boolean);

      docNumbers.forEach((number) => {
        numbers[number] = numbers[number] || [];
        numbers[number].push(doc);
      });
    });

    const duplicates = Object.entries(numbers)
      .filter(([, docs]) => docs.length > 1)
      .map(([number, docs]) => ({ number, docs }));

    const missingNumber = documents.filter(
      (doc) => !doc.estimate_number && !doc.repair_order_number && !doc.invoice_number
    );

    const mismatch = documents.filter((doc) => {
      const values = [doc.estimate_number, doc.repair_order_number, doc.invoice_number].filter(Boolean);
      return values.length > 1 && new Set(values).size > 1;
    });

    const sortedNumeric = Object.keys(numbers)
      .map((number) => Number(String(number).replace(/\D/g, "")))
      .filter((number) => Number.isFinite(number) && number > 0)
      .sort((a, b) => a - b);

    const gaps = [];
    for (let i = 1; i < sortedNumeric.length; i += 1) {
      const previous = sortedNumeric[i - 1];
      const current = sortedNumeric[i];
      if (current - previous > 1 && current - previous < 1000) {
        gaps.push({ from: previous, to: current });
      }
    }

    return { duplicates, missingNumber, mismatch, gaps };
  }, [documents]);

  const exportCsv = () => {
    const rows = [
      ["Issue", "Number", "Document Count", "Customer / Detail"],
      ...audit.duplicates.map((item) => [
        "Duplicate",
        item.number,
        item.docs.length,
        item.docs.map((doc) => doc.customer_name || doc.id).join("; ")
      ]),
      ...audit.missingNumber.map((doc) => [
        "Missing Number",
        "",
        1,
        `${doc.customer_name || ""} ${doc.id}`
      ]),
      ...audit.mismatch.map((doc) => [
        "Mismatch Estimate/RO/Invoice",
        [doc.estimate_number, doc.repair_order_number, doc.invoice_number].filter(Boolean).join(" / "),
        1,
        doc.customer_name || ""
      ]),
      ...audit.gaps.map((gap) => [
        "Possible Gap",
        `${gap.from} to ${gap.to}`,
        "",
        ""
      ])
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `numbering-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Document Numbering Audit</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <div style={cardGrid}>
        <StatCard title="Documents" value={documents.length} />
        <StatCard title="Duplicates" value={audit.duplicates.length} />
        <StatCard title="Missing Numbers" value={audit.missingNumber.length} />
        <StatCard title="Mismatches" value={audit.mismatch.length} />
        <StatCard title="Possible Gaps" value={audit.gaps.length} />
      </div>

      <button type="button" onClick={loadDocuments} style={{ marginBottom: 12 }}>Refresh</button>{" "}
      <button type="button" onClick={exportCsv} style={{ marginBottom: 12 }}>Export CSV</button>

      <div style={panelStyle}>
        <h3>Duplicate Numbers</h3>
        {audit.duplicates.map((item) => (
          <div key={item.number} style={issueBoxStyle}>
            <strong>{item.number}</strong>
            <ul>
              {item.docs.map((doc) => (
                <li key={doc.id}>{doc.document_status || "Document"} - {doc.customer_name || doc.id}</li>
              ))}
            </ul>
          </div>
        ))}
        {audit.duplicates.length === 0 && <p>No duplicate numbers found.</p>}
      </div>

      <div style={panelStyle}>
        <h3>Mismatched Estimate / RO / Invoice Numbers</h3>
        {audit.mismatch.map((doc) => (
          <p key={doc.id}>
            <strong>{doc.customer_name || doc.id}</strong>: {doc.estimate_number || "-"} / {doc.repair_order_number || "-"} / {doc.invoice_number || "-"}
          </p>
        ))}
        {audit.mismatch.length === 0 && <p>No mismatches found.</p>}
      </div>

      <div style={panelStyle}>
        <h3>Possible Numeric Gaps</h3>
        {audit.gaps.slice(0, 50).map((gap) => (
          <p key={`${gap.from}-${gap.to}`}>Gap between {gap.from} and {gap.to}</p>
        ))}
        {audit.gaps.length === 0 && <p>No obvious numeric gaps found.</p>}
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return <div style={statCard}><div style={{ color: "#64748b", fontSize: 14 }}>{title}</div><div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div></div>;
}

const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const issueBoxStyle = { background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 10, marginBottom: 8 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default NumberingAuditManager;
