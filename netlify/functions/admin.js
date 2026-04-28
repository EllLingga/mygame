// netlify/functions/admin.js
const JSONBIN_API_KEY = "$2a$10$.YFrLFivKiL4oHkYlXXZ7OZu0yDi2xC.sLg0SNS0DRlWGeUmtxYpq";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Content-Type": "application/json",
};

async function getBinId() {
  const binId = process.env.JSONBIN_BIN_ID;
  if (binId) return binId;
  const res = await fetch("https://api.jsonbin.io/v3/b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_API_KEY,
      "X-Bin-Name": "rakha-gacha-topup",
      "X-Private": "true",
    },
    body: JSON.stringify({ requests: [] }),
  });
  const data = await res.json();
  return data.metadata.id;
}

async function readData(binId) {
  const res = await fetch("https://api.jsonbin.io/v3/b/" + binId + "/latest", {
    headers: { "X-Master-Key": JSONBIN_API_KEY },
  });
  const data = await res.json();
  return data.record || { requests: [] };
}

async function writeData(binId, record) {
  await fetch("https://api.jsonbin.io/v3/b/" + binId, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_API_KEY,
    },
    body: JSON.stringify(record),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const pwd = (event.headers && (event.headers["x-admin-password"] || event.headers["X-Admin-Password"]))
    || (event.queryStringParameters && event.queryStringParameters.pwd);

  if (pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const binId = await getBinId();
    const record = await readData(binId);
    if (!record.requests) record.requests = [];

    // GET — list semua request
    if (event.httpMethod === "GET") {
      return { statusCode: 200, headers, body: JSON.stringify(record.requests) };
    }

    // PATCH — approve atau reject
    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body);
      const id = body.id;
      const action = body.action;
      const adminNote = body.adminNote || "";

      if (!id || !action) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id or action" }) };
      }

      const idx = record.requests.findIndex(function(r) { return r.id === id; });
      if (idx === -1) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      }

      record.requests[idx].status = action === "approve" ? "approved" : "rejected";
      record.requests[idx].adminNote = adminNote;
      record.requests[idx].updatedAt = new Date().toISOString();

      await writeData(binId, record);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, request: record.requests[idx] }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
