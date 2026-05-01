import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const EXPENSE_CATEGORIES = [
  "Parts",
  "Supplies",
  "Tools",
  "Equipment",
  "Rent",
  "Utilities",
  "Payroll",
  "Marketing",
  "Software",
  "Other"
];

function ExpenseManager({ user, canEditEverything }) {
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "Parts",
    vendor: "",
    supplier_id: "",
    description: "",
    amount: "",
    payment_method: "Cash",
    receipt_number: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [settingsResult, suppliersResult] = await Promise.all([
      supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "shop_expenses_json")
        .maybeSingle(),
      supabase.from("suppliers").select("*").order("name", { ascending: true })
    ]);

    if (suppliersResult.error) {
      setMessage(suppliersResult.error.message);
      return;
    }

    setSuppliers(suppliersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setExpenses(Array.isArray(parsed) ? parsed : []);
    } catch {
      setExpenses([]);
    }
  };

  const saveExpenses = async (nextExpenses) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "shop_expenses_json",
        setting_value: JSON.stringify(nextExpenses, null, 2),
        description: "Shop expense tracking records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setExpenses(nextExpenses);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "supplier_id") {
        const supplier = suppliers.find((item) => item.id === value);
        next.vendor = supplier?.name || prev.vendor;
      }

      return next;
    });
  };

  const addExpense = async () => {
    setMessage("");

    if (!form.expense_date || !form.description || !form.amount) {
      setMessage("Date, description, and amount are required.");
      return;
    }

    const amount = Number(form.amount || 0);

    if (!amount || amount <= 0) {
      setMessage("Amount must be greater than zero.");
      return;
    }

    const expense = {
      id: `expense_${Date.now()}`,
      ...form,
      amount,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveExpenses([expense, ...expenses]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Expense Created",
      table_name: "app_settings",
      record_id: expense.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Expense ${expense.category}: $${amount.toFixed(2)}`
    });

    setMessage("Expense saved.");
    setForm({
      expense_date: new Date().toISOString().slice(0, 10),
      category: "Parts",
      vendor: "",
      supplier_id: "",
      description: "",
      amount: "",
      payment_method: "Cash",
      receipt_number: "",
      notes: ""
    });
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      monthFilter ? String(expense.expense_date || "").startsWith(monthFilter) : true
    );
  }, [expenses, monthFilter]);

  const categoryTotals = useMemo(() => {
    const totals = {};
    filteredExpenses.forEach((expense) => {
      totals[expense.category] =
        (totals[expense.category] || 0) + Number(expense.amount || 0);
    });
    return totals;
  }, [filteredExpenses]);

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const exportCsv = () => {
    const rows = [
      ["Date", "Category", "Vendor", "Description", "Amount", "Method", "Receipt", "Notes"],
      ...filteredExpenses.map((expense) => [
        expense.expense_date || "",
        expense.category || "",
        expense.vendor || "",
        expense.description || "",
        expense.amount || 0,
        expense.payment_method || "",
        expense.receipt_number || "",
        expense.notes || ""
      ])
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `expenses-${monthFilter || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Expense Tracking</h2>

      {message && (
        <p style={{ color: message.includes("saved") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={cardGrid}>
        <StatCard title="Filtered Expenses" value={filteredExpenses.length} />
        <StatCard title="Total Expenses" value={`$${totalExpenses.toFixed(2)}`} />
        <StatCard title="Categories" value={Object.keys(categoryTotals).length} />
      </div>

      <div style={panelStyle}>
        <h3>Add Expense</h3>

        <div style={gridStyle}>
          <label>
            Date
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => updateForm("expense_date", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => updateForm("category", e.target.value)}
              style={inputStyle}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            Supplier
            <select
              value={form.supplier_id}
              onChange={(e) => updateForm("supplier_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Manual Vendor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vendor
            <input
              value={form.vendor}
              onChange={(e) => updateForm("vendor", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              value={form.amount}
              onChange={(e) => updateForm("amount", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Payment Method
            <select
              value={form.payment_method}
              onChange={(e) => updateForm("payment_method", e.target.value)}
              style={inputStyle}
            >
              <option>Cash</option>
              <option>Check</option>
              <option>Credit Card</option>
              <option>Debit Card</option>
              <option>ACH</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Receipt #
            <input
              value={form.receipt_number}
              onChange={(e) => updateForm("receipt_number", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            style={textareaStyle}
          />
        </label>

        <button type="button" onClick={addExpense}>
          Save Expense
        </button>
      </div>

      <div style={panelStyle}>
        <h3>Expense View</h3>

        <label>
          Month
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={() => setMonthFilter("")}>
          Show All
        </button>{" "}
        <button type="button" onClick={exportCsv}>
          Export CSV
        </button>

        <h4>Category Totals</h4>
        {Object.entries(categoryTotals).map(([category, amount]) => (
          <p key={category}>
            <strong>{category}:</strong> ${amount.toFixed(2)}
          </p>
        ))}
      </div>

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Vendor</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Receipt</th>
          </tr>
        </thead>

        <tbody>
          {filteredExpenses.map((expense) => (
            <tr key={expense.id}>
              <td>{expense.expense_date || "-"}</td>
              <td>{expense.category || "-"}</td>
              <td>{expense.vendor || "-"}</td>
              <td>{expense.description || "-"}</td>
              <td>${Number(expense.amount || 0).toFixed(2)}</td>
              <td>{expense.payment_method || "-"}</td>
              <td>{expense.receipt_number || "-"}</td>
            </tr>
          ))}

          {filteredExpenses.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No expenses found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 6 }}>{value}</div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 80, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 };
const statCard = { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };

export default ExpenseManager;
