const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* =========================
   GRAPH WORLD
========================= */

const nodes = {
  A: { x: 100, y: 300 },
  B: { x: 400, y: 300 }, // intersection
  C: { x: 700, y: 300 },
  D: { x: 400, y: 100 }
};

const edges = [
  { id: 0, from: "A", to: "B" },
  { id: 1, from: "B", to: "C" },
  { id: 2, from: "B", to: "D" }
];

/* =========================
   GAME STATE
========================= */

let players = {};
let projectiles = {};

/* =========================
   HELPERS
========================= */

function getPosition(edgeId, t) {
  const edge = edges.find(e => e.id === edgeId);
  const a = nodes[edge.from];
  const b = nodes[edge.to];

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function getDirection(edgeId) {
  const edge = edges.find(e => e.id === edgeId);
  const a = nodes[edge.from];
  const b = nodes[edge.to];

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  return { x: dx / len, y: dy / len };
}

/* =========================
   SHOOT PROJECTILE
========================= */

function shoot(playerId) {
  const p = players[playerId];
  if (!p) return;

  const pos = getPosition(p.edge, p.t);
  const dir = getDirection(p.edge);

  const id = Math.random().toString(36).slice(2);

  projectiles[id] = {
    x: pos.x,
    y: pos.y,
    vx: dir.x * 8,
    vy: dir.y * 8,
    owner: playerId
  };
}

/* =========================
   PLAYER CONNECTION
========================= */

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2);

  players[id] = {
    edge: 0,
    t: 0,
    input: { dx: 0, dy: 0, shoot: false }
  };

  ws.id = id;

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "input") {
      players[id].input = data;

      if (data.shoot) {
        shoot(id);
      }
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

/* =========================
   COLLISION CONSTANTS
========================= */

const PLAYER_RADIUS = 10;
const PROJECTILE_RADIUS = 5;

/* =========================
   GAME LOOP
========================= */

setInterval(() => {

  /* =========================
     MOVE PLAYERS (GRAPH SYSTEM)
  ========================= */

  for (let id in players) {
    const p = players[id];

    p.t += 0.015;

    if (p.t >= 1) {
      const currentNode = edges.find(e => e.id === p.edge).to;
      const options = edges.filter(e => e.from === currentNode);

      // simple direction logic
      if (p.input.dx > 0) p.edge = options[0]?.id ?? p.edge;
      if (p.input.dy < 0) p.edge = options[1]?.id ?? p.edge;

      p.t = 0;
    }
  }

  /* =========================
     MOVE PROJECTILES
  ========================= */

  for (let id in projectiles) {
    const pr = projectiles[id];

    pr.x += pr.vx;
    pr.y += pr.vy;

    // remove if out of bounds
    if (
      pr.x < -1000 || pr.x > 2000 ||
      pr.y < -1000 || pr.y > 2000
    ) {
      delete projectiles[id];
      continue;
    }
  }

  /* =========================
     COLLISION DETECTION
  ========================= */

  for (let pid in players) {
    const p = players[pid];
    const pos = getPosition(p.edge, p.t);

    for (let prId in projectiles) {
      const pr = projectiles[prId];

      const dx = pr.x - pos.x;
      const dy = pr.y - pos.y;

      const dist = Math.hypot(dx, dy);

      if (dist < PLAYER_RADIUS + PROJECTILE_RADIUS) {

        // 💥 HIT DETECTED

        if (pr.owner !== pid) {
          delete projectiles[prId];

          console.log(`Player ${pid} hit by ${pr.owner}`);

          // optional: respawn or remove player
          // p.edge = 0; p.t = 0;
        }
      }
    }
  }

  /* =========================
     BUILD STATE
  ========================= */

  const state = {
    players: {},
    projectiles
  };

  for (let id in players) {
    state.players[id] = getPosition(players[id].edge, players[id].t);
  }

  /* =========================
     BROADCAST STATE
  ========================= */

  const msg = JSON.stringify(state);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

}, 1000 / 30);

/* =========================
   START SERVER
========================= */

server.listen(8080, () => {
  console.log("Server running on ws://localhost:8080");
});