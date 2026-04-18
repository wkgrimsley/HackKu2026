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
/*cd client
npm install
npm run build
  62 cd ..
Remove-Item -Recurse -Force .\public\
  67 mkdir public
  68 Copy-Item -Recurse -Force .\dist* ..\public\
  69 docker build -t mygame .
//   70 docker run -d -p 80:80 mygame*/
// let players = {};

// wss.on("connection", (ws) => {
//     const id = Math.random().toString(36).slice(2);
//     players[id] = { x: 100, y: 100 };
//     ws.id = id;

//     ws.on("message", (msg) => {
//         const data = JSON.parse(msg);
//         if (data.type === "input") {
//             const p = players[id];
//             p.x += data.dx;
//             p.y += data.dy;
//         }
//     });

//     ws.on("close", () => {
//         delete players[id];
//     });
// });

// // Game loop
// setInterval(() => {
//     const state = JSON.stringify(players);
//     wss.clients.forEach((client) => {
//         if (client.readyState === WebSocket.OPEN) {
//             client.send(state);
//         }
//     });
// }, 1000 / 30);

const PORT = 80;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// // server/server.js
// const WebSocket = require("ws");

// const wss = new WebSocket.Server({ port: 8080 });

const Matter = require("matter-js");

const { Engine, World, Bodies, Body } = Matter;

const engine = Engine.create();
// disable gravity
engine.world.gravity.x = 0;
engine.world.gravity.y = 0;
engine.world.gravity.scale = 0;

const world = engine.world;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
// const walls = [
//     // top
//     Bodies.rectangle(WORLD_WIDTH / 2, -10, WORLD_WIDTH, 20, { isStatic: true }),

//     // bottom
//     Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT + 10, WORLD_WIDTH, 20, { isStatic: true }),

//     // left
//     Bodies.rectangle(-10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, { isStatic: true }),

//     // right
//     Bodies.rectangle(WORLD_WIDTH + 10, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, { isStatic: true }),
// ];

// World.add(world, walls);
let players = {};

wss.on("connection", (ws) => {
    const id = Math.random().toString(36).slice(2);

    const body = Bodies.rectangle(100, 100, 20, 20, {
        frictionAir: 0.2
    });
    World.add(world, body);

    players[id] = {
        body,
        input: { dx: 0, dy: 0 }
    };

    ws.id = id;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.type === "input") {
            players[id].input = data; 
        }
    });

    ws.on("close", () => {
        World.remove(world, players[id].body);
        delete players[id];
    });
});


setInterval(() => {

    // inputs
    for (let id in players) {
        const p = players[id];

        const force = {
            x: (p.input.dx || 0) * 0.002,
            y: (p.input.dy || 0) * 0.002
        };

        Body.applyForce(p.body, p.body.position, force);
    }

    // progress engine
    Engine.update(engine, 1000 / 30);

    // state to send to client
    const state = {};

    for (let id in players) {
        const pos = players[id].body.position;

        state[id] = {
            x: pos.x,
            y: pos.y
        };
    }

    // send
    const msg = JSON.stringify(state);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });

}, 1000 / 30);

console.log("Server running on ws://localhost:8080");