// netlify/functions/topup.js
// Handles player top-up requests using Netlify Blobs for storage

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore("topup_requests");

  // ── GET: player polls their own request status ──────────────────
  if (event.httpMethod === "GET") {
    const requestId = event.queryStringParameters?.id;
    if (!requestId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id" }) };
    }
    try {
      const data = await store.get(requestId, { type: "json" });
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── POST: player submits a new top-up request ───────────────────
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const { playerName, gems, amount, paymentMethod, paymentProof } = body;

      if (!playerName || !gems || !amount || !paymentMethod) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields" }) };
      }

      const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const request = {
        id,
        playerName,
        gems,
        amount,
        paymentMethod,
        paymentProof: paymentProof || null,
        status: "pending", // pending | approved | rejected
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        adminNote: "",
      };

      await store.setJSON(id, request);

      // Also maintain an index list
      let index = [];
      try { index = await store.get("__index__", { type: "json" }) || []; } catch {}
      index.unshift(id);
      if (index.length > 200) index = index.slice(0, 200); // keep last 200
      await store.setJSON("__index__", index);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, id }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
