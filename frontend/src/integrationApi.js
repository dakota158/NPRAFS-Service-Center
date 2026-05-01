// --- ADDED START ---
// Safe Create React App / Electron compatible integration client.
// This avoids import.meta so the login screen will not blank/crash in CRA builds.

const DEFAULT_API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  window.localStorage.getItem("autoshop_integration_api_base") ||
  "http://localhost:4000";

export function getIntegrationApiBase() {
  const savedBase = window.localStorage.getItem("autoshop_integration_api_base");
  return savedBase || DEFAULT_API_BASE;
}

export function setIntegrationApiBase(value) {
  window.localStorage.setItem("autoshop_integration_api_base", value || DEFAULT_API_BASE);
}

export async function integrationRequest(path, options = {}) {
  const base = getIntegrationApiBase().replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

export function moneyToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function centsToMoney(value) {
  return Number(value || 0) / 100;
}
// --- ADDED END ---
