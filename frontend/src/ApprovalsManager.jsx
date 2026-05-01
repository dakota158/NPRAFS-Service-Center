import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function ApprovalsManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .in("document_status", ["Estimate", "Repair Order"])
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments(data || []);
  };

  const updateDocument = async (document, updates, actionText) => {
    const { error } = await supabase
      .from("invoices")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", document.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: actionText,
      table_name: "invoices",
      record_id: document.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `${actionText}: ${
        document.invoice_number || document.estimate_number || document.repair_order_number
      }`
    });

    setMessage(`${actionText} complete.`);
    loadDocuments();
  };

  const approveEstimate = (document) => {
    updateDocument(
      document,
      {
        status: "Approved"
      },
      "Estimate Approved"
    );
  };

  const convertToRepairOrder = (document) => {
    const number =
      document.repair_order_number ||
      document.estimate_number ||
      document.invoice_number;

    updateDocument(
      document,
      {
        document_status: "Repair Order",
        status: "Open",
        repair_order_number: number,
        invoice_number: number
      },
      "Converted To Repair Order"
    );
  };

  const markReadyForInvoice = (document) => {
    updateDocument(
      document,
      {
        status: "Ready"
      },
      "Repair Order Ready For Invoice"
    );
  };

  const convertToInvoice = (document) => {
    const number =
      document.invoice_number ||
      document.repair_order_number ||
      document.estimate_number;

    updateDocument(
      document,
      {
        document_status: "Invoice",
        status: "Draft",
        invoice_number: number,
        repair_order_number: number
      },
      "Converted To Invoice"
    );
  };

  return (
    <div>
      <h2>Approvals</h2>

      {message && (
        <p style={{ color: message.includes("complete") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <button type="button" onClick={loadDocuments} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Number</th>
            <th>Status</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>{document.document_status || "Invoice"}</td>
              <td>
                {document.estimate_number ||
                  document.repair_order_number ||
                  document.invoice_number ||
                  "-"}
              </td>
              <td>{document.status || "-"}</td>
              <td>{document.customer_name || "-"}</td>
              <td>
                {[document.vehicle_year, document.vehicle_make, document.vehicle_model]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </td>
              <td>${Number(document.grand_total || 0).toFixed(2)}</td>
              <td>
                {document.document_status === "Estimate" && (
                  <>
                    <button type="button" onClick={() => approveEstimate(document)}>
                      Approve Estimate
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() => convertToRepairOrder(document)}
                    >
                      Convert To RO
                    </button>
                  </>
                )}

                {document.document_status === "Repair Order" && (
                  <>
                    <button
                      type="button"
                      onClick={() => markReadyForInvoice(document)}
                    >
                      Mark Ready
                    </button>{" "}
                    <button type="button" onClick={() => convertToInvoice(document)}>
                      Convert To Invoice
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}

          {documents.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No estimates or repair orders awaiting approval.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

export default ApprovalsManager;
