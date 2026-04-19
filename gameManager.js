const Matter = require("matter-js");

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

const BULLET_SPEED = 6;
const SPAWN_INVULNERABILITY_MS = 300; // 🔥 0.3s grace period

const matches = new Map();

/* =========================
   TRACK FUNCTION
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
   DESTROY PROJECTILE
========================= */

function destroyProjectile(match, body) {
    const id = body.plugin?.id;

    if (id !== undefined && match.projectiles.has(id)) {
        match.projectiles.delete(id);
    }

    Matter.World.remove(match.engine.world, body);
}

/* =========================
   COLLISION HANDLER
========================= */

function handleCollision(match, a, b) {
    if (!a.plugin || !match.projectiles.has(a.plugin.id)) return;

    const projectile = a;
    const other = b;

    // 🔥 SPAWN PROTECTION (ignore collisions for first 0.3s)
    if (Date.now() - projectile.plugin.createdAt < SPAWN_INVULNERABILITY_MS) {
        return;
    }

    // WALL → bounce
    if (other.label === "wall") {
        projectile.plugin.bounces += 1;

        if (projectile.plugin.bounces >= 7) {
            destroyProjectile(match, projectile);
        }

        return;
    }

    // PLAYER → destroy
    if (other.label === "player") {
        destroyProjectile(match, projectile);
    }
}

/* =========================
   TRACK WALLS
========================= */

function createTrackWalls(engine) {
    const s = TRACK.size;
    const x = TRACK.x;
    const y = TRACK.y;
    const t = 20;

    const walls = [
        Matter.Bodies.rectangle(x + s / 2, y - t / 2, s, t, {
            isStatic: true,
            restitution: 1,
            label: "wall"
        }),

        Matter.Bodies.rectangle(x + s + t / 2, y + s / 2, t, s, {
            isStatic: true,
            restitution: 1,
            label: "wall"
        }),

        Matter.Bodies.rectangle(x + s / 2, y + s + t / 2, s, t, {
            isStatic: true,
            restitution: 1,
            label: "wall"
        }),

        Matter.Bodies.rectangle(x - t / 2, y + s / 2, t, s, {
            isStatic: true,
            restitution: 1,
            label: "wall"
        })
    ];

    Matter.World.add(engine.world, walls);
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
        x: v.x * BULLET_SPEED,
        y: v.y * BULLET_SPEED
    });

    // 🔥 spawn slightly forward so it leaves player cleanly
    const spawnOffset = 40;
    Matter.Body.setPosition(body, {
        x: x + v.x * spawnOffset,
        y: y + v.y * spawnOffset
    });

    body.plugin = {
        id,
        owner,
        bounces: 0,
        createdAt: Date.now() // 🔥 NEW
    };

    match.projectiles.set(id, body);
    Matter.World.add(match.engine.world, body);
}

/* =========================
   CREATE MATCH
========================= */

function createMatch() {
    const roomId = Math.random().toString(36).slice(2);

    const engine = Matter.Engine.create();
    engine.world.gravity.y = 0;

    createTrackWalls(engine);

    const match = {
        id: roomId,
        players: {},
        sockets: [],
        engine,
        projectiles: new Map(),
        projectileId: 0
    };

    Matter.Events.on(engine, "collisionStart", (event) => {
        for (const pair of event.pairs) {
            handleCollision(match, pair.bodyA, pair.bodyB);
            handleCollision(match, pair.bodyB, pair.bodyA);
        }
    });

    matches.set(roomId, match);

    return {
        addPlayer(ws, color) {
            const startT = Math.random() * TRACK.size * 4;

            const body = Matter.Bodies.circle(0, 0, PLAYER_SIZE, {
                isStatic: true,
                label: "player"
            });

            match.players[ws.id] = {
                trackPos: startT,
                input: { dx: 0, mouse: {} },
                color,
                body
            };

            Matter.World.add(match.engine.world, body);
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
                const p = match.players[ws.id];

                if (p?.body) {
                    Matter.World.remove(match.engine.world, p.body);
                }

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
        Matter.Engine.update(match.engine, 1000 / 30);

        for (let id in match.players) {
            const p = match.players[id];

            if (!p.input) p.input = { dx: 0, mouse: {} };
            if (!p.input.mouse) p.input.mouse = { isDown: false };

            // movement
            if (p.input.dx > 0) p.trackPos += SPEED;
            if (p.input.dx < 0) p.trackPos -= SPEED;

            const pos = getTrackPoint(p.trackPos);
            Matter.Body.setPosition(p.body, pos);

            // shooting
            const mouse = p.input.mouse;

            if (mouse.isDown) {
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

            state.players[id] = {
                x: p.body.position.x,
                y: p.body.position.y,
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