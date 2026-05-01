import { supabase } from "./supabaseClient";

// --- ADDED START ---
// Phase 25: shared helpers for locking invoices and deducting invoice parts from inventory.
// This is intentionally separate so it can be safely imported into InvoiceManager later
// without replacing your existing invoice logic.

export function getInvoiceLockReason(invoice) {
  if (!invoice) return "";

  const lockedBySignature = Boolean(invoice.locked_after_signature || invoice.signature_locked);
  const lockedByPayment = Boolean(invoice.locked_after_payment || invoice.payment_locked);
  const explicitlyLocked = Boolean(invoice.is_locked);

  if (explicitlyLocked) return invoice.lock_reason || "Invoice is locked.";
  if (lockedBySignature) return "Invoice is locked after repair order signature.";
  if (lockedByPayment) return "Invoice is locked after payment.";
  return "";
}

export function isInvoiceLocked(invoice) {
  return Boolean(getInvoiceLockReason(invoice));
}

export async function lockInvoiceRecord({ invoiceId, reason, user }) {
  if (!invoiceId) {
    throw new Error("invoiceId is required.");
  }

  const { error } = await supabase.from("invoices").update({
    is_locked: true,
    lock_reason: reason || "Locked",
    locked_at: new Date().toISOString(),
    locked_by: user?.id || null,
    updated_at: new Date().toISOString()
  }).eq("id", invoiceId);

  if (error) throw error;

  await supabase.from("audit_logs").insert({
    action: "Invoice Locked",
    table_name: "invoices",
    record_id: invoiceId,
    user_id: user?.id || null,
    user_email: user?.email || "",
    details: reason || "Locked"
  });
}

export async function unlockInvoiceRecord({ invoiceId, reason, user }) {
  if (!invoiceId) {
    throw new Error("invoiceId is required.");
  }

  const { error } = await supabase.from("invoices").update({
    is_locked: false,
    lock_reason: "",
    unlocked_at: new Date().toISOString(),
    unlocked_by: user?.id || null,
    updated_at: new Date().toISOString()
  }).eq("id", invoiceId);

  if (error) throw error;

  await supabase.from("audit_logs").insert({
    action: "Invoice Unlocked",
    table_name: "invoices",
    record_id: invoiceId,
    user_id: user?.id || null,
    user_email: user?.email || "",
    details: reason || "Unlocked"
  });
}

export function flattenInvoiceParts(invoice) {
  const result = [];

  if (!invoice) return result;

  const laborItems = Array.isArray(invoice.labor_items) ? invoice.labor_items : [];
  const directParts = Array.isArray(invoice.parts_items) ? invoice.parts_items : [];

  laborItems.forEach((labor) => {
    const parts = Array.isArray(labor.parts) ? labor.parts : [];
    parts.forEach((part) => result.push({ ...part, labor_description: labor.description || "" }));
  });

  directParts.forEach((part) => result.push(part));

  return result;
}

export async function autoDeductInvoiceParts({ invoice, user, repairOrderNumber }) {
  if (!invoice) {
    throw new Error("invoice is required.");
  }

  const parts = flattenInvoiceParts(invoice).filter((part) => {
    return part.part_number && Number(part.quantity || part.qty || 0) > 0;
  });

  if (parts.length === 0) {
    return { deducted: 0, message: "No inventory parts found on invoice." };
  }

  let deducted = 0;
  const errors = [];

  for (const part of parts) {
    const qtyToUse = Number(part.quantity || part.qty || 0);

    const { data: stockRows, error: stockError } = await supabase
      .from("parts")
      .select("*")
      .eq("part_number", part.part_number)
      .order("created_at", { ascending: true });

    if (stockError) {
      errors.push(`${part.part_number}: ${stockError.message}`);
      continue;
    }

    let remaining = qtyToUse;

    for (const stock of stockRows || []) {
      if (remaining <= 0) break;

      const available = Number(stock.quantity || 0);
      const useQty = Math.min(available, remaining);

      if (useQty <= 0) continue;

      const { error: updateError } = await supabase
        .from("parts")
        .update({
          quantity: available - useQty,
          updated_at: new Date().toISOString()
        })
        .eq("id", stock.id);

      if (updateError) {
        errors.push(`${part.part_number}: ${updateError.message}`);
        continue;
      }

      await supabase.from("history").insert({
        part_number: part.part_number,
        part_description: part.description || part.part_description || stock.name || "",
        quantity: useQty,
        cost: Number(part.cost || part.part_price || stock.cost || 0),
        repair_order_number: repairOrderNumber || invoice.repair_order_number || invoice.invoice_number || "",
        used_date: new Date().toISOString(),
        used_by: user?.email || user?.id || "system",
        notes: `Auto-deducted from invoice ${invoice.invoice_number || invoice.repair_order_number || invoice.id}`
      });

      remaining -= useQty;
      deducted += useQty;
    }

    if (remaining > 0) {
      errors.push(`${part.part_number}: ${remaining} unit(s) could not be deducted because stock was too low.`);
    }
  }

  await supabase.from("audit_logs").insert({
    action: "Invoice Parts Auto-Deducted",
    table_name: "invoices",
    record_id: invoice.id,
    user_id: user?.id || null,
    user_email: user?.email || "",
    details: `Deducted ${deducted} unit(s). ${errors.length ? errors.join(" | ") : ""}`
  });

  return {
    deducted,
    errors,
    message: errors.length
      ? `Deducted ${deducted} unit(s), with warnings.`
      : `Deducted ${deducted} unit(s).`
  };
}
// --- ADDED END ---
