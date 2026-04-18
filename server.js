const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const wss = new WebSocket.Server({ server });

/* =========================
   MATCHMAKING
========================= */

let matchmakingQueue = [];
let matches = new Map();

/* =========================
   CONSTANTS
========================= */

const TRACK = {
    x: 150,
    y: 50,
    width: 900,
    height: 900
};

const PLAYER_SIZE = 30;

/* =========================
   MATCH SETUP
========================= */

function createMatch() {
    return {
        players: {},
        sockets: []
    };
}

/* =========================
   TRACK POSITION
========================= */

function getTrackPoint(t) {
    const w = TRACK.width;
    const h = TRACK.height;

    const perimeter = 2 * (w + h);

    t = ((t % perimeter) + perimeter) % perimeter;

    if (t < w) {
        return { x: TRACK.x + t, y: TRACK.y };
    }
    t -= w;

    if (t < h) {
        return { x: TRACK.x + w, y: TRACK.y + t };
    }
    t -= h;

    if (t < w) {
        return { x: TRACK.x + w - t, y: TRACK.y + h };
    }
    t -= w;

    return { x: TRACK.x, y: TRACK.y + h - t };
}

/* =========================
   MATCHMAKING
========================= */

function tryMatchmake() {
    while (matchmakingQueue.length >= 2) {
        const group = matchmakingQueue.splice(0, 2);

        const roomId = Math.random().toString(36).slice(2);
        const match = createMatch();

        group.forEach((ws, i) => {
            const id = ws.id;

            match.players[id] = {
                trackPos: i * 100,
                input: { dx: 0 }
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

        if (data.type === "join_match") {
            matchmakingQueue.push(ws);
            tryMatchmake();
        }

        if (data.type === "input") {
            const match = matches.get(ws.roomId);
            if (!match) return;

            const p = match.players[ws.id];
            if (!p) return;

            p.input = data
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
   GAME LOOP
========================= */

const SPEED = 12;

setInterval(() => {
    matches.forEach((match) => {

        /* MOVE PLAYERS */
        for (let id in match.players) {
            const p = match.players[id];

            if (p.input.dx > 0) p.trackPos += SPEED;
            if (p.input.dx < 0) p.trackPos -= SPEED;
        }

        /* BUILD STATE */
        const state = {
            players: {}
        };

        for (let id in match.players) {
            state.players[id] = {
                ...getTrackPoint(match.players[id].trackPos),
                size: PLAYER_SIZE
            };
        }

        /* SEND STATE */
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