import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GameEngine } from "react-native-game-engine";
import Matter from "matter-js";

/* =========================
   GRAPH (PATH + WALL SOURCE)
========================= */

const nodes = {
  A: { x: 50, y: 200 },
  B: { x: 300, y: 200 }, // center (T intersection)
  C: { x: 550, y: 200 },
  D: { x: 300, y: 50 }
};

const edges = [
  { id: 0, from: "A", to: "B" },
  { id: 1, from: "B", to: "C" },
  { id: 2, from: "B", to: "D" }
];

/* =========================
   MATTER ENGINE (PROJECTILES)
========================= */

const engine = Matter.Engine.create();
const world = engine.world;

/* =========================
   HELPERS
========================= */

function getPosition(edgeId, t) {
  const edge = edges.find(e => e.id === edgeId);
  const from = nodes[edge.from];
  const to = nodes[edge.to];

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  };
}

function getDirection(edgeId) {
  const edge = edges.find(e => e.id === edgeId);
  const from = nodes[edge.from];
  const to = nodes[edge.to];

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);

  return { x: dx / len, y: dy / len };
}

function getEdgesFromNode(nodeId) {
  return edges.filter(e => e.from === nodeId);
}

function chooseEdge(nodeId, input) {
  const options = getEdgesFromNode(nodeId);

  if (input === "UP") return options.find(e => nodes[e.to].y < nodes[nodeId].y);
  if (input === "DOWN") return options.find(e => nodes[e.to].y > nodes[nodeId].y);
  if (input === "LEFT") return options.find(e => nodes[e.to].x < nodes[nodeId].x);
  if (input === "RIGHT") return options.find(e => nodes[e.to].x > nodes[nodeId].x);

  return options[0];
}

/* =========================
   CREATE WALLS FROM EDGES
========================= */

function createWall(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  return Matter.Bodies.rectangle(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    length + 4, // overlap to avoid gaps
    12,         // thickness
    {
      isStatic: true,
      restitution: 1
    }
  );
}

const walls = edges.map(edge => {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  return createWall(from, to);
});

Matter.World.add(world, walls);

/* =========================
   SHOOTING
========================= */

function shoot(player, entities) {
  const pos = getPosition(player.edge, player.t);
  const dir = getDirection(player.edge);

  const bullet = Matter.Bodies.circle(pos.x, pos.y, 5, {
    frictionAir: 0,
    restitution: 1,
    friction: 0,
    frictionStatic: 0
  });

  Matter.Body.setVelocity(bullet, {
    x: dir.x * 8,
    y: dir.y * 8
  });

  Matter.World.add(world, bullet);

  entities.projectiles.push({
    body: bullet,
    x: pos.x,
    y: pos.y,
    renderer: <Circle color="red" />
  });
}

/* =========================
   SYSTEMS
========================= */

const MovePlayer = (entities, { input }) => {
  const player = entities.player;

  let dirInput = null;
  let shootPressed = false;

  input.forEach(i => {
    if (i.type === "move") dirInput = i.direction;
    if (i.type === "shoot") shootPressed = true;
  });

  const speed = 0.01;
  player.t += speed;

  if (player.t >= 1) {
    const currentNode = edges.find(e => e.id === player.edge).to;
    const nextEdge = chooseEdge(currentNode, dirInput);

    if (nextEdge) {
      player.edge = nextEdge.id;
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

const PhysicsSystem = (entities) => {
  Matter.Engine.update(engine, 1000 / 60);

  entities.projectiles.forEach(p => {
    p.x = p.body.position.x;
    p.y = p.body.position.y;
  });

  return entities;
};

/* =========================
   RENDER
========================= */

const Circle = ({ x, y, color = "blue" }) => (
  <View
    style={{
      position: "absolute",
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: color,
      left: x - 10,
      top: y - 10
    }}
  />
);

const Line = ({ from, to }) => (
  <View
    style={{
      position: "absolute",
      left: from.x,
      top: from.y,
      width: Math.hypot(to.x - from.x, to.y - from.y),
      height: 2,
      backgroundColor: "black",
      transform: [
        {
          rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad`
        }
      ]
    }}
  />
);

/* =========================
   MAIN GAME
========================= */

export default function Game() {
  const [engineRef, setEngineRef] = useState(null);

  const entities = {
    player: {
      edge: 0,
      t: 0,
      x: nodes.A.x,
      y: nodes.A.y,
      renderer: <Circle />
    },
    projectiles: []
  };

  edges.forEach((edge, i) => {
    entities["line" + i] = {
      from: nodes[edge.from],
      to: nodes[edge.to],
      renderer: <Line />
    };
  });

  useEffect(() => {
    const handleKey = (e) => {
      if (!engineRef) return;

      let direction = null;

      if (e.key === "ArrowUp") direction = "UP";
      if (e.key === "ArrowDown") direction = "DOWN";
      if (e.key === "ArrowLeft") direction = "LEFT";
      if (e.key === "ArrowRight") direction = "RIGHT";

      if (direction) {
        engineRef.dispatch({ type: "move", direction });
      }

      if (e.key === " ") {
        engineRef.dispatch({ type: "shoot" });
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [engineRef]);

  return (
    <GameEngine
      ref={(ref) => setEngineRef(ref)}
      systems={[MovePlayer, PhysicsSystem]}
      entities={entities}
    />
  );
}