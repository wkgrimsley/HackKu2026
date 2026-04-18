const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const Matter = require("matter-js");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const wss = new WebSocket.Server({ server });

// ----------------------
// GLOBAL STATE
// ----------------------
let matchmakingQueue = [];
let matches = new Map();

// ----------------------
// CREATE NEW MATCH
// ----------------------
function createMatch() {
    const { Engine, World, Bodies } = Matter;

    // 1. create engine first
    const engine = Engine.create();

    // 2. configure gravity
    engine.world.gravity.x = 0;
    engine.world.gravity.y = 0;
    engine.world.gravity.scale = 0;

    const world = engine.world;

    const WORLD_WIDTH = 2000;
    const WORLD_HEIGHT = 2000;

    // 3. create walls AFTER world exists
    const walls = [
        Bodies.rectangle(WORLD_WIDTH / 2, -10, WORLD_WIDTH, 20, { isStatic: true }),
        Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT + 10, WORLD_WIDTH, 20, { isStatic: true }),
        Bodies.rectangle(-10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, { isStatic: true }),
        Bodies.rectangle(WORLD_WIDTH + 10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, { isStatic: true }),
    ];

    // 4. add walls to world
    World.add(world, walls);

    return {
        engine,
        world,
        players: {},
        sockets: [],
        lastUpdate: Date.now()
    };
}

// ----------------------
// MATCHMAKING
// ----------------------
function tryMatchmake() {
    const PLAYERS_PER_MATCH = 2;

    while (matchmakingQueue.length >= PLAYERS_PER_MATCH) {
        const group = matchmakingQueue.splice(0, PLAYERS_PER_MATCH);

        const roomId = Math.random().toString(36).slice(2);
        const match = createMatch();

        group.forEach((ws, index) => {
            const id = ws.id;

            const body = Matter.Bodies.rectangle(
                100 + index * 50,
                100,
                20,
                20,
                { frictionAir: 0.2 }
            );

            Matter.World.add(match.world, body);

            match.players[id] = {
                body,
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
        console.log(`Match created: ${roomId}`);
    }
}

// ----------------------
// CONNECTIONS
// ----------------------
wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.roomId = null;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        // JOIN QUEUE
        if (data.type === "join_match") {
            matchmakingQueue.push(ws);
            tryMatchmake();
        }

        // INPUT
        if (data.type === "input") {
            const match = matches.get(ws.roomId);
            if (!match) return;

            const player = match.players[ws.id];
            if (!player) return;

            player.input = data;
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

// ----------------------
// GAME LOOP (PER MATCH)
// ----------------------
setInterval(() => {
    matches.forEach((match, roomId) => {

        // apply inputs
        for (let id in match.players) {
            const p = match.players[id];

            const force = {
                x: (p.input.dx || 0) * 0.002,
                y: (p.input.dy || 0) * 0.002
            };

            Matter.Body.applyForce(p.body, p.body.position, force);
        }

        // update physics
        Matter.Engine.update(match.engine, 1000 / 60);

        // build state
        const state = {};

        for (let id in match.players) {
            const pos = match.players[id].body.position;

            state[id] = {
                x: pos.x,
                y: pos.y
            };
        }

        // send only to this match
        const msg = JSON.stringify(state);

        match.sockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    });

}, 1000 / 60);

// ----------------------
server.listen(80, "0.0.0.0", () => {
    console.log("Server running on http://localhost:80");
});