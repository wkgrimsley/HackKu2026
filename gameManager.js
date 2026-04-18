const Matter = require("matter-js");

/* =========================
   `TRAC`K SETTINGS
========================= */

const TRACK = {
    x: 200,
    y: 100,
    size: 600
};

const PLAYER_SIZE = 30;
const SPEED = 12;

const matches = new Map();

/* =========================
   TRACK FUNCTION (FIXED)
========================= */

function getTrackPoint(t) {
    const s = TRACK.size;
    const perimeter = s * 4;

    t = ((t % perimeter) + perimeter) % perimeter;

    if (t < s) return { x: TRACK.x + t, y: TRACK.y };
    t -= s;

    if (t < s) return { x: TRACK.x + s, y: TRACK.y + t };
    t -= s;

    if (t < s) return { x: TRACK.x + s - t, y: TRACK.y + s };
    t -= s;

    return { x: TRACK.x, y: TRACK.y + s - t };
}

/* =========================
   NORMALIZE VECTOR
========================= */

function getNormalized(x, y, dx, dy) {
    const vx = dx - x;
    const vy = dy - y;

    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag === 0) return { x: 0, y: 0 };
   
    return { x: vx / mag, y: vy / mag };
}

/* =========================
   PROJECTILES
========================= */

function shootProjectile(match, x, y, dx, dy, owner) {
    const id = match.projectileId++;

    const body = Matter.Bodies.circle(x, y, 5, {
        label: "projectile",
        friction: 0,
        frictionAir: 0,
        restitution: 1
    });

    const v = getNormalized(x, y, dx, dy);

    Matter.Body.setVelocity(body, {
        x: (v.x) * 10,
        y: (v.y) * 10
    });

    match.projectiles.set(id, body);
    Matter.World.add(match.engine.world, body);

}

/* =========================
   CREATE MATCH (FIXED SPAWN VARS)
========================= */

function createMatch() {
    const roomId = Math.random().toString(36).slice(2);

    const tempengine = Matter.Engine.create();

    tempengine.world.gravity.y = 0;

    const match = {
        id: roomId,
        players: {},
        sockets: [],
        engine: tempengine,
        projectiles: new Map(),
        projectileId: 0
    };

    matches.set(roomId, match);

    return {
        addPlayer(ws, color) {
            const startT = Math.random() * TRACK.size * 4;

            match.players[ws.id] = {
                trackPos: startT,          // ✅ unified name
                input: { dx: 0, mouse: {} },
                color
            };

            match.sockets.push(ws);

            ws.on("message", (msg) => {
                const data = JSON.parse(msg);

                if (data.type === "input") {
                    const p = match.players[ws.id];
                    if (!p) return;

                    p.input = {
                        dx: data.dx || 0,
                        mouse: data.mouse || { x: 0, y: 0, isDown: false }
                    };
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
   GAME LOOP (FIXED STATE CONSISTENCY)
========================= */

setInterval(() => {

    matches.forEach((match) => {
        Matter.Engine.update(match.engine, 1000/30);
        for (let id in match.players) {
            const p = match.players[id];

            if (!p.input) p.input = { dx: 0, mouse: {} };
            if (!p.input.mouse) p.input.mouse = { isDown: false };

            // movement
            if (p.input.dx > 0) p.trackPos += SPEED;
            if (p.input.dx < 0) p.trackPos -= SPEED;

            // shooting
            const mouse = p.input.mouse;

            if (mouse.isDown) {
                const pos = getTrackPoint(p.trackPos);
                console.log("pos: ", pos);
                shootProjectile(
                    match,
                    pos.x,
                    pos.y,
                    mouse.x || pos.x,
                    mouse.y || pos.y,
                    id
                );
            }
        }

        /* build state */
        const state = { players: {}, projectiles: [] };

        for (let id in match.players) {
            const p = match.players[id];
            const pos = getTrackPoint(p.trackPos);

            state.players[id] = {
                x: pos.x,
                y: pos.y,
                size: PLAYER_SIZE,
                color: p.color
            };
        }

        for (const [id, body] of match.projectiles) {
            state.projectiles.push({
                id,
                x: body.position.x,
                y: body.position.y
            });
        }

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