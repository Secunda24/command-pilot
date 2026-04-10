const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const AUTH_TOKEN = process.env.AUTH_TOKEN || "change-me-in-render-env";
const PORT = Number(process.env.PORT || 3000);
const MOBILE_UI_DIR = path.resolve(__dirname, "../../../apps/mobile-remote");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let pcSocket = null;
const phones = new Set();

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sendJson(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(payload));
}

function broadcastPhones(payload) {
  const text = JSON.stringify(payload);
  for (const ws of phones) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(text);
    }
  }
}

function pcOnline() {
  return pcSocket !== null && pcSocket.readyState === WebSocket.OPEN;
}

app.use(express.static(MOBILE_UI_DIR));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    pcOnline: pcOnline(),
    phones: phones.size
  });
});

wss.on("connection", (ws, req) => {
  const clientId = crypto.randomBytes(5).toString("hex");
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

  ws._clientId = clientId;
  ws._authed = false;
  ws._role = null;

  console.log(`[WS] Connect ${clientId} from ${ip}`);

  const authTimeout = setTimeout(() => {
    if (!ws._authed) {
      console.log(`[WS] ${clientId} auth timeout`);
      ws.terminate();
    }
  }, 5000);

  ws.on("message", (raw) => {
    const data = safeParseJson(raw);
    if (!data) {
      return;
    }

    if (!ws._authed) {
      if (data.type !== "auth" || data.token !== AUTH_TOKEN) {
        sendJson(ws, { type: "error", text: "Invalid token.", message: "Invalid token." });
        ws.terminate();
        return;
      }

      clearTimeout(authTimeout);
      ws._authed = true;
      ws._role = data.role === "pc" ? "pc" : "phone";
      console.log(`[AUTH] ${clientId} as ${ws._role}`);

      if (ws._role === "pc") {
        if (pcSocket && pcSocket !== ws) {
          pcSocket.terminate();
        }
        pcSocket = ws;
        sendJson(ws, { type: "auth_ok", message: "PC agent registered." });
        broadcastPhones({ type: "pc_status", online: true });
      } else {
        phones.add(ws);
        sendJson(ws, {
          type: "auth_ok",
          message: "Phone connected.",
          pcOnline: pcOnline()
        });
      }
      return;
    }

    if (ws._role === "phone") {
      if (data.type === "command") {
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!text) {
          return;
        }

        if (!pcOnline()) {
          sendJson(ws, {
            type: "response",
            intent: "error",
            text: "PC is offline.",
            message: "PC is offline."
          });
          return;
        }

        sendJson(pcSocket, { type: "command", text, fromPhone: clientId });
        return;
      }

      if (data.type === "ping") {
        sendJson(ws, { type: "pong" });
      }
      return;
    }

    if (ws._role === "pc") {
      if (["response", "status", "error", "info"].includes(data.type)) {
        broadcastPhones(data);
      }
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);

    if (ws._role === "pc" && pcSocket === ws) {
      pcSocket = null;
      console.log(`[WS] PC agent disconnected ${clientId}`);
      broadcastPhones({ type: "pc_status", online: false });
      return;
    }

    if (ws._role === "phone") {
      phones.delete(ws);
      console.log(`[WS] Phone disconnected ${clientId} (${phones.size} active)`);
    }
  });

  ws.on("error", (error) => {
    console.error(`[WS ERROR] ${clientId}`, error.message);
  });
});

setInterval(() => {
  http
    .get(`http://127.0.0.1:${PORT}/health`, () => undefined)
    .on("error", () => undefined);
}, 14 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`[REMOTE RELAY] Listening on port ${PORT}`);
  console.log(`[REMOTE RELAY] Mobile UI served from ${MOBILE_UI_DIR}`);
});
