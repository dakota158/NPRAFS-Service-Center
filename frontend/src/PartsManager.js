import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PartsManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [newPart, setNewPart] = useState({
    partNumber: "",
    name: "",
    quantity: "",
    dateReceived: "",
    repairOrderNumber: ""
  });

  const [editingId, setEditingId] = useState(null);
  const [editPart, setEditPart] = useState({
    partNumber: "",
    name: "",
    quantity: "",
    dateReceived: "",
    repairOrderNumber: ""
  });

  const [showUsedPopup, setShowUsedPopup] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [quantityUsed, setQuantityUsed] = useState("");
  const [repairOrderUsed, setRepairOrderUsed] = useState("");
  const [installedBy, setInstalledBy] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [amountCharged, setAmountCharged] = useState("");

  const loadParts = async () => {
    try {
      const { data, error } = await supabase
        .from("parts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      setParts(data || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase.from("orders").select("*");

      if (error) {
        setMessage(error.message);
        return;
      }

      setOrders(data || []);
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  useEffect(() => {
    loadParts();
    loadOrders();
  }, []);

  const findSourceOrder = (part) => {
    if (!part.source_order_id) return null;
    return orders.find((order) => order.id === part.source_order_id) || null;
  };

  const updateNewPart = (field, value) => {
    setNewPart((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateEditPart = (field, value) => {
    setEditPart((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const addStockPart = async () => {
    if (!canEditEverything) return;

    setMessage("");

    if (!newPart.partNumber || !newPart.name || !newPart.quantity) {
      setMessage("Part number, description, and quantity are required");
      return;
    }

    try {
      const { error } = await supabase.from("parts").insert({
        part_number: newPart.partNumber,
        name: newPart.name,
        quantity: Number(newPart.quantity),
        date_received: newPart.dateReceived || null,
        repair_order_number: newPart.repairOrderNumber || "",
        source_order_id: null
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setNewPart({
        partNumber: "",
        name: "",
        quantity: "",
        dateReceived: "",
        repairOrderNumber: ""
      });

      loadParts();
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const startEdit = (part) => {
    if (!canEditEverything) return;

    setEditingId(part.id);
    setEditPart({
      partNumber: part.part_number || "",
      name: part.name || "",
      quantity: part.quantity || "",
      dateReceived: part.date_received
        ? String(part.date_received).slice(0, 10)
        : "",
      repairOrderNumber: part.repair_order_number || ""
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPart({
      partNumber: "",
      name: "",
      quantity: "",
      dateReceived: "",
      repairOrderNumber: ""
    });
  };

  const saveEdit = async (partId) => {
    if (!canEditEverything) return;

    setMessage("");

    if (!editPart.partNumber || !editPart.name || editPart.quantity === "") {
      setMessage("Part number, description, and quantity are required");
      return;
    }

    try {
      const { error } = await supabase
        .from("parts")
        .update({
          part_number: editPart.partNumber,
          name: editPart.name,
          quantity: Number(editPart.quantity),
          date_received: editPart.dateReceived || null,
          repair_order_number: editPart.repairOrderNumber || ""
        })
        .eq("id", partId);

      if (error) {
        setMessage(error.message);
        return;
      }

      cancelEdit();
      loadParts();
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const deletePart = async (partId) => {
    if (!canEditEverything) return;

    try {
      const { error } = await supabase.from("parts").delete().eq("id", partId);

      if (error) {
        setMessage(error.message);
        return;
      }

      loadParts();
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const openUsedPopup = (part) => {
    const sourceOrder = findSourceOrder(part);

    setSelectedPart(part);
    setQuantityUsed("");
    setRepairOrderUsed(part.repair_order_number || "");
    setInstalledBy(user?.username || user?.email || "");

    setAmountPaid(
      sourceOrder?.cost !== undefined && sourceOrder?.cost !== null
        ? String(sourceOrder.cost)
        : ""
    );

    setAmountCharged(
      sourceOrder?.net !== undefined && sourceOrder?.net !== null
        ? String(sourceOrder.net)
        : ""
    );

    setShowUsedPopup(true);
  };

  const closeUsedPopup = () => {
    setSelectedPart(null);
    setQuantityUsed("");
    setRepairOrderUsed("");
    setInstalledBy("");
    setAmountPaid("");
    setAmountCharged("");
    setShowUsedPopup(false);
  };

  const calculatedProfit =
    Number(amountCharged || 0) - Number(amountPaid || 0);

  const markUsed = async () => {
    if (!selectedPart) return;

    setMessage("");

    const currentQuantity = Number(selectedPart.quantity || 0);
    const usedQuantity = Number(quantityUsed || 0);
    const paid = Number(amountPaid || 0);
    const charged = Number(amountCharged || 0);
    const profit = charged - paid;

    if (!usedQuantity || usedQuantity <= 0) {
      setMessage("Enter a quantity used");
      return;
    }

    if (usedQuantity > currentQuantity) {
      setMessage("Quantity used cannot be more than quantity in stock");
      return;
    }

    if (!repairOrderUsed.trim()) {
      setMessage("Repair order number is required");
      return;
    }

    if (!installedBy.trim()) {
      setMessage("Installed by is required");
      return;
    }

    if (paid < 0) {
      setMessage("What we paid cannot be negative");
      return;
    }

    if (charged < 0) {
      setMessage("What we charged cannot be negative");
      return;
    }

    const sourceOrder = findSourceOrder(selectedPart);
    const usedDate = new Date().toISOString();

    try {
      const { error: historyError } = await supabase.from("history").insert({
        part_id: selectedPart.id,
        source_order_id: selectedPart.source_order_id || null,
        part_number: selectedPart.part_number || "",
        part_description_seller: selectedPart.name || "",
        quantity: usedQuantity,

        // Database compatibility:
        // cost = What We Paid
        // net = What We Charged
        // profit = What We Charged - What We Paid
        cost: paid,
        net: charged,
        profit: profit,

        date_approved: sourceOrder?.date_approved || null,
        repair_order_number: repairOrderUsed,
        part_ordered: sourceOrder?.part_ordered || false,
        ordered_by: sourceOrder?.ordered_by || "",
        date_ordered: sourceOrder?.date_ordered || null,
        received: true,
        tested_good: sourceOrder?.tested_good || false,
        tested_by: sourceOrder?.tested_by || "",
        received_date: selectedPart.date_received || null,
        used_date: usedDate,
        installed_by: installedBy
      });

      if (historyError) {
        setMessage(historyError.message);
        return;
      }

      const remainingQuantity = currentQuantity - usedQuantity;

      if (remainingQuantity <= 0) {
        const { error: deleteError } = await supabase
          .from("parts")
          .delete()
          .eq("id", selectedPart.id);

        if (deleteError) {
          setMessage(deleteError.message);
          return;
        }
      } else {
        const { error: updateError } = await supabase
          .from("parts")
          .update({
            quantity: remainingQuantity
          })
          .eq("id", selectedPart.id);

        if (updateError) {
          setMessage(updateError.message);
          return;
        }
      }

      closeUsedPopup();
      loadParts();
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
    }
  };

  const filteredParts = useMemo(() => {
    const text = search.toLowerCase();

    return parts.filter((part) => {
      const sourceType = part.source_order_id ? "repair order part" : "stock inventory";

      const searchable = [
        part.part_number,
        part.name,
        part.quantity,
        part.date_received,
        part.repair_order_number,
        sourceType
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(text);
    });
  }, [parts, search]);

  return (
    <div>
      <h2>Parts</h2>

      <input
        placeholder="Search parts"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: 10,
          width: "100%",
          maxWidth: 500,
          marginBottom: 20
        }}
      />

      {canEditEverything && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: 12,
            maxWidth: 650,
            marginBottom: 20
          }}
        >
          <h3>Add Stock Inventory</h3>

          <input
            placeholder="Part Number"
            value={newPart.partNumber}
            onChange={(e) => updateNewPart("partNumber", e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Part Description / Seller"
            value={newPart.name}
            onChange={(e) => updateNewPart("name", e.target.value)}
            style={inputStyle}
          />

          <input
            type="number"
            placeholder="Quantity"
            value={newPart.quantity}
            onChange={(e) => updateNewPart("quantity", e.target.value)}
            style={inputStyle}
          />

          <label>
            Date Received
            <input
              type="date"
              value={newPart.dateReceived}
              onChange={(e) => updateNewPart("dateReceived", e.target.value)}
              style={inputStyle}
            />
          </label>

          <input
            placeholder="Repair Order Number optional"
            value={newPart.repairOrderNumber}
            onChange={(e) => updateNewPart("repairOrderNumber", e.target.value)}
            style={inputStyle}
          />

          <button onClick={addStockPart}>Add Stock Part</button>
        </div>
      )}

      {message && <p style={{ color: "red" }}>{message}</p>}

      <table
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Source</th>
            <th>Part Number</th>
            <th>Description / Seller</th>
            <th>Quantity In Stock</th>
            <th>Date Received</th>
            <th>Repair Order #</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredParts.map((part) => (
            <tr key={part.id}>
              {editingId === part.id ? (
                <>
                  <td>{part.source_order_id ? "Repair Order Part" : "Stock Inventory"}</td>

                  <td>
                    <input
                      value={editPart.partNumber}
                      onChange={(e) => updateEditPart("partNumber", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      value={editPart.name}
                      onChange={(e) => updateEditPart("name", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={editPart.quantity}
                      onChange={(e) => updateEditPart("quantity", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="date"
                      value={editPart.dateReceived}
                      onChange={(e) => updateEditPart("dateReceived", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      value={editPart.repairOrderNumber}
                      onChange={(e) =>
                        updateEditPart("repairOrderNumber", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <button onClick={() => saveEdit(part.id)}>Save</button>
                    <button onClick={cancelEdit} style={{ marginLeft: 6 }}>
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{part.source_order_id ? "Repair Order Part" : "Stock Inventory"}</td>
                  <td>{part.part_number || "-"}</td>
                  <td>{part.name || "-"}</td>
                  <td>{part.quantity || 0}</td>
                  <td>
                    {part.date_received
                      ? new Date(part.date_received).toLocaleString()
                      : "-"}
                  </td>
                  <td>{part.repair_order_number || "-"}</td>

                  <td>
                    <button onClick={() => openUsedPopup(part)}>
                      Mark Used
                    </button>

                    {canEditEverything && (
                      <>
                        <button
                          onClick={() => startEdit(part)}
                          style={{ marginLeft: 6 }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deletePart(part.id)}
                          style={{ marginLeft: 6 }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}

          {filteredParts.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No parts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showUsedPopup && selectedPart && (
        <div style={popupStyle}>
          <div style={boxStyle}>
            <h3>Mark Part Used</h3>

            <p>
              <strong>Source:</strong>{" "}
              {selectedPart.source_order_id ? "Repair Order Part" : "Stock Inventory"}
            </p>

            <p>
              <strong>Part:</strong> {selectedPart.part_number || "-"}
            </p>

            <p>
              <strong>Description:</strong> {selectedPart.name || "-"}
            </p>

            <p>
              <strong>Quantity Available:</strong> {selectedPart.quantity || 0}
            </p>

            <input
              type="number"
              placeholder="Quantity Used"
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Repair Order Number"
              value={repairOrderUsed}
              onChange={(e) => setRepairOrderUsed(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Installed By"
              value={installedBy}
              onChange={(e) => setInstalledBy(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.01"
              placeholder="What We Paid"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.01"
              placeholder="What We Charged"
              value={amountCharged}
              onChange={(e) => setAmountCharged(e.target.value)}
              style={inputStyle}
            />

            <div
              style={{
                border: "1px solid #ddd",
                padding: 10,
                marginBottom: 10,
                background: "#f8fafc"
              }}
            >
              <strong>Auto Profit:</strong>{" "}
              ${calculatedProfit.toFixed(2)}
            </div>

            <button onClick={markUsed}>Save Used</button>
            <button onClick={closeUsedPopup} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: 8,
  display: "block",
  width: "100%",
  marginBottom: 8
};

const popupStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const boxStyle = {
  background: "white",
  padding: 20,
  width: 440
};

export default PartsManager;