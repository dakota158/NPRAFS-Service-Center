import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function canViewMoney(user) {
  const role = user?.role || "Tech";
  return role === "Manager" || role === "IT" || role === "admin" || role === "Admin";
}

function OrdersManager({ user, canEditEverything }) {
  const showMoney = canViewMoney(user);

  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");

  const [showAddPopup, setShowAddPopup] = useState(false);

  const [form, setForm] = useState({
    partNumber: "",
    partDescriptionSeller: "",
    quantity: "",
    dateApproved: "",
    repairOrderNumber: "",
    supplierId: ""
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderedBy, setOrderedBy] = useState("");
  const [dateOrdered, setDateOrdered] = useState("");
  const [orderedPaid, setOrderedPaid] = useState("");
  const [orderedCharged, setOrderedCharged] = useState("");

  const [receiveOrder, setReceiveOrder] = useState(null);
  const [testedGood, setTestedGood] = useState(false);
  const [testedBy, setTestedBy] = useState("");

  useEffect(() => {
    loadOrders();
    loadSuppliers();
  }, []);

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, suppliers(name)")
      .eq("received", false)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setOrders(data || []);
  };

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });

    setSuppliers(data || []);
  };

  const logAudit = async (action, tableName, recordId, details) => {
    await supabase.from("audit_logs").insert({
      action,
      table_name: tableName,
      record_id: recordId || "",
      user_id: user?.id || null,
      user_email: user?.email || "",
      details
    });
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setForm({
      partNumber: "",
      partDescriptionSeller: "",
      quantity: "",
      dateApproved: "",
      repairOrderNumber: "",
      supplierId: ""
    });
  };

  const openAddPopup = () => {
    setMessage("");
    resetForm();
    setShowAddPopup(true);
  };

  const closeAddPopup = () => {
    setShowAddPopup(false);
    resetForm();
  };

  const addOrder = async () => {
    setMessage("");

    if (
      !form.partNumber ||
      !form.partDescriptionSeller ||
      !form.quantity ||
      !form.dateApproved ||
      !form.repairOrderNumber
    ) {
      setMessage("Part number, description, quantity, date approved, and repair order number are required.");
      return;
    }

    const qty = Number(form.quantity);

    if (!qty || qty <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        part_number: form.partNumber,
        part_description_seller: form.partDescriptionSeller,
        quantity: qty,
        cost: 0,
        net: 0,
        profit: 0,
        date_approved: form.dateApproved,
        repair_order_number: form.repairOrderNumber,
        supplier_id: form.supplierId || null,
        part_ordered: false,
        ordered_by: "",
        date_ordered: null,
        received: false,
        tested_good: false,
        tested_by: "",
        received_date: null,
        created_by: user?.id || null,
        created_by_email: user?.email || "",
        created_by_name: user?.username || user?.name || user?.email || ""
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    await logAudit(
      "Order Request Created",
      "orders",
      data.id,
      `Created order request for ${form.partNumber} / RO ${form.repairOrderNumber}`
    );

    closeAddPopup();
    loadOrders();
  };

  const openOrderedPopup = (order) => {
    setSelectedOrder(order);
    setOrderedBy(user?.username || user?.email || "");
    setDateOrdered("");
    setOrderedPaid(order.cost ? String(order.cost) : "");
    setOrderedCharged(order.net ? String(order.net) : "");
  };

  const closeOrderedPopup = () => {
    setSelectedOrder(null);
    setOrderedBy("");
    setDateOrdered("");
    setOrderedPaid("");
    setOrderedCharged("");
  };

  const orderedProfit =
    selectedOrder
      ? (Number(orderedCharged || 0) - Number(orderedPaid || 0)) *
        Number(selectedOrder.quantity || 0)
      : 0;

  const markOrdered = async () => {
    if (!selectedOrder) return;

    setMessage("");

    if (!orderedBy || !dateOrdered) {
      setMessage("Ordered by and date ordered are required.");
      return;
    }

    if (orderedPaid === "" || orderedCharged === "") {
      setMessage("What we paid and what we charged are required when confirming ordered.");
      return;
    }

    const paid = Number(orderedPaid);
    const charged = Number(orderedCharged);
    const qty = Number(selectedOrder.quantity || 0);
    const profit = (charged - paid) * qty;

    if (paid < 0 || charged < 0) {
      setMessage("Financial amounts cannot be negative.");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        part_ordered: true,
        ordered_by: orderedBy,
        date_ordered: dateOrdered,
        cost: paid,
        net: charged,
        profit
      })
      .eq("id", selectedOrder.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await logAudit(
      "Order Marked Ordered",
      "orders",
      selectedOrder.id,
      `Marked ${selectedOrder.part_number} ordered by ${orderedBy}. Paid ${paid}, charged ${charged}, total profit ${profit}.`
    );

    closeOrderedPopup();
    loadOrders();
  };

  const openReceivePopup = (order) => {
    setReceiveOrder(order);
    setTestedGood(false);
    setTestedBy(user?.username || user?.email || "");
  };

  const closeReceivePopup = () => {
    setReceiveOrder(null);
    setTestedGood(false);
    setTestedBy("");
  };

  const markReceived = async () => {
    if (!receiveOrder) return;

    setMessage("");

    if (!testedBy) {
      setMessage("Tested by is required.");
      return;
    }

    const receivedDate = new Date().toISOString();

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        received: true,
        tested_good: testedGood,
        tested_by: testedBy,
        received_date: receivedDate
      })
      .eq("id", receiveOrder.id);

    if (orderError) {
      setMessage(orderError.message);
      return;
    }

    const { error: partError } = await supabase.from("parts").insert({
      name: receiveOrder.part_description_seller,
      quantity: receiveOrder.quantity,
      date_received: receivedDate,
      source_order_id: receiveOrder.id,
      part_number: receiveOrder.part_number,
      repair_order_number: receiveOrder.repair_order_number,
      created_by: receiveOrder.created_by || null,
      created_by_email: receiveOrder.created_by_email || "",
      created_by_name: receiveOrder.created_by_name || ""
    });

    if (partError) {
      setMessage(partError.message);
      return;
    }

    await logAudit(
      "Order Received",
      "orders",
      receiveOrder.id,
      `Received ${receiveOrder.part_number}; tested by ${testedBy}`
    );

    closeReceivePopup();
    loadOrders();
  };

  const deleteOrder = async (order) => {
    if (!canEditEverything) return;

    const confirmed = window.confirm(`Delete order request for ${order.part_number}?`);
    if (!confirmed) return;

    const { error } = await supabase.from("orders").delete().eq("id", order.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await logAudit(
      "Order Request Deleted",
      "orders",
      order.id,
      `Deleted order request for ${order.part_number}`
    );

    loadOrders();
  };

  return (
    <div>
      <h2>Orders</h2>

      <button type="button" onClick={openAddPopup}>
        Add Order Request
      </button>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <hr />

      <table border="1" cellPadding="6" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Supplier / Vendor</th>
            <th>Qty</th>
            {showMoney && <th>What We Paid</th>}
            {showMoney && <th>What We Charged</th>}
            {showMoney && <th>Profit</th>}
            <th>Date Approved</th>
            <th>RO #</th>
            <th>Requested By</th>
            <th>Ordered?</th>
            <th>Date Ordered</th>
            <th>Ordered By</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const qty = Number(order.quantity || 0);
            const paid = Number(order.cost || 0);
            const charged = Number(order.net || 0);
            const profit = (charged - paid) * qty;

            return (
              <tr key={order.id}>
                <td>{order.part_number || "-"}</td>
                <td>{order.part_description_seller || "-"}</td>
                <td>{order.suppliers?.name || "-"}</td>
                <td>{qty}</td>

                {showMoney && <td>${paid.toFixed(2)}</td>}
                {showMoney && <td>${charged.toFixed(2)}</td>}
                {showMoney && <td>${profit.toFixed(2)}</td>}

                <td>{order.date_approved || "-"}</td>
                <td>{order.repair_order_number || "-"}</td>
                <td>{order.created_by_name || order.created_by_email || "-"}</td>
                <td>{order.part_ordered ? "Yes" : "No"}</td>
                <td>{order.date_ordered || "-"}</td>
                <td>{order.ordered_by || "-"}</td>

                <td>
                  {!order.part_ordered && (
                    <button onClick={() => openOrderedPopup(order)}>
                      Mark Ordered
                    </button>
                  )}

                  {order.part_ordered && (
                    <button
                      onClick={() => openReceivePopup(order)}
                      style={{ marginLeft: 6 }}
                    >
                      Received
                    </button>
                  )}

                  {canEditEverything && (
                    <button
                      onClick={() => deleteOrder(order)}
                      style={{ marginLeft: 6 }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {orders.length === 0 && (
            <tr>
              <td colSpan={showMoney ? 14 : 11} style={{ textAlign: "center" }}>
                No active orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddPopup && (
        <div style={popupStyle}>
          <div style={boxStyle}>
            <h3>Add Order Request</h3>

            <input
              placeholder="Part Number"
              value={form.partNumber}
              onChange={(e) => updateForm("partNumber", e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Part Description / Seller"
              value={form.partDescriptionSeller}
              onChange={(e) => updateForm("partDescriptionSeller", e.target.value)}
              style={inputStyle}
            />

            <select
              value={form.supplierId}
              onChange={(e) => updateForm("supplierId", e.target.value)}
              style={inputStyle}
            >
              <option value="">No Supplier / Vendor Selected</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => updateForm("quantity", e.target.value)}
              style={inputStyle}
            />

            <label>
              Date Approved
              <input
                type="date"
                value={form.dateApproved}
                onChange={(e) => updateForm("dateApproved", e.target.value)}
                style={inputStyle}
              />
            </label>

            <input
              placeholder="Repair Order #"
              value={form.repairOrderNumber}
              onChange={(e) => updateForm("repairOrderNumber", e.target.value)}
              style={inputStyle}
            />

            <button onClick={addOrder}>Save Order Request</button>
            <button onClick={closeAddPopup} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div style={popupStyle}>
          <div style={boxStyle}>
            <h3>Mark Part Ordered</h3>

            <p>
              <strong>Part:</strong> {selectedOrder.part_number || "-"}
            </p>

            <p>
              <strong>Quantity:</strong> {selectedOrder.quantity || 0}
            </p>

            <label>
              Date Ordered
              <input
                type="date"
                value={dateOrdered}
                onChange={(e) => setDateOrdered(e.target.value)}
                style={inputStyle}
              />
            </label>

            <input
              placeholder="Ordered By"
              value={orderedBy}
              onChange={(e) => setOrderedBy(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.01"
              placeholder="What We Paid Per Part"
              value={orderedPaid}
              onChange={(e) => setOrderedPaid(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.01"
              placeholder="What We Charged Per Part"
              value={orderedCharged}
              onChange={(e) => setOrderedCharged(e.target.value)}
              style={inputStyle}
            />

            <div
              style={{
                padding: 10,
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                marginBottom: 8
              }}
            >
              <strong>Auto Profit:</strong> ${orderedProfit.toFixed(2)}
            </div>

            <button onClick={markOrdered}>Save Ordered</button>
            <button onClick={closeOrderedPopup} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {receiveOrder && (
        <div style={popupStyle}>
          <div style={boxStyle}>
            <h3>Receive Part</h3>

            <p>
              <strong>Part:</strong> {receiveOrder.part_number || "-"}
            </p>

            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={testedGood}
                onChange={(e) => setTestedGood(e.target.checked)}
              />{" "}
              Tested Good
            </label>

            <input
              placeholder="Tested By"
              value={testedBy}
              onChange={(e) => setTestedBy(e.target.value)}
              style={inputStyle}
            />

            <button onClick={markReceived}>Save Received</button>
            <button onClick={closeReceivePopup} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  width: 460,
  maxHeight: "90vh",
  overflowY: "auto",
  borderRadius: 12
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: 10,
  marginBottom: 8,
  boxSizing: "border-box"
};

export default OrdersManager;