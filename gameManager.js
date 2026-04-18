const matches = new Map();

/* =========================
   TRACK SETTINGS
========================= */

const TRACK = {
    x: 200,
    y: 100,
    size: 600
};

const PLAYER_SIZE = 30;
const SPEED = 12;

/* =========================
   TRACK FUNCTION
========================= */

function getTrackPoint(t) {
    const s = TRACK.size;
    const p = s * 4;

    t = ((t % p) + p) % p;

    const x = TRACK.x;
    const y = TRACK.y;

    if (t < s) return { x: x + t, y: y };
    t -= s;

    if (t < s) return { x: x + s, y: y + t };
    t -= s;

    if (t < s) return { x: x + s - t, y: y + s };
    t -= s;

    return { x: x, y: y + s - t };
}

/* =========================
   CREATE MATCH
========================= */

function createMatch(roomId) {
    const match = {
        id: roomId,
        players: {},
        sockets: []
    };

    matches.set(roomId, match);

    return {
        addPlayer(ws, color) {
            const startT = Math.random() * TRACK.size * 4;

            match.players[ws.id] = {
                trackT: startT,
                input: { dx: 0 },
                color
            };

            match.sockets.push(ws);

            ws.on("message", (msg) => {
                const data = JSON.parse(msg);

                if (data.type === "input") {
                    const p = match.players[ws.id];
                    if (!p) return;
                    p.input = data;
                }
            });

            ws.on("close", () => {
                delete match.players[ws.id];
                match.sockets = match.sockets.filter(s => s !== ws);
            });
        }
    };
}

/* =========================
   GAME LOOP
========================= */

setInterval(() => {

    matches.forEach((match) => {

        /* MOVE PLAYERS */
        for (let id in match.players) {
            const p = match.players[id];

            if (p.input.dx > 0) p.trackT += SPEED;
            if (p.input.dx < 0) p.trackT -= SPEED;
        }

        /* BUILD STATE */
        const state = { players: {} };

        for (let id in match.players) {
            const p = match.players[id];
            const pos = getTrackPoint(p.trackT);

            state.players[id] = {
                x: pos.x,
                y: pos.y,
                size: PLAYER_SIZE,
                color: p.color
            };
        }

        /* SEND */
        const msg = JSON.stringify(state);

        match.sockets.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(msg);
            }
        });
    });

}, 1000 / 30);

module.exports = {
    createMatch,
    matches
};
