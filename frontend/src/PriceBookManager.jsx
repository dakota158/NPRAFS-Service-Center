import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function PriceBookManager({ user, canEditEverything }) {
  const [priceBook, setPriceBook] = useState([]);
  const [parts, setParts] = useState([]);
  const [markupTiers, setMarkupTiers] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    part_number: "",
    description: "",
    cost: "",
    markup_percent: "",
    retail_price: "",
    supplier: "",
    category: ""
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [settingsResult, partsResult, markupResult] = await Promise.all([
      supabase
        .from("app_settings")
        .select("*")
        .eq("setting_key", "parts_price_book_json")
        .maybeSingle(),
      supabase.from("parts").select("*").order("part_number", { ascending: true }),
      supabase.from("markup_tiers").select("*").order("min", { ascending: true })
    ]);

    if (partsResult.error || markupResult.error) {
      setMessage(partsResult.error?.message || markupResult.error?.message);
      return;
    }

    setParts(partsResult.data || []);
    setMarkupTiers(markupResult.data || []);

    try {
      const parsed = JSON.parse(settingsResult.data?.setting_value || "[]");
      setPriceBook(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPriceBook([]);
    }
  };

  const savePriceBook = async (nextPriceBook) => {
    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: "parts_price_book_json",
        setting_value: JSON.stringify(nextPriceBook, null, 2),
        description: "Parts price book",
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      setMessage(error.message);
      return false;
    }

    setPriceBook(nextPriceBook);
    return true;
  };

  const findMarkupPercent = (cost) => {
    const numericCost = Number(cost || 0);

    const tier = markupTiers.find((item) => {
      const min = Number(item.min || 0);
      const max =
        item.max === null || item.max === undefined || item.max === ""
          ? Infinity
          : Number(item.max);

      return numericCost >= min && numericCost <= max;
    });

    return Number(tier?.percent || 0);
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "cost") {
        const markup = next.markup_percent || findMarkupPercent(value);
        next.markup_percent = String(markup);
        next.retail_price = (
          Number(value || 0) *
          (1 + Number(markup || 0) / 100)
        ).toFixed(2);
      }

      if (field === "markup_percent") {
        next.retail_price = (
          Number(next.cost || 0) *
          (1 + Number(value || 0) / 100)
        ).toFixed(2);
      }

      return next;
    });
  };

  const addPriceBookItem = async () => {
    setMessage("");

    if (!form.part_number && !form.description) {
      setMessage("Part number or description is required.");
      return;
    }

    const item = {
      id: `price_${Date.now()}`,
      ...form,
      cost: Number(form.cost || 0),
      markup_percent: Number(form.markup_percent || 0),
      retail_price: Number(form.retail_price || 0),
      created_by: user?.id || null,
      created_at: new Date().toISOString()
    };

    const saved = await savePriceBook([item, ...priceBook]);

    if (!saved) return;

    await supabase.from("audit_logs").insert({
      action: "Price Book Item Created",
      table_name: "app_settings",
      record_id: item.id,
      user_id: user?.id || null,
      user_email: user?.email || "",
      details: `Created price book item ${item.part_number || item.description}`
    });

    setMessage("Price book item saved.");
    setForm({
      part_number: "",
      description: "",
      cost: "",
      markup_percent: "",
      retail_price: "",
      supplier: "",
      category: ""
    });
  };

  const importFromInventory = async () => {
    const nextItems = parts.map((part) => {
      const existing = priceBook.find((item) => item.part_number === part.part_number);
      if (existing) return existing;

      return {
        id: `price_${part.id || Date.now()}_${Math.random()}`,
        part_number: part.part_number || "",
        description: part.name || "",
        cost: 0,
        markup_percent: 0,
        retail_price: 0,
        supplier: "",
        category: "Inventory",
        created_by: user?.id || null,
        created_at: new Date().toISOString()
      };
    });

    const merged = [
      ...priceBook,
      ...nextItems.filter(
        (item) => !priceBook.some((existing) => existing.part_number === item.part_number)
      )
    ];

    const saved = await savePriceBook(merged);
    if (saved) setMessage("Inventory imported into price book.");
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return priceBook;

    return priceBook.filter((item) =>
      [item.part_number, item.description, item.supplier, item.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [priceBook, search]);

  const exportCsv = () => {
    const rows = [
      ["Part #", "Description", "Cost", "Markup %", "Retail", "Supplier", "Category"],
      ...filteredItems.map((item) => [
        item.part_number || "",
        item.description || "",
        item.cost || 0,
        item.markup_percent || 0,
        item.retail_price || 0,
        item.supplier || "",
        item.category || ""
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
    link.download = `parts-price-book-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>Parts Price Book</h2>

      {message && (
        <p style={{ color: message.includes("saved") || message.includes("imported") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Add Price Book Item</h3>

        <div style={gridStyle}>
          <label>
            Part Number
            <input value={form.part_number} onChange={(e) => updateForm("part_number", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Description
            <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Cost
            <input type="number" value={form.cost} onChange={(e) => updateForm("cost", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Markup %
            <input type="number" value={form.markup_percent} onChange={(e) => updateForm("markup_percent", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Retail Price
            <input type="number" value={form.retail_price} onChange={(e) => updateForm("retail_price", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Supplier
            <input value={form.supplier} onChange={(e) => updateForm("supplier", e.target.value)} style={inputStyle} />
          </label>

          <label>
            Category
            <input value={form.category} onChange={(e) => updateForm("category", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <button type="button" onClick={addPriceBookItem}>Save Item</button>{" "}
        <button type="button" onClick={importFromInventory}>Import From Inventory</button>{" "}
        <button type="button" onClick={exportCsv}>Export CSV</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search price book..."
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <table border="1" cellPadding="8" style={tableStyle}>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Cost</th>
            <th>Markup</th>
            <th>Retail</th>
            <th>Supplier</th>
            <th>Category</th>
          </tr>
        </thead>

        <tbody>
          {filteredItems.map((item) => (
            <tr key={item.id}>
              <td>{item.part_number || "-"}</td>
              <td>{item.description || "-"}</td>
              <td>${Number(item.cost || 0).toFixed(2)}</td>
              <td>{Number(item.markup_percent || 0).toFixed(2)}%</td>
              <td>${Number(item.retail_price || 0).toFixed(2)}</td>
              <td>{item.supplier || "-"}</td>
              <td>{item.category || "-"}</td>
            </tr>
          ))}

          {filteredItems.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>No price book items.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };

export default PriceBookManager;
