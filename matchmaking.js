const { createMatch } = require("./gameManager");

let matchmakingQueue = [];

/* =========================
   CONNECTION HANDLER
========================= */

function handleConnection(ws) {
    ws.id = Math.random().toString(36).slice(2);
    ws.roomId = null;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.type === "join_match") {
            matchmakingQueue.push(ws);
            tryMatchmake();
        }
    });

    ws.on("close", () => {
        matchmakingQueue = matchmakingQueue.filter(p => p !== ws);
    });
}

/* =========================
   MATCHMAKING
========================= */

function tryMatchmake() {
    const PLAYERS_PER_MATCH = 2;

    while (matchmakingQueue.length >= PLAYERS_PER_MATCH) {
        const group = matchmakingQueue.splice(0, PLAYERS_PER_MATCH);

        const roomId = Math.random().toString(36).slice(2);

        const match = createMatch(roomId);

        group.forEach((ws, index) => {
            ws.roomId = roomId;

            match.addPlayer(ws, index === 0 ? "blue" : "red");

            ws.send(JSON.stringify({
                type: "match_found",
                roomId
            }));
        });
    }
}

module.exports = {
    handleConnection
};