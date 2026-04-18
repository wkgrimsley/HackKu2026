const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

// Serve static files (React build output)
app.use(express.static(path.join(__dirname, "public")));

// WebSocket server
const wss = new WebSocket.Server({ server });

// -----------------------------
// STATE
// -----------------------------

let matchmakingQueue = [];
let matches = new Map(); // roomId → { players, sockets }

// -----------------------------
// CONNECTION HANDLER
// -----------------------------

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.roomId = null;
    ws.name = null;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        // -----------------------------
        // LOGIN (optional)
        // -----------------------------
        if (data.type === "login") {
            ws.name = data.name;
            console.log(`Player ${ws.id} logged in as ${ws.name}`);
        }

        // -----------------------------
        // JOIN MATCHMAKING
        // -----------------------------
        else if (data.type === "join_match") {
            if (matchmakingQueue.includes(ws)) return;

            matchmakingQueue.push(ws);
            console.log(`Player joined queue. Size: ${matchmakingQueue.length}`);

            tryMatchmake();
        }

        // -----------------------------
        // INPUT HANDLING
        // -----------------------------
        else if (data.type === "input") {
            const roomId = ws.roomId;
            if (!roomId) return;

            const match = matches.get(roomId);
            if (!match) return;

            const player = match.players[ws.id];
            if (!player) return;

            player.x += data.dx;
            player.y += data.dy;
        }
    });

    // -----------------------------
    // DISCONNECT
    // -----------------------------
    ws.on("close", () => {
        matchmakingQueue = matchmakingQueue.filter(p => p !== ws);

        if (ws.roomId) {
            const match = matches.get(ws.roomId);

            if (match) {
                delete match.players[ws.id];
                match.sockets = match.sockets.filter(s => s !== ws);

                if (match.sockets.length === 0) {
                    matches.delete(ws.roomId);
                }
            }
        }
    });
});

// -----------------------------
// MATCHMAKING FUNCTION
// -----------------------------

function tryMatchmake() {
    const PLAYERS_PER_MATCH = 2;

    while (matchmakingQueue.length >= PLAYERS_PER_MATCH) {
        const group = matchmakingQueue.splice(0, PLAYERS_PER_MATCH);

        const roomId = Math.random().toString(36).slice(2);

        const match = {
            players: {},
            sockets: group
        };

        group.forEach((ws, index) => {
            ws.roomId = roomId;

            match.players[ws.id] = {
                x: 100 + index * 60,
                y: 100
            };

            ws.send(JSON.stringify({
                type: "match_found",
                roomId
            }));

            console.log(`Player ${ws.id} assigned to room ${roomId}`);
        });

        matches.set(roomId, match);

        console.log(`Created match ${roomId}`);
    }
}

// -----------------------------
// GAME LOOP
// -----------------------------

setInterval(() => {
    matches.forEach((match) => {
        const state = JSON.stringify(match.players);

        match.sockets.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(state);
            }
        });
    });
}, 1000 / 30);

// -----------------------------
// START SERVER
// -----------------------------

const PORT = 80;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});