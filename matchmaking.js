const { createMatch } = require("./gameManager");

let matchmakingQueue = [];
let matches = new Map();

/* =========================
   HANDLE CONNECTION
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
}

/* =========================
   MATCHMAKING LOGIC
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

/* expose matches ONLY if gameManager needs it */
module.exports = {
    handleConnection,
    matches
};