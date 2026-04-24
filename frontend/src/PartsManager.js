import { useEffect, useMemo, useState } from "react";

function PartsManager({ user, canEditEverything }) {
  const [parts, setParts] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [newPart, setNewPart] = useState({
    name: "",
    quantity: "",
    dateReceived: "",
    partNumber: "",
    repairOrderNumber: ""
  });

  const [editingId, setEditingId] = useState(null);
  const [editPart, setEditPart] = useState({
    name: "",
    quantity: "",
    dateReceived: "",
    partNumber: "",
    repairOrderNumber: ""
  });

  const [showUsedPopup, setShowUsedPopup] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [installedBy, setInstalledBy] = useState("");

  const loadParts = async () => {
    try {
      const res = await fetch("http://localhost:5000/parts");
      const data = await res.json();

      if (data.success) {
        setParts(data.parts || []);
      } else {
        setMessage(data.message || "Could not load parts");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not connect to backend");
    }
  };

  useEffect(() => {
    loadParts();
  }, []);

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

  const addPart = async () => {
    if (!canEditEverything) return;

    if (!newPart.name || newPart.quantity === "") {
      setMessage("Part name and quantity are required");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/parts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newPart.name,
          quantity: Number(newPart.quantity),
          dateReceived: newPart.dateReceived,
          partNumber: newPart.partNumber,
          repairOrderNumber: newPart.repairOrderNumber,
          sourceOrderId: null
        })
      });

      const data = await res.json();

      if (data.success) {
        setNewPart({
          name: "",
          quantity: "",
          dateReceived: "",
          partNumber: "",
          repairOrderNumber: ""
        });

        setMessage("");
        loadParts();
      } else {
        setMessage(data.message || "Could not add part");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not add part");
    }
  };

  const startEdit = (part) => {
    if (!canEditEverything) return;

    setEditingId(part.id);
    setEditPart({
      name: part.name || "",
      quantity: part.quantity || "",
      dateReceived: part.dateReceived
        ? String(part.dateReceived).slice(0, 10)
        : "",
      partNumber: part.partNumber || "",
      repairOrderNumber: part.repairOrderNumber || ""
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPart({
      name: "",
      quantity: "",
      dateReceived: "",
      partNumber: "",
      repairOrderNumber: ""
    });
  };

  const saveEdit = async (id) => {
    if (!canEditEverything) return;

    if (!editPart.name || editPart.quantity === "") {
      setMessage("Part name and quantity are required");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/parts/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: editPart.name,
          quantity: Number(editPart.quantity),
          dateReceived: editPart.dateReceived,
          partNumber: editPart.partNumber,
          repairOrderNumber: editPart.repairOrderNumber
        })
      });

      const data = await res.json();

      if (data.success) {
        cancelEdit();
        setMessage("");
        loadParts();
      } else {
        setMessage(data.message || "Could not update part");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not update part");
    }
  };

  const deletePart = async (id) => {
    if (!canEditEverything) return;

    try {
      const res = await fetch(`http://localhost:5000/parts/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (data.success) {
        loadParts();
      } else {
        setMessage(data.message || "Could not delete part");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not delete part");
    }
  };

  const openUsedPopup = (part) => {
    setSelectedPart(part);
    setInstalledBy(user?.username || "");
    setShowUsedPopup(true);
  };

  const closeUsedPopup = () => {
    setSelectedPart(null);
    setInstalledBy("");
    setShowUsedPopup(false);
  };

  const markUsed = async () => {
    if (!selectedPart) return;

    if (!installedBy.trim()) {
      setMessage("Installed by is required");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/parts/${selectedPart.id}/used`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          installedBy
        })
      });

      const data = await res.json();

      if (data.success) {
        closeUsedPopup();
        loadParts();
      } else {
        setMessage(data.message || "Could not mark part used");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not mark part used");
    }
  };

  const filteredParts = useMemo(() => {
    const text = search.toLowerCase();

    return parts.filter((part) => {
      const searchable = [
        part.name,
        part.partNumber,
        part.repairOrderNumber,
        part.dateReceived,
        part.quantity
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
          padding: 8,
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
            marginBottom: 20,
            maxWidth: 600
          }}
        >
          <h3>Add Part Manually</h3>

          <input
            placeholder="Part Number"
            value={newPart.partNumber}
            onChange={(e) => updateNewPart("partNumber", e.target.value)}
            style={{ padding: 8, display: "block", marginBottom: 8, width: "100%" }}
          />

          <input
            placeholder="Name / Description"
            value={newPart.name}
            onChange={(e) => updateNewPart("name", e.target.value)}
            style={{ padding: 8, display: "block", marginBottom: 8, width: "100%" }}
          />

          <input
            type="number"
            placeholder="Quantity"
            value={newPart.quantity}
            onChange={(e) => updateNewPart("quantity", e.target.value)}
            style={{ padding: 8, display: "block", marginBottom: 8, width: "100%" }}
          />

          <label>
            Date Received
            <input
              type="date"
              value={newPart.dateReceived}
              onChange={(e) => updateNewPart("dateReceived", e.target.value)}
              style={{ padding: 8, display: "block", marginBottom: 8, width: "100%" }}
            />
          </label>

          <input
            placeholder="Repair Order Number"
            value={newPart.repairOrderNumber}
            onChange={(e) => updateNewPart("repairOrderNumber", e.target.value)}
            style={{ padding: 8, display: "block", marginBottom: 8, width: "100%" }}
          />

          <button onClick={addPart}>Add Part</button>
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
            <th>ID</th>
            <th>Part Number</th>
            <th>Name / Description</th>
            <th>Quantity</th>
            <th>Date Received</th>
            <th>Repair Order Number</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredParts.map((part) => (
            <tr key={part.id}>
              <td>{part.id}</td>

              {editingId === part.id ? (
                <>
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
                  <td>{part.partNumber || "-"}</td>
                  <td>{part.name || "-"}</td>
                  <td>{part.quantity}</td>
                  <td>
                    {part.dateReceived
                      ? new Date(part.dateReceived).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>{part.repairOrderNumber || "-"}</td>

                  <td>
                    <button onClick={() => openUsedPopup(part)}>Mark Used</button>

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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{ background: "white", padding: 20, width: 420 }}>
            <h3>Mark Part Used</h3>

            <p>
              <strong>Part:</strong> {selectedPart.partNumber || "-"}
            </p>

            <p>
              <strong>Description:</strong> {selectedPart.name}
            </p>

            <input
              placeholder="Installed By"
              value={installedBy}
              onChange={(e) => setInstalledBy(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                marginBottom: 12
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={markUsed}>Save Used</button>
              <button onClick={closeUsedPopup}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PartsManager;