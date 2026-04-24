import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function OrdersManager({ user, canEditEverything }) {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    partNumber: "",
    partDescriptionSeller: "",
    quantity: "",
    cost: "", // What We Paid
    net: "",  // What We Charged
    dateApproved: "",
    repairOrderNumber: ""
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderedBy, setOrderedBy] = useState("");
  const [dateOrdered, setDateOrdered] = useState("");

  const [receiveOrder, setReceiveOrder] = useState(null);
  const [testedGood, setTestedGood] = useState(false);
  const [testedBy, setTestedBy] = useState("");

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("received", false)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setOrders(data || []);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const calculatedProfit =
    Number(form.net || 0) - Number(form.cost || 0);

  const addOrder = async () => {
    setMessage("");

    if (
      !form.partNumber ||
      !form.partDescriptionSeller ||
      !form.quantity ||
      form.cost === "" ||
      form.net === "" ||
      !form.dateApproved ||
      !form.repairOrderNumber
    ) {
      setMessage("All order fields are required");
      return;
    }

    const paid = Number(form.cost);
    const charged = Number(form.net);
    const profit = charged - paid;

    try {
      const { error } = await supabase.from("orders").insert({
        part_number: form.partNumber,
        part_description_seller: form.partDescriptionSeller,
        quantity: Number(form.quantity),
        cost: paid,
        net: charged,
        profit: profit,
        date_approved: form.dateApproved,
        repair_order_number: form.repairOrderNumber,
        part_ordered: false,
        ordered_by: "",
        date_ordered: null,
        received: false,
        tested_good: false,
        tested_by: "",
        received_date: null
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setForm({
        partNumber: "",
        partDescriptionSeller: "",
        quantity: "",
        cost: "",
        net: "",
        dateApproved: "",
        repairOrderNumber: ""
      });

      loadOrders();
    } catch (err) {
      setMessage(String(err.message || err));
    }
  };

  const openOrderedPopup = (order) => {
    setSelectedOrder(order);
    setOrderedBy(user?.username || user?.email || "");
    setDateOrdered("");
  };

  const closeOrderedPopup = () => {
    setSelectedOrder(null);
    setOrderedBy("");
    setDateOrdered("");
  };

  const markOrdered = async () => {
    if (!selectedOrder) return;

    if (!orderedBy || !dateOrdered) {
      setMessage("Ordered by and date ordered are required");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        part_ordered: true,
        ordered_by: orderedBy,
        date_ordered: dateOrdered
      })
      .eq("id", selectedOrder.id);

    if (error) {
      setMessage(error.message);
      return;
    }

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

    if (!testedBy) {
      setMessage("Tested by is required");
      return;
    }

    const receivedDate = new Date().toISOString();

    await supabase
      .from("orders")
      .update({
        received: true,
        tested_good: testedGood,
        tested_by: testedBy,
        received_date: receivedDate
      })
      .eq("id", receiveOrder.id);

    await supabase.from("parts").insert({
      name: receiveOrder.part_description_seller,
      quantity: receiveOrder.quantity,
      date_received: receivedDate,
      source_order_id: receiveOrder.id,
      part_number: receiveOrder.part_number,
      repair_order_number: receiveOrder.repair_order_number
    });

    closeReceivePopup();
    loadOrders();
  };

  const deleteOrder = async (id) => {
    if (!canEditEverything) return;

    await supabase.from("orders").delete().eq("id", id);
    loadOrders();
  };

  return (
    <div>
      <h2>Orders</h2>

      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <input
          placeholder="Part Number"
          value={form.partNumber}
          onChange={(e) => updateForm("partNumber", e.target.value)}
        />

        <input
          placeholder="Part Description / Seller"
          value={form.partDescriptionSeller}
          onChange={(e) =>
            updateForm("partDescriptionSeller", e.target.value)
          }
        />

        <input
          type="number"
          placeholder="Quantity"
          value={form.quantity}
          onChange={(e) => updateForm("quantity", e.target.value)}
        />

        <input
          type="number"
          step="0.01"
          placeholder="What We Paid"
          value={form.cost}
          onChange={(e) => updateForm("cost", e.target.value)}
        />

        <input
          type="number"
          step="0.01"
          placeholder="What We Charged"
          value={form.net}
          onChange={(e) => updateForm("net", e.target.value)}
        />

        <div style={{ padding: 10, background: "#eee" }}>
          Profit: ${calculatedProfit.toFixed(2)}
        </div>

        <input
          type="date"
          value={form.dateApproved}
          onChange={(e) => updateForm("dateApproved", e.target.value)}
        />

        <input
          placeholder="Repair Order #"
          value={form.repairOrderNumber}
          onChange={(e) =>
            updateForm("repairOrderNumber", e.target.value)
          }
        />

        <button onClick={addOrder}>Add Order</button>
      </div>

      {message && <p style={{ color: "red" }}>{message}</p>}

      <hr />

      <table border="1" cellPadding="6" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Paid</th>
            <th>Charged</th>
            <th>Profit</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const paid = Number(order.cost || 0);
            const charged = Number(order.net || 0);
            const profit = charged - paid;

            return (
              <tr key={order.id}>
                <td>{order.part_number}</td>
                <td>{order.part_description_seller}</td>
                <td>{order.quantity}</td>
                <td>${paid.toFixed(2)}</td>
                <td>${charged.toFixed(2)}</td>
                <td>${profit.toFixed(2)}</td>
                <td>
                  <button onClick={() => openOrderedPopup(order)}>
                    Mark Ordered
                  </button>

                  {canEditEverything && (
                    <button onClick={() => deleteOrder(order.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default OrdersManager;