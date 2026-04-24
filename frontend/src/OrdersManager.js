import { useEffect, useState } from "react";

function OrdersManager({ user, canEditEverything }) {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    partNumber: "",
    partDescriptionSeller: "",
    quantity: "",
    cost: "",
    net: "",
    profit: "",
    orderDate: "",
    repairOrderNumber: ""
  });

  const [showOrderedPopup, setShowOrderedPopup] = useState(false);
  const [selectedOrderedOrder, setSelectedOrderedOrder] = useState(null);
  const [orderedBy, setOrderedBy] = useState("");
  const [dateOrdered, setDateOrdered] = useState("");

  const [showReceivePopup, setShowReceivePopup] = useState(false);
  const [selectedReceiveOrder, setSelectedReceiveOrder] = useState(null);
  const [testedGood, setTestedGood] = useState(false);
  const [testedBy, setTestedBy] = useState("");

  const loadOrders = async () => {
    try {
      const res = await fetch("http://localhost:5000/orders");
      const data = await res.json();

      if (data.success) {
        const activeOrders = (data.orders || []).filter((order) => !order.received);
        setOrders(activeOrders);
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to load orders");
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addOrder = async () => {
    setMessage("");

    try {
      const res = await fetch("http://localhost:5000/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          cost: Number(form.cost),
          net: Number(form.net),
          profit: Number(form.profit)
        })
      });

      const data = await res.json();

      if (data.success) {
        setForm({
          partNumber: "",
          partDescriptionSeller: "",
          quantity: "",
          cost: "",
          net: "",
          profit: "",
          orderDate: "",
          repairOrderNumber: ""
        });

        loadOrders();
      } else {
        setMessage(data.message || "Failed to add order");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to add order");
    }
  };

  const openOrderedPopup = (order) => {
    setSelectedOrderedOrder(order);
    setOrderedBy(user?.username || "");
    setDateOrdered("");
    setShowOrderedPopup(true);
  };

  const closeOrderedPopup = () => {
    setShowOrderedPopup(false);
    setSelectedOrderedOrder(null);
    setOrderedBy("");
    setDateOrdered("");
  };

  const markPartOrdered = async () => {
    if (!orderedBy.trim()) {
      setMessage("Enter who ordered the part");
      return;
    }

    if (!dateOrdered) {
      setMessage("Enter the date the part was ordered");
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:5000/orders/${selectedOrderedOrder.id}/ordered`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderedBy,
            dateOrdered
          })
        }
      );

      const data = await res.json();

      if (data.success) {
        closeOrderedPopup();
        loadOrders();
      } else {
        setMessage(data.message || "Failed to mark part ordered");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to mark part ordered");
    }
  };

  const openReceivePopup = (order) => {
    setSelectedReceiveOrder(order);
    setTestedGood(false);
    setTestedBy(user?.username || "");
    setShowReceivePopup(true);
  };

  const closeReceivePopup = () => {
    setShowReceivePopup(false);
    setSelectedReceiveOrder(null);
    setTestedGood(false);
    setTestedBy("");
  };

  const markReceived = async () => {
    if (!testedBy.trim()) {
      setMessage("Enter who tested it");
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:5000/orders/${selectedReceiveOrder.id}/received`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testedGood,
            testedBy
          })
        }
      );

      const data = await res.json();

      if (data.success) {
        closeReceivePopup();
        loadOrders();
      } else {
        setMessage(data.message || "Failed to mark received");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to mark received");
    }
  };

  const deleteOrder = async (id) => {
    if (!canEditEverything) return;

    try {
      const res = await fetch(`http://localhost:5000/orders/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (data.success) {
        loadOrders();
      } else {
        setMessage(data.message || "Failed to delete order");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete order");
    }
  };

  return (
    <div>
      <h2>Orders</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 500 }}>
        <input
          placeholder="Part Number"
          value={form.partNumber}
          onChange={(e) => updateForm("partNumber", e.target.value)}
        />

        <input
          placeholder="Part Description / Seller"
          value={form.partDescriptionSeller}
          onChange={(e) => updateForm("partDescriptionSeller", e.target.value)}
        />

        <input
          type="number"
          placeholder="Quantity"
          value={form.quantity}
          onChange={(e) => updateForm("quantity", e.target.value)}
        />

        <input
          type="number"
          placeholder="Cost"
          value={form.cost}
          onChange={(e) => updateForm("cost", e.target.value)}
        />

        <input
          type="number"
          placeholder="Net"
          value={form.net}
          onChange={(e) => updateForm("net", e.target.value)}
        />

        <input
          type="number"
          placeholder="Profit"
          value={form.profit}
          onChange={(e) => updateForm("profit", e.target.value)}
        />

        <label>
          Date Approved
          <input
            type="date"
            value={form.orderDate}
            onChange={(e) => updateForm("orderDate", e.target.value)}
            style={{ display: "block" }}
          />
        </label>

        <input
          placeholder="Repair Order #"
          value={form.repairOrderNumber}
          onChange={(e) => updateForm("repairOrderNumber", e.target.value)}
        />

        <button onClick={addOrder}>Add Order</button>
      </div>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <hr />

      <table border="1" cellPadding="6" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description / Seller</th>
            <th>Qty</th>
            <th>Cost</th>
            <th>Net</th>
            <th>Profit</th>
            <th>Date Approved</th>
            <th>RO #</th>
            <th>Ordered?</th>
            <th>Date Ordered</th>
            <th>Ordered By</th>
            <th>Received</th>
            <th>Tested By</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.partNumber}</td>
              <td>{o.partDescriptionSeller}</td>
              <td>{o.quantity}</td>
              <td>${Number(o.cost || 0).toFixed(2)}</td>
              <td>${Number(o.net || 0).toFixed(2)}</td>
              <td>${Number(o.profit || 0).toFixed(2)}</td>
              <td>{o.orderDate || "-"}</td>
              <td>{o.repairOrderNumber}</td>
              <td>{o.partOrdered ? "Yes" : "No"}</td>
              <td>{o.dateOrdered || "-"}</td>
              <td>{o.orderedBy || "-"}</td>
              <td>{o.received ? "Yes" : "No"}</td>
              <td>{o.testedBy || "-"}</td>

              <td>
                {!o.partOrdered && (
                  <button onClick={() => openOrderedPopup(o)}>
                    Mark Ordered
                  </button>
                )}

                {o.partOrdered && !o.received && (
                  <button onClick={() => openReceivePopup(o)}>
                    Received
                  </button>
                )}

                {canEditEverything && (
                  <button
                    onClick={() => deleteOrder(o.id)}
                    style={{ marginLeft: 6 }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}

          {orders.length === 0 && (
            <tr>
              <td colSpan="14" style={{ textAlign: "center" }}>
                No active orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showOrderedPopup && selectedOrderedOrder && (
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
          <div style={{ background: "white", padding: 20, width: 400 }}>
            <h3>Mark Part Ordered</h3>

            <p>
              <strong>Part:</strong> {selectedOrderedOrder.partNumber}
            </p>

            <label>
              Date Ordered
              <input
                type="date"
                value={dateOrdered}
                onChange={(e) => setDateOrdered(e.target.value)}
                style={{ display: "block", width: "100%", marginBottom: 10 }}
              />
            </label>

            <input
              placeholder="Ordered By"
              value={orderedBy}
              onChange={(e) => setOrderedBy(e.target.value)}
              style={{ width: "100%", marginBottom: 10 }}
            />

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={markPartOrdered}>Save Ordered</button>
              <button onClick={closeOrderedPopup}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showReceivePopup && selectedReceiveOrder && (
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
          <div style={{ background: "white", padding: 20, width: 400 }}>
            <h3>Receive Part</h3>

            <p>
              <strong>Part:</strong> {selectedReceiveOrder.partNumber}
            </p>

            <label>
              <input
                type="checkbox"
                checked={testedGood}
                onChange={(e) => setTestedGood(e.target.checked)}
              />
              Tested Good
            </label>

            <input
              placeholder="Tested By"
              value={testedBy}
              onChange={(e) => setTestedBy(e.target.value)}
              style={{ width: "100%", marginTop: 10, marginBottom: 10 }}
            />

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={markReceived}>Save Received</button>
              <button onClick={closeReceivePopup}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersManager;