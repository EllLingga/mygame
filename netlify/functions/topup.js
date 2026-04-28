// netlify/functions/topup.js
const JSONBIN_API_KEY = "$2a$10$.YFrLFivKiL4oHkYlXXZ7OZu0yDi2xC.sLg0SNS0DRlWGeUmtxYpq";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  try {
    const binId = await getBinId();
    const record = await readData(binId);
    if (!record.requests) record.requests = [];

    if (event.httpMethod === "GET") {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id" }) };
      const req = record.requests.find(function(r) { return r.id === id; });
      if (!req) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      return { statusCode: 200, headers, body: JSON.stringify(req) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const playerName = body.playerName;
      const gems = body.gems;
      const amount = body.amount;
      const paymentMethod = body.paymentMethod;

      if (!playerName || !gems || !amount || !paymentMethod) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing fields" }) };
      }

      const id = "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      const newReq = {
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

      record.requests.unshift(newReq);
      if (record.requests.length > 200) record.requests = record.requests.slice(0, 200);
      await writeData(binId, record);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: id, binId: binId }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
