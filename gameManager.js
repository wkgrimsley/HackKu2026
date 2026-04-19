const Matter = require("matter-js");

/* =========================
   ARENA SETTINGS
========================= */

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;

const TRACK = {
    x: 200,
    y: 100,
    size: 600
};

const PLAYER_SIZE = 30;
const SPEED = 12;

const BULLET_SPEED = 6;
const SPAWN_INVULNERABILITY_MS = 300;

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
   VECTOR
========================= */

function getNormalized(x, y, dx, dy) {
    const vx = dx - x;
    const vy = dy - y;

    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag === 0) return { x: 0, y: 0 };

    return { x: vx / mag, y: vy / mag };
}

/* =========================
   SPARKS
========================= */

function spawnSparks(match, x, y) {
    for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;

        match.sparks.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1
        });
    }
}

/* =========================
   WALLS
========================= */

function createOuterWalls(engine) {
    const t = 50;

    const walls = [
        Matter.Bodies.rectangle(CANVAS_WIDTH / 2, -t / 2, CANVAS_WIDTH, t, { isStatic: true, restitution: 1, label: "wall" }),
        Matter.Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT + t / 2, CANVAS_WIDTH, t, { isStatic: true, restitution: 1, label: "wall" }),
        Matter.Bodies.rectangle(-t / 2, CANVAS_HEIGHT / 2, t, CANVAS_HEIGHT, { isStatic: true, restitution: 1, label: "wall" }),
        Matter.Bodies.rectangle(CANVAS_WIDTH + t / 2, CANVAS_HEIGHT / 2, t, CANVAS_HEIGHT, { isStatic: true, restitution: 1, label: "wall" })
    ];

    walls.forEach(w => w.plugin = { flash: 0 });

    Matter.World.add(engine.world, walls);
    return walls;
}

/* =========================
   PROJECTILES
========================= */

function destroyProjectile(match, body) {
    const id = body.plugin?.id;
    if (id !== undefined) match.projectiles.delete(id);
    Matter.World.remove(match.engine.world, body);
}

/* =========================
   BURST SHOOT
========================= */

function shootBurst(match, x, y, dx, dy, owner) {
    const spread = 0.15;
    const base = getNormalized(x, y, dx, dy);

    for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(base.y, base.x) + i * spread;

        const vx = Math.cos(angle) * BULLET_SPEED;
        const vy = Math.sin(angle) * BULLET_SPEED;

        const id = match.projectileId++;

        const body = Matter.Bodies.circle(x, y, 5, {
            label: "projectile",
            friction: 0,
            frictionAir: 0,
            restitution: 1
        });

        Matter.Body.setVelocity(body, { x: vx, y: vy });

        Matter.Body.setPosition(body, {
            x: x + Math.cos(angle) * 40,
            y: y + Math.sin(angle) * 40
        });

        body.plugin = {
            id,
            owner,
            bounces: 0,
            createdAt: Date.now()
        };

        match.projectiles.set(id, body);
        Matter.World.add(match.engine.world, body);
    }
}

/* =========================
   COLLISION
========================= */

function handleCollision(match, a, b) {
    if (!a.plugin || !match.projectiles.has(a.plugin.id)) return;

    const projectile = a;
    const other = b;

    if (Date.now() - projectile.plugin.createdAt < SPAWN_INVULNERABILITY_MS) return;

    if (other.label === "wall") {
        projectile.plugin.bounces++;
        other.plugin.flash = Date.now();
        spawnSparks(match, projectile.position.x, projectile.position.y);

        if (projectile.plugin.bounces >= 7) {
            destroyProjectile(match, projectile);
        }
        return;
    }

    if (other.label === "player") {
        for (let id in match.players) {
            const p = match.players[id];

            if (p.body === other) {
                p.health -= 1;

                destroyProjectile(match, projectile);

                if (p.health <= 0) {
                    Matter.World.remove(match.engine.world, p.body);
                    delete match.players[id];

                    const remaining = Object.keys(match.players);

                    if (remaining.length === 1) {
                        match.running = false;
                        match.winner = remaining[0];
                    } else if (remaining.length === 0) {
                        match.running = false;
                        match.winner = null;
                    }
                }
                break;
            }
        }
    }
}

/* =========================
   CREATE MATCH
========================= */

function createMatch() {
    const id = Math.random().toString(36).slice(2);

    const engine = Matter.Engine.create();
    engine.world.gravity.y = 0;

    const walls = createOuterWalls(engine);

    const match = {
        id,
        players: {},
        sockets: [],
        engine,
        walls,
        projectiles: new Map(),
        projectileId: 0,
        sparks: [],
        running: true,
        winner: null
    };

    Matter.Events.on(engine, "collisionStart", (event) => {
        for (const pair of event.pairs) {
            handleCollision(match, pair.bodyA, pair.bodyB);
            handleCollision(match, pair.bodyB, pair.bodyA);
        }
    });

    matches.set(id, match);

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
                health: 25,
                body,
                lastShot: 0
            };

            Matter.World.add(engine.world, body);
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
                if (p?.body) Matter.World.remove(engine.world, p.body);

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

        // ❄️ FREEZE MATCH END
        if (!match.running) {
            const state = {
                type: "match_end",
                winner: match.winner,
                sparks: match.sparks
            };

            const msg = JSON.stringify(state);

            match.sockets.forEach(ws => {
                if (ws.readyState === 1) ws.send(msg);
            });

            return;
        }

        Matter.Engine.update(match.engine, 1000 / 30);

        match.sparks.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vx *= 0.95;
            s.vy *= 0.95;
            s.life -= 0.05;
        });

        match.sparks = match.sparks.filter(s => s.life > 0);

        for (let id in match.players) {
            const p = match.players[id];

            if (p.input.dx > 0) p.trackPos += SPEED;
            if (p.input.dx < 0) p.trackPos -= SPEED;

            const pos = getTrackPoint(p.trackPos);
            Matter.Body.setPosition(p.body, pos);

            const m = p.input.mouse;

            if (m?.isDown) {
                const now = Date.now();

                if (now - p.lastShot >= 1000) {
                    p.lastShot = now;
                    shootBurst(match, pos.x, pos.y, m.x, m.y, id);
                }
            }
        }

        const state = {
            players: {},
            projectiles: [],
            walls: [],
            sparks: match.sparks,
            running: match.running,
            winner: match.winner
        };

        for (let id in match.players) {
            const p = match.players[id];
            state.players[id] = {
                x: p.body.position.x,
                y: p.body.position.y,
                size: PLAYER_SIZE,
                color: p.color,
                health: p.health
            };
        }

        for (const [id, body] of match.projectiles) {
            state.projectiles.push({
                id,
                x: body.position.x,
                y: body.position.y
            });
        }

        for (const w of match.walls) {
            state.walls.push({
                x: w.position.x,
                y: w.position.y,
                width: w.bounds.max.x - w.bounds.min.x,
                height: w.bounds.max.y - w.bounds.min.y,
                flash: w.plugin.flash
            });
        }

        const msg = JSON.stringify(state);

        match.sockets.forEach(ws => {
            if (ws.readyState === 1) ws.send(msg);
        });

    });
}, 1000 / 30);

module.exports = {
    createMatch,
    matches
};