import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function HistoryManager({ canEditEverything }) {
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      setHistory(data || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const deleteHistory = async (id) => {
    if (!canEditEverything) return;

    try {
      const { error } = await supabase.from("history").delete().eq("id", id);

      if (error) {
        setMessage(error.message);
        return;
      }

      loadHistory();
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const getPaid = (item) => Number(item.cost || 0);
  const getCharged = (item) => Number(item.net || 0);
  const getProfit = (item) => getCharged(item) - getPaid(item);

  const filteredHistory = useMemo(() => {
    const text = search.toLowerCase();

    return history.filter((item) => {
      const paid = getPaid(item);
      const charged = getCharged(item);
      const profit = getProfit(item);

      const searchable = [
        item.part_number,
        item.part_description_seller,
        item.quantity,
        paid,
        charged,
        profit,
        item.date_approved,
        item.repair_order_number,
        item.ordered_by,
        item.date_ordered,
        item.tested_by,
        item.received_date,
        item.used_date,
        item.installed_by,
        item.source_order_id ? "repair order part" : "stock inventory",
        "what we paid",
        "what we charged",
        "profit"
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(text);
    });
  }, [history, search]);

  const totalQuantity = filteredHistory.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const totalPaid = filteredHistory.reduce(
    (sum, item) => sum + getPaid(item),
    0
  );

  const totalCharged = filteredHistory.reduce(
    (sum, item) => sum + getCharged(item),
    0
  );

  const totalProfit = filteredHistory.reduce(
    (sum, item) => sum + getProfit(item),
    0
  );

  return (
    <div>
      <h2>History</h2>

      <input
        placeholder="Search history by part, RO number, installed by, date, or stock inventory"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: 10,
          width: "100%",
          maxWidth: 650,
          marginBottom: 20
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20
        }}
      >
        <SummaryCard title="Records" value={filteredHistory.length} />
        <SummaryCard title="Quantity Used" value={totalQuantity} />
        <SummaryCard title="What We Paid" value={`$${totalPaid.toFixed(2)}`} />
        <SummaryCard title="What We Charged" value={`$${totalCharged.toFixed(2)}`} />
        <SummaryCard title="Total Profit" value={`$${totalProfit.toFixed(2)}`} />
      </div>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <table
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Source</th>
            <th>Part #</th>
            <th>Description / Seller</th>
            <th>Qty Used</th>
            <th>What We Paid</th>
            <th>What We Charged</th>
            <th>Profit</th>
            <th>Date Approved</th>
            <th>RO #</th>
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
          {filteredHistory.map((item) => {
            const paid = getPaid(item);
            const charged = getCharged(item);
            const profit = getProfit(item);

            return (
              <tr key={item.id}>
                <td>{item.source_order_id ? "Repair Order Part" : "Stock Inventory"}</td>
                <td>{item.part_number || "-"}</td>
                <td>{item.part_description_seller || "-"}</td>
                <td>{item.quantity || 0}</td>
                <td>${paid.toFixed(2)}</td>
                <td>${charged.toFixed(2)}</td>
                <td>${profit.toFixed(2)}</td>
                <td>{item.date_approved || "-"}</td>
                <td>{item.repair_order_number || "-"}</td>
                <td>{item.part_ordered ? "Yes" : "No"}</td>
                <td>{item.date_ordered || "-"}</td>
                <td>{item.ordered_by || "-"}</td>
                <td>{item.received ? "Yes" : "No"}</td>
                <td>{item.tested_good ? "Yes" : "No"}</td>
                <td>{item.tested_by || "-"}</td>
                <td>
                  {item.received_date
                    ? new Date(item.received_date).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {item.used_date
                    ? new Date(item.used_date).toLocaleString()
                    : "-"}
                </td>
                <td>{item.installed_by || "-"}</td>

                {canEditEverything && (
                  <td>
                    <button onClick={() => deleteHistory(item.id)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            );
          })}

          {filteredHistory.length === 0 && (
            <tr>
              <td
                colSpan={canEditEverything ? 19 : 18}
                style={{ textAlign: "center" }}
              >
                No history found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: 12,
        minWidth: 140
      }}
    >
      <strong>{title}</strong>
      <div style={{ fontSize: 20, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default HistoryManager;