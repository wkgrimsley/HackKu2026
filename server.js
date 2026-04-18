const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const wss = new WebSocket.Server({ server });

/* =========================
   GRAPH MAP
========================= */

const nodes = {
    A: { x: 100, y: 300 },
    B: { x: 400, y: 300 },
    C: { x: 700, y: 300 },
    D: { x: 400, y: 100 }
};

const edges = [
    { id: 0, from: "A", to: "B" },
    { id: 1, from: "B", to: "C" },
    { id: 2, from: "B", to: "D" }
];

/* =========================
   MATCH STATE
========================= */

let matchmakingQueue = [];
let matches = new Map();

/* =========================
   CREATE MATCH
========================= */

function createMatch() {
    return {
        players: {},
        projectiles: {},
        sockets: []
    };
}

/* =========================
   GRAPH HELPERS
========================= */

function getPosition(match, edgeId, t) {
    const edge = match.edges.find(e => e.id === edgeId);
    const a = nodes[edge.from];
    const b = nodes[edge.to];

    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

function getDirection(match, edgeId) {
    const edge = match.edges.find(e => e.id === edgeId);
    const a = nodes[edge.from];
    const b = nodes[edge.to];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);

    return { x: dx / len, y: dy / len };
}

/* =========================
   MATCHMAKING
========================= */

function tryMatchmake() {
    while (matchmakingQueue.length >= 2) {
        const group = matchmakingQueue.splice(0, 2);

        const roomId = Math.random().toString(36).slice(2);
        const match = createMatch();
        match.edges = edges;
        match.nodes = nodes;

        group.forEach((ws, i) => {
            const id = ws.id;

            match.players[id] = {
                edge: 0,
                t: 0,
                input: { dx: 0, dy: 0 }
            };

            match.sockets.push(ws);
            ws.roomId = roomId;

            ws.send(JSON.stringify({
                type: "match_found",
                roomId
            }));
        });

        matches.set(roomId, match);
        console.log("Match created:", roomId);
    }
}

/* =========================
   CONNECTIONS
========================= */

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.roomId = null;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        /* JOIN MATCHMAKING */
        if (data.type === "join_match") {
            matchmakingQueue.push(ws);
            tryMatchmake();
        }

        /* INPUT */
        if (data.type === "input") {
            const match = matches.get(ws.roomId);
            if (!match) return;

            const p = match.players[ws.id];
            if (!p) return;

            p.input = {
                dx: data.dx || 0,
                dy: data.dy || 0
            };
        }
    });

    ws.on("close", () => {
        matchmakingQueue = matchmakingQueue.filter(p => p !== ws);

        if (ws.roomId) {
            const match = matches.get(ws.roomId);
            if (match) {
                delete match.players[ws.id];
                match.sockets = match.sockets.filter(s => s !== ws);
            }
        }
    });
});

/* =========================
   GAME LOOP (INPUT DRIVEN)
========================= */

setInterval(() => {
    matches.forEach((match) => {

        const SPEED = 0.02;

        /* MOVE PLAYERS (INPUT CONTROLLED) */
        for (let id in match.players) {
            const p = match.players[id];

            const edge = match.edges.find(e => e.id === p.edge);
            if (!edge) continue;

            const from = match.nodes[edge.from];
            const to = match.nodes[edge.to];

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy);

            const ux = dx / len;
            const uy = dy / len;

            const move =
                (p.input.dx || 0) * ux +
                (p.input.dy || 0) * uy;

            p.t += move * SPEED;

            if (p.t < 0) p.t = 0;
            if (p.t > 1) p.t = 1;

            /* JUNCTION TRANSITION */
            if (p.t >= 1) {
                const currentNode = edge.to;
                const options = match.edges.filter(e => e.from === currentNode);

                if (p.input.dx > 0) p.edge = options[0]?.id ?? p.edge;
                if (p.input.dy < 0) p.edge = options[1]?.id ?? p.edge;

                p.t = 0;
            }
        }

        /* BUILD STATE */
        const state = { players: {} };

        for (let id in match.players) {
            const p = match.players[id];
            state.players[id] = getPosition(match, p.edge, p.t);
        }

        /* SEND */
        const msg = JSON.stringify(state);

        match.sockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    });

}, 1000 / 30);

/* =========================
   START SERVER
========================= */

server.listen(80, () => {
    console.log("Server running on http://localhost:80");
});