import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function canViewMoney(role) {
  return role === "Manager" || role === "IT" || role === "admin" || role === "Admin";
}

function canDeleteHistory(role) {
  return role === "IT" || role === "admin" || role === "Admin";
}

function HistoryManager({ user }) {
  const role = user?.role || "Tech";
  const showMoney = canViewMoney(role);
  const allowDelete = canDeleteHistory(role);

  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setHistory(data || []);
  };

  const deleteHistory = async (item) => {
    if (!allowDelete) {
      setMessage("Only Admin and IT accounts can delete history.");
      return;
    }

    const confirmed = window.confirm(
      `Delete history record for ${item.part_number || "this part"}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("history")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("History record deleted.");
    loadHistory();
  };

  const getProfit = (i) =>
    (Number(i.net || 0) - Number(i.cost || 0)) *
    Number(i.quantity || 0);

  return (
    <div>
      <h2>History</h2>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Part</th>
            <th>Description</th>
            <th>Qty</th>
            {showMoney && <th>Paid Per Part</th>}
            {showMoney && <th>Charged Per Part</th>}
            {showMoney && <th>Total Profit</th>}
            <th>RO #</th>
            <th>Ordered By</th>
            <th>Installed By</th>
            <th>Date Used</th>
            {allowDelete && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {history.map((i) => (
            <tr key={i.id}>
              <td>{i.part_number || "-"}</td>
              <td>{i.part_description_seller || "-"}</td>
              <td>{i.quantity || 0}</td>

              {showMoney && <td>${Number(i.cost || 0).toFixed(2)}</td>}
              {showMoney && <td>${Number(i.net || 0).toFixed(2)}</td>}
              {showMoney && <td>${getProfit(i).toFixed(2)}</td>}

              <td>{i.repair_order_number || "-"}</td>
              <td>{i.ordered_by || "-"}</td>
              <td>{i.installed_by || "-"}</td>
              <td>
                {i.used_date ? new Date(i.used_date).toLocaleString() : "-"}
              </td>

              {allowDelete && (
                <td>
                  <button type="button" onClick={() => deleteHistory(i)}>
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}

          {history.length === 0 && (
            <tr>
              <td colSpan={allowDelete ? (showMoney ? 11 : 8) : showMoney ? 10 : 7} style={{ textAlign: "center" }}>
                No history records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default HistoryManager;