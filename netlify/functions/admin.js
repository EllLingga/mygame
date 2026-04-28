// netlify/functions/admin.js
const { getStore } = require("@netlify/blobs");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Auth check
  const pwd = (event.headers && (event.headers["x-admin-password"] || event.headers["X-Admin-Password"]))
    || (event.queryStringParameters && event.queryStringParameters.pwd);

  if (pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const store = getStore({
      name: "topup_requests",
      consistency: "strong",
    });

    // ── GET: list semua request ──────────────────────────────────
    if (event.httpMethod === "GET") {
      let index = [];
      try {
        const raw = await store.get("__index__");
        if (raw) index = JSON.parse(raw);
      } catch (e) {
        index = [];
      }

      const requests = [];
      for (const id of index.slice(0, 100)) {
        try {
          const raw = await store.get(id);
          if (raw) requests.push(JSON.parse(raw));
        } catch (e) {}
      }

      return { statusCode: 200, headers, body: JSON.stringify(requests) };
    }

    // ── PATCH: approve atau reject request ───────────────────────
    if (event.httpMethod === "PATCH") {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      const { id, action, adminNote } = body;

      if (!id || !action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id or action" }) };
      }

      let existing = null;
      try {
        const raw = await store.get(id);
        if (raw) existing = JSON.parse(raw);
      } catch (e) {}

      if (!existing) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Request not found" }) };
      }

      existing.status = action === "approve" ? "approved" : "rejected";
      existing.adminNote = adminNote || "";
      existing.updatedAt = new Date().toISOString();

      await store.set(id, JSON.stringify(existing));

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, request: existing }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};
