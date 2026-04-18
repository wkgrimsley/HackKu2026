const { onShoot } = require("./friendsurely");

const TRACK = {
    x: 150,
    y: 50,
    width: 900,
    height: 900
};

const PLAYER_SIZE = 30;

/* =========================
   MATCH STORAGE
========================= */

const matches = new Map();

function getNormalized(x, y, dx, dy) {
    const vx = dx - x;
    const vy = dy - y;

    const mag = Math.sqrt(vx * vx + vy * vy);

    if (mag === 0) return { x: 0, y: 0 };

    return {
        x: vx / mag,
        y: vy / mag
    };
}

function shootProjectile(match, x, y, dx, dy, owner ) {
    const id = match.projectileId++;

    const body = Matter.Bodies.circle(x, y, PROJECTILE_RADIUS, {
        label: "projectile",
        friction: 0,
        frictionAir: 0,
        restitution: 1
    });

    let vector = getNormalized(x, y, dx, dy);
    Matter.Body.setVelocity(body, {
        x: vector.x * PROJECTILE_SPEED,
        y: vector.y * PROJECTILE_SPEED
    });


    match.projectiles.set(id, body);
    Matter.World.add(match.engine.world, body);
}

/* =========================
   SOCKET EVENTS (example)
========================= */

/* =========================
   CREATE MATCH
========================= */

function createMatch() {
    const id = Math.random().toString(36).slice(2);
    
    const engine = Matter.Engine.create();
    engine.world.gravity.y = 0;

    const match = {
        id,
        players: {},
        sockets: [],
        engine,
        projectiles: new Map(),
        projectileId: 0
    };

    matches.set(id, match);

    return match;
}

/* =========================
   TRACK POSITION
========================= */

function getTrackPoint(t) {
    const w = TRACK.width;
    const h = TRACK.height;

    const perimeter = 2 * (w + h);

    t = ((t % perimeter) + perimeter) % perimeter;

    if (t < w) return { x: TRACK.x + t, y: TRACK.y };
    t -= w;

    if (t < h) return { x: TRACK.x + w, y: TRACK.y + t };
    t -= h;

    if (t < w) return { x: TRACK.x + w - t, y: TRACK.y + h };
    t -= w;

    return { x: TRACK.x, y: TRACK.y + h - t };
}

/* =========================
   GAME LOOP
========================= */

const SPEED = 12;

setInterval(() => {

    matches.forEach((match) => {

        /* MOVE PLAYERS */
        for (let id in match.players) {
            const p = match.players[id];

            if (!p.input) p.input = { dx: 0 };

            if (p.input.dx > 0) p.trackPos += SPEED;
            if (p.input.dx < 0) p.trackPos -= SPEED;

            if (p.input.mouse.isDown) {
                points = getTrackPoint(match.players[id].trackPos);
                shootProjectile(match, points.x, points.y, p.input.mouse.x, p.input.mouse.y, id);
            };
        }

        /* BUILD STATE */
        const state = { players: {} };

        for (let id in match.players) {
            state.players[id] = {
                ...getTrackPoint(match.players[id].trackPos),
                size: PLAYER_SIZE
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