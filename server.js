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
  70 docker run -d -p 80:80 mygame*/
let players = {};

wss.on("connection", (ws) => {
    const id = Math.random().toString(36).slice(2);
    players[id] = { x: 100, y: 100 };
    ws.id = id;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);
        if (data.type === "input") {
            const p = players[id];
            p.x += data.dx;
            p.y += data.dy;
        }
    });

    ws.on("close", () => {
        delete players[id];
    });
});

// Game loop
setInterval(() => {
    const state = JSON.stringify(players);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(state);
        }
    });
}, 1000 / 30);

const PORT = 80;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
