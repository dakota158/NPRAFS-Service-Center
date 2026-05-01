import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function QuoteComparisonManager({ user }) {
  const [quotes, setQuotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    part_number: "",
    description: "",
    supplier_name: "",
    supplier_id: "",
    quoted_price: "",
    shipping: "",
    eta: "",
    warranty: "",
    notes: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [settingsResult, suppliersResult] = await Promise.all([
      supabase.from("app_settings").select("*").eq("setting_key", "supplier_quotes_json").maybeSingle(),
      supabase.from("suppliers").select("*").order("name", { ascending: true })
    ]);

    if (suppliersResult.error) {
      setMessage(suppliersResult.error.message);
      return;
    }

    setSuppliers(suppliersResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setQuotes(Array.isArray(parsed) ? parsed : []);
    } catch {
      setQuotes([]);
    }
  };

  const saveQuotes = async (nextQuotes) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "supplier_quotes_json",
        setting_value: JSON.stringify(nextQuotes, null, 2),
        description: "Supplier quote comparison records",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setQuotes(nextQuotes);
    return true;
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "supplier_id") {
        const supplier = suppliers.find((item) => item.id === value);
        next.supplier_name = supplier?.name || prev.supplier_name;
      }

      return next;
    });
  };

  const addQuote = async () => {
    setMessage("");

    if (!form.part_number && !form.description) {
      setMessage("Part number or description is required.");
      return;
    }

    const quote = {
      id: `quote_${Date.now()}`,
      ...form,
      quoted_price: Number(form.quoted_price || 0),
      shipping: Number(form.shipping || 0),
      total_price: Number(form.quoted_price || 0) + Number(form.shipping || 0),
      selected: false,
      created_by: user?.id || null,
      created_by_email: user?.email || "",
      created_at: new Date().toISOString()
    };

    const saved = await saveQuotes([quote, ...quotes]);

    if (!saved) return;

    setMessage("Quote saved.");
    setForm({
      part_number: "",
      description: "",
      supplier_name: "",
      supplier_id: "",
      quoted_price: "",
      shipping: "",
      eta: "",
      warranty: "",
      notes: ""
    });
  };

  const selectQuote = async (quote) => {
    const nextQuotes = quotes.map((item) =>
      item.part_number === quote.part_number && item.description === quote.description
        ? { ...item, selected: item.id === quote.id }
        : item
    );

    const saved = await saveQuotes(nextQuotes);

    if (saved) {
      await supabase.from("audit_logs").insert({
        action: "Supplier Quote Selected",
        table_name: "app_settings",
        record_id: quote.id,
        user_id: user?.id || null,
        user_email: user?.email || "",
        details: `Selected quote for ${quote.part_number || quote.description}`
      });
      setMessage("Quote selected.");
    }
  };

  const groupedQuotes = useMemo(() => {
    const groups = {};

    quotes.forEach((quote) => {
      const key = `${quote.part_number || ""}|${quote.description || ""}`;
      groups[key] = groups[key] || [];
      groups[key].push(quote);
    });

    return Object.entries(groups).map(([key, items]) => ({
      key,
      items: items.sort((a, b) => Number(a.total_price || 0) - Number(b.total_price || 0))
    }));
  }, [quotes]);

  return (
    <div>
      <h2>Supplier Quote Comparison</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("selected") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Add Supplier Quote</h3>

        <div style={gridStyle}>
          <label>
            Part #
            <input value={form.part_number} onChange={(e) => updateForm("part_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Description
            <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Supplier
            <select value={form.supplier_id} onChange={(e) => updateForm("supplier_id", e.target.value)} style={inputStyle}>
              <option value="">Manual supplier</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>

          <label>
            Supplier Name
            <input value={form.supplier_name} onChange={(e) => updateForm("supplier_name", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Price
            <input type="number" value={form.quoted_price} onChange={(e) => updateForm("quoted_price", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Shipping
            <input type="number" value={form.shipping} onChange={(e) => updateForm("shipping", e.target.value)} style={inputStyle} />
          </label>

          <label>
            ETA
            <input value={form.eta} onChange={(e) => updateForm("eta", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Warranty
            <input value={form.warranty} onChange={(e) => updateForm("warranty", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} style={textareaStyle} />
        </label>

        <button type="button" onClick={addQuote}>Save Quote</button>
      </div>

      {groupedQuotes.map((group) => (
        <div key={group.key} style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>
            {group.items[0].part_number || "No Part #"} - {group.items[0].description || "No Description"}
          </h3>

          <table border="1" cellPadding="8" style={tableStyle}>
            <thead>
              <tr>
                <th>Selected</th>
                <th>Supplier</th>
                <th>Price</th>
                <th>Shipping</th>
                <th>Total</th>
                <th>ETA</th>
                <th>Warranty</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {group.items.map((quote) => (
                <tr key={quote.id}>
                  <td>{quote.selected ? "Yes" : ""}</td>
                  <td>{quote.supplier_name || "-"}</td>
                  <td>${Number(quote.quoted_price || 0).toFixed(2)}</td>
                  <td>${Number(quote.shipping || 0).toFixed(2)}</td>
                  <td><strong>${Number(quote.total_price || 0).toFixed(2)}</strong></td>
                  <td>{quote.eta || "-"}</td>
                  <td>{quote.warranty || "-"}</td>
                  <td><button type="button" onClick={() => selectQuote(quote)}>Select</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {groupedQuotes.length === 0 && <p>No quotes saved.</p>}
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const textareaStyle = { ...inputStyle, minHeight: 70, marginBottom: 12 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default QuoteComparisonManager;
