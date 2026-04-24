import { useEffect, useMemo, useState } from "react";

function HistoryManager({ canEditEverything }) {
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadHistory = async () => {
    try {
      const res = await fetch("http://localhost:5000/history");
      const data = await res.json();

      if (data.success) {
        setHistory(data.history || []);
      } else {
        setMessage(data.message || "Failed to load history");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not connect to backend");
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const deleteHistory = async (id) => {
    if (!canEditEverything) return;

    try {
      const res = await fetch(`http://localhost:5000/history/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (data.success) {
        loadHistory();
      } else {
        setMessage(data.message || "Failed to delete history item");
      }
    } catch (err) {
      console.error(err);
      setMessage("Delete failed");
    }
  };

  const filteredHistory = useMemo(() => {
    const text = search.toLowerCase();

    return history.filter((item) => {
      const searchable = [
        item.partNumber,
        item.partDescriptionSeller,
        item.quantity,
        item.cost,
        item.net,
        item.profit,
        item.orderDate,
        item.repairOrderNumber,
        item.orderedBy,
        item.dateOrdered,
        item.testedBy,
        item.receivedDate,
        item.usedDate,
        item.installedBy
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(text);
    });
  }, [history, search]);

  const totalCost = filteredHistory.reduce(
    (sum, item) => sum + Number(item.cost || 0),
    0
  );

  const totalNet = filteredHistory.reduce(
    (sum, item) => sum + Number(item.net || 0),
    0
  );

  const totalProfit = filteredHistory.reduce(
    (sum, item) => sum + Number(item.profit || 0),
    0
  );

  const totalQuantity = filteredHistory.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  return (
    <div>
      <h2>History</h2>

      <p>
        Used parts are removed from the Parts tab and stored here after they are
        marked used.
      </p>

      <input
        placeholder="Search by part, RO number, ordered by, tested by, installed by, or date"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: 10,
          width: "100%",
          maxWidth: 650,
          marginBottom: 20
        }}
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ border: "1px solid #ccc", padding: 12, minWidth: 150 }}>
          <strong>Total Records</strong>
          <div>{filteredHistory.length}</div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 12, minWidth: 150 }}>
          <strong>Total Quantity</strong>
          <div>{totalQuantity}</div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 12, minWidth: 150 }}>
          <strong>Total Cost</strong>
          <div>${totalCost.toFixed(2)}</div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 12, minWidth: 150 }}>
          <strong>Total Net</strong>
          <div>${totalNet.toFixed(2)}</div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 12, minWidth: 150 }}>
          <strong>Total Profit</strong>
          <div>${totalProfit.toFixed(2)}</div>
        </div>
      </div>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <table
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Part Number</th>
            <th>Description / Seller</th>
            <th>Qty</th>
            <th>Cost</th>
            <th>Net</th>
            <th>Profit</th>
            <th>Date Approved</th>
            <th>RO Number</th>
            <th>Ordered?</th>
            <th>Date Ordered</th>
            <th>Ordered By</th>
            <th>Received?</th>
            <th>Tested Good?</th>
            <th>Tested By</th>
            <th>Date Received</th>
            <th>Date Used</th>
            <th>Installed By</th>
            {canEditEverything && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {filteredHistory.map((item) => (
            <tr key={item.id}>
              <td>{item.partNumber || "-"}</td>
              <td>{item.partDescriptionSeller || "-"}</td>
              <td>{item.quantity || 0}</td>
              <td>${Number(item.cost || 0).toFixed(2)}</td>
              <td>${Number(item.net || 0).toFixed(2)}</td>
              <td>${Number(item.profit || 0).toFixed(2)}</td>
              <td>{item.orderDate || "-"}</td>
              <td>{item.repairOrderNumber || "-"}</td>
              <td>{item.partOrdered ? "Yes" : "No"}</td>
              <td>{item.dateOrdered || "-"}</td>
              <td>{item.orderedBy || "-"}</td>
              <td>{item.received ? "Yes" : "No"}</td>
              <td>{item.testedGood ? "Yes" : "No"}</td>
              <td>{item.testedBy || "-"}</td>
              <td>
                {item.receivedDate
                  ? new Date(item.receivedDate).toLocaleString()
                  : "-"}
              </td>
              <td>
                {item.usedDate
                  ? new Date(item.usedDate).toLocaleString()
                  : "-"}
              </td>
              <td>{item.installedBy || "-"}</td>

              {canEditEverything && (
                <td>
                  <button onClick={() => deleteHistory(item.id)}>
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}

          {filteredHistory.length === 0 && (
            <tr>
              <td colSpan={canEditEverything ? 18 : 17} style={{ textAlign: "center" }}>
                No used parts history found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default HistoryManager;