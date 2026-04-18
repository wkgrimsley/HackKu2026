const Matter = require("matter-js");

/* =========================
   GAME CONSTANTS
========================= */

const SPEED = 12;
const PLAYER_SIZE = 30;
const PROJECTILE_RADIUS = 5;
const PROJECTILE_SPEED = 10;

/* =========================
   MATCH STORAGE
========================= */

const matches = new Map();

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
   TRACK SYSTEM (UNCHANGED)
========================= */

const TRACK = {
    x: 150,
    y: 50,
    width: 900,
    height: 900
};

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
   SHOOT PROJECTILE
========================= */

function shootProjectile(match, socket, { x, y, angle }) {
    const id = match.projectileId++;

    const body = Matter.Bodies.circle(x, y, PROJECTILE_RADIUS, {
        label: "projectile",
        friction: 0,
        frictionAir: 0,
        restitution: 1
    });

    Matter.Body.setVelocity(body, {
        x: Math.cos(angle) * PROJECTILE_SPEED,
        y: Math.sin(angle) * PROJECTILE_SPEED
    });

    body.plugin = {
        id,
        playerId: socket.id
    };

    match.projectiles.set(id, body);
    Matter.World.add(match.engine.world, body);
}

/* =========================
   SOCKET EVENTS (example)
========================= */

function onShoot(socket, data) {
    const match = socket.match;
    shootProjectile(match, socket, data);
}

/* =========================
   COLLISION (PROJECTILE → PLAYER)
========================= */

Matter.Events.on(Matter.Engine.create().events?.collisionStart || {}, () => {
    // (we attach properly inside loop below per engine)
});

/* Proper collision setup per match */
function setupCollisions(match) {
    Matter.Events.on(match.engine, "collisionStart", (event) => {
        for (const pair of event.pairs) {
            const a = pair.bodyA;
            const b = pair.bodyB;

            const aProj = a.label === "projectile";
            const bProj = b.label === "projectile";

            if (!aProj && !bProj) continue;

            const projectile = aProj ? a : b;
            const id = projectile.plugin?.id;

            if (id === undefined) continue;

            if (match.projectiles.has(id)) {
                Matter.World.remove(match.engine.world, projectile);
                match.projectiles.delete(id);
            }
        }
    });
}

/* =========================
   MAIN GAME LOOP
========================= */

setInterval(() => {

    matches.forEach((match) => {

        Matter.Engine.update(match.engine, 1000 / 30);

        /* =========================
           MOVE PLAYERS (UNCHANGED)
        ========================= */

        for (let id in match.players) {
            const p = match.players[id];

            if (!p.input) p.input = { dx: 0 };

            if (p.input.dx > 0) p.trackPos += SPEED;
            if (p.input.dx < 0) p.trackPos -= SPEED;
        }

        /* =========================
           PLAYER STATE
        ========================= */

        const statePlayers = {};

        for (let id in match.players) {
            statePlayers[id] = {
                ...getTrackPoint(match.players[id].trackPos),
                size: PLAYER_SIZE
            };
        }

        /* =========================
           PROJECTILE ARRAY (IMPORTANT PART)
        ========================= */

        const projectileArray = [];

        for (const [id, body] of match.projectiles) {
            projectileArray.push({
                id,
                x: body.position.x,
                y: body.position.y
            });
        }

        /* =========================
           SEND TO CLIENT
        ========================= */

        const state = {
            players: statePlayers,
            projectiles: projectileArray
        };

        const msg = JSON.stringify(state);

        match.sockets.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(msg);
            }
        });

    });

}, 1000 / 30);

/* =========================
   EXPORTS
========================= */

module.exports = {
    createMatch,
    matches,
    shootProjectile,
    onShoot,
    setupCollisions
};