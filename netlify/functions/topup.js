// netlify/functions/topup.js
const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const store = getStore({
      name: "topup_requests",
      consistency: "strong",
    });

    // ── GET: cek status request ──────────────────────────────────
    if (event.httpMethod === "GET") {
      const requestId = event.queryStringParameters && event.queryStringParameters.id;
      if (!requestId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id" }) };
      }

      let data = null;
      try {
        const raw = await store.get(requestId);
        if (raw) data = JSON.parse(raw);
      } catch (e) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      }

      if (!data) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── POST: kirim request topup baru ───────────────────────────
    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
      }

      const { playerName, gems, amount, paymentMethod } = body;

      if (!playerName || !gems || !amount || !paymentMethod) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields" }) };
      }

      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const id = "req_" + timestamp + "_" + random;

      const request = {
        id: id,
        playerName: String(playerName),
        gems: Number(gems),
        amount: Number(amount),
        paymentMethod: String(paymentMethod),
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        adminNote: "",
      };

      await store.set(id, JSON.stringify(request));

      // Update index
      let index = [];
      try {
        const raw = await store.get("__index__");
        if (raw) index = JSON.parse(raw);
      } catch (e) {
        index = [];
      }

      index.unshift(id);
      if (index.length > 500) index = index.slice(0, 500);
      await store.set("__index__", JSON.stringify(index));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, id: id }),
      };
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
