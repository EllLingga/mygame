// netlify/functions/admin.js
// Admin panel backend — list, approve, reject top-up requests

const { getStore } = require("@netlify/blobs");

// Simple admin password check (change this in real use via env var ADMIN_PASSWORD)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Auth check
  const pwd = event.headers["x-admin-password"] || event.queryStringParameters?.pwd;
  if (pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const store = getStore("topup_requests");

  // ── GET: list all requests ───────────────────────────────────────
  if (event.httpMethod === "GET") {
    try {
      let index = [];
      try { index = await store.get("__index__", { type: "json" }) || []; } catch {}

      const requests = [];
      for (const id of index.slice(0, 100)) {
        try {
          const req = await store.get(id, { type: "json" });
          if (req) requests.push(req);
        } catch {}
      }
      return { statusCode: 200, headers, body: JSON.stringify(requests) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── PATCH: approve or reject a request ──────────────────────────
  if (event.httpMethod === "PATCH") {
    try {
      const body = JSON.parse(event.body);
      const { id, action, adminNote } = body; // action: "approve" | "reject"

      if (!id || !action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id or action" }) };
      }

      const existing = await store.get(id, { type: "json" });
      if (!existing) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Request not found" }) };
      }

      existing.status = action === "approve" ? "approved" : "rejected";
      existing.adminNote = adminNote || "";
      existing.updatedAt = new Date().toISOString();

      await store.setJSON(id, existing);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, request: existing }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};

