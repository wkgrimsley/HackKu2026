const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const Matter = require("matter-js");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const wss = new WebSocket.Server({ server });

/* =========================
   MATCHMAKING STATE
========================= */

let matchmakingQueue = [];
let matches = new Map();

/* =========================
   CREATE MATCH
========================= */

function createMatch() {
    const { Engine, World, Bodies } = Matter;

    const engine = Engine.create();

    engine.world.gravity.x = 0;
    engine.world.gravity.y = 0;
    engine.world.gravity.scale = 0;

    const world = engine.world;

    const WORLD_WIDTH = 2000;
    const WORLD_HEIGHT = 2000;

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

    const walls = [
        Bodies.rectangle(WORLD_WIDTH / 2, -10, WORLD_WIDTH, 20, { isStatic: true }),
        Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT + 10, WORLD_WIDTH, 20, { isStatic: true }),
        Bodies.rectangle(-10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, { isStatic: true }),
        Bodies.rectangle(WORLD_WIDTH + 10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, { isStatic: true }),
    ];

    World.add(world, walls);

    return {
        engine,
        world,
        nodes,
        edges,
        players: {},
        projectiles: {},
        sockets: []
    };
}

/* =========================
   MATCHMAKING
========================= */

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
                edge: 0,
                t: 0,
                input: { dx: 0, dy: 0, shoot: false }
            };

            match.sockets.push(ws);
            ws.roomId = roomId;

            ws.send(JSON.stringify({
                type: "match_found",
                roomId
            }));
        });

        matches.set(roomId, match);
    }
}

/* =========================
   GRAPH HELPERS
========================= */

function getPosition(match, edgeId, t) {
    const edge = match.edges.find(e => e.id === edgeId);
    const a = match.nodes[edge.from];
    const b = match.nodes[edge.to];

    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

/* =========================
   SHOOT
========================= */

function shoot(match, playerId) {
    const p = match.players[playerId];
    if (!p) return;

    const pos = getPosition(match, p.edge, p.t);

    const id = Math.random().toString(36).slice(2);

    match.projectiles[id] = {
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: -8,
        owner: playerId
    };
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

            const player = match.players[ws.id];
            if (!player) return;

            player.input = data;

            if (data.shoot) {
                shoot(match, ws.id);
            }
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

setInterval(() => {

    matches.forEach((match) => {

        /* PLAYERS MOVE */
        for (let id in match.players) {
            const p = match.players[id];

            p.t += 0.015;

            if (p.t >= 1) {
                const currentNode = match.edges.find(e => e.id === p.edge).to;
                const options = match.edges.filter(e => e.from === currentNode);

                if (p.input.dx > 0) p.edge = options[0]?.id ?? p.edge;
                if (p.input.dy < 0) p.edge = options[1]?.id ?? p.edge;

                p.t = 0;
            }
        }

        /* PROJECTILES */
        for (let id in match.projectiles) {
            const pr = match.projectiles[id];

            pr.x += pr.vx;
            pr.y += pr.vy;

            if (pr.x < -1000 || pr.x > 2000 || pr.y < -1000 || pr.y > 2000) {
                delete match.projectiles[id];
            }
        }

        /* COLLISIONS */
        for (let pid in match.players) {
            const p = match.players[pid];
            const pos = getPosition(match, p.edge, p.t);

            for (let prId in match.projectiles) {
                const pr = match.projectiles[prId];

                const dx = pr.x - pos.x;
                const dy = pr.y - pos.y;

                if (Math.hypot(dx, dy) < 15) {
                    if (pr.owner !== pid) {
                        delete match.projectiles[prId];
                        console.log("HIT:", pid);
                    }
                }
            }
        }

        /* BUILD STATE */
        const state = {
            players: {},
            projectiles: match.projectiles
        };

        for (let id in match.players) {
            state.players[id] = getPosition(
                match,
                match.players[id].edge,
                match.players[id].t
            );
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

server.listen(80, "0.0.0.0", () => {
    console.log("Server running on http://localhost:80");
});