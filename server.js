const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const { handleConnection } = require("./matchmaking");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    handleConnection(ws);
});

server.listen(80, () => {
    console.log("Server running on http://localhost:80");
});