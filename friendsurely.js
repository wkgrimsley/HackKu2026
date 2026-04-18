import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GameEngine } from "react-native-game-engine";
import Matter from "matter-js";

/* =========================
   GRAPH (SOURCE OF TRUTH)
========================= */

const nodes = {
  A: { x: 50, y: 200 },
  B: { x: 300, y: 200 }, // intersection
  C: { x: 550, y: 200 },
  D: { x: 300, y: 50 }
};

const edges = [
  { id: 0, from: "A", to: "B" },
  { id: 1, from: "B", to: "C" },
  { id: 2, from: "B", to: "D" }
];

/* =========================
   MATTER SETUP (PROJECTILES)
========================= */

const engine = Matter.Engine.create();
const world = engine.world;

/* =========================
   HELPERS
========================= */

function getPosition(edgeId, t) {
  const edge = edges.find(e => e.id === edgeId);
  const a = nodes[edge.from];
  const b = nodes[edge.to];

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function getDirection(edgeId) {
  const edge = edges.find(e => e.id === edgeId);
  const a = nodes[edge.from];
  const b = nodes[edge.to];

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  return { x: dx / len, y: dy / len };
}

function getOptions(nodeId) {
  return edges.filter(e => e.from === nodeId);
}

function chooseEdge(nodeId, input) {
  const options = getOptions(nodeId);

  if (input === "UP")
    return options.find(e => nodes[e.to].y < nodes[nodeId].y);

  if (input === "DOWN")
    return options.find(e => nodes[e.to].y > nodes[nodeId].y);

  if (input === "LEFT")
    return options.find(e => nodes[e.to].x < nodes[nodeId].x);

  if (input === "RIGHT")
    return options.find(e => nodes[e.to].x > nodes[nodeId].x);

  return options[0];
}

/* =========================
   WALLS (shared geometry)
========================= */

function createWall(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const length = Math.hypot(dx, dy);

  return Matter.Bodies.rectangle(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    length + 4,
    12,
    {
      isStatic: true,
      restitution: 1
    }
  );
}

const walls = edges.map(e =>
  createWall(nodes[e.from], nodes[e.to])
);

Matter.World.add(world, walls);

/* =========================
   SHOOT PROJECTILE
========================= */

function shoot(player, entities) {
  const pos = getPosition(player.edge, player.t);
  const dir = getDirection(player.edge);

  const bullet = Matter.Bodies.circle(pos.x, pos.y, 5, {
    frictionAir: 0,
    friction: 0,
    restitution: 1
  });

  Matter.Body.setVelocity(bullet, {
    x: dir.x * 9,
    y: dir.y * 9
  });

  Matter.World.add(world, bullet);

  entities.projectiles.push({
    body: bullet,
    x: pos.x,
    y: pos.y,
    renderer: <View style={{
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "red"
    }} />
  });
}

/* =========================
   PLAYER SYSTEM (NO PHYSICS)
========================= */

const MovePlayer = (entities, { input }) => {
  const player = entities.player;

  let dir = null;
  let shootPressed = false;

  input.forEach(i => {
    if (i.type === "move") dir = i.direction;
    if (i.type === "shoot") shootPressed = true;
  });

  player.t += 0.015;

  if (player.t >= 1) {
    const currentNode = edges.find(e => e.id === player.edge).to;

    const next = chooseEdge(currentNode, dir);

    if (next) {
      player.edge = next.id;
      player.t = 0;
    } else {
      player.t = 1;
    }
  }

  const pos = getPosition(player.edge, player.t);
  player.x = pos.x;
  player.y = pos.y;

  if (shootPressed) {
    shoot(player, entities);
  }

  return entities;
};

/* =========================
   PHYSICS SYSTEM (PROJECTILES ONLY)
========================= */

const Physics = (entities) => {
  Matter.Engine.update(engine, 1000 / 60);

  entities.projectiles.forEach(p => {
    p.x = p.body.position.x;
    p.y = p.body.position.y;
  });

  return entities;
};

/* =========================
   RENDER COMPONENTS
========================= */

const Player = ({ x, y }) => (
  <View style={{
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "blue",
    left: x - 10,
    top: y - 10
  }} />
);

const Line = ({ from, to }) => (
  <View style={{
    position: "absolute",
    left: from.x,
    top: from.y,
    width: Math.hypot(to.x - from.x, to.y - from.y),
    height: 2,
    backgroundColor: "black",
    transform: [{
      rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad`
    }]
  }} />
);

/* =========================
   GAME
========================= */

export default function Game() {
  const [engineRef, setEngineRef] = useState(null);

  const entities = {
    player: {
      edge: 0,
      t: 0,
      x: nodes.A.x,
      y: nodes.A.y,
      renderer: <Player />
    },
    projectiles: []
  };

  edges.forEach((e, i) => {
    entities["line" + i] = {
      from: nodes[e.from],
      to: nodes[e.to],
      renderer: <Line />
    };
  });

  useEffect(() => {
    const handleKey = (e) => {
      if (!engineRef) return;

      let move = null;

      if (e.key === "ArrowUp") move = "UP";
      if (e.key === "ArrowDown") move = "DOWN";
      if (e.key === "ArrowLeft") move = "LEFT";
      if (e.key === "ArrowRight") move = "RIGHT";

      if (move) {
        engineRef.dispatch({ type: "move", direction: move });
      }

      if (e.key === " ") {
        engineRef.dispatch({ type: "shoot" });
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [engineRef]);

<<<<<<< HEAD
  return (
    <GameEngine
      ref={(ref) => setEngineRef(ref)}
      systems={[MovePlayer, Physics]}
      entities={entities}
    />
  );
}
=======
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
>>>>>>> 78cc8392adbc4df08d6c0b0229260f36ac5a493e
