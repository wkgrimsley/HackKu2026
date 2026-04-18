import React, { PureComponent } from "react";
import { View, Text, Dimensions, Alert } from "react-native";
import { GameEngine } from "react-native-game-engine";
import Circle from "../components/Circle";
import Box from "../components/Box";

import Matter from "matter-js";

const BALL_SIZE = 50;
const SPEED = 5
const RADIUS = 10
const PROJECTILE_RADIUS = 5

const ballSettings = {
    inertia: 0,
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0,
    restitution: 1
};
const ball = Matter.Bodies.circle(
    BALL_START_POINT_X,
    BALL_START_POINT_Y,
    BALL_SIZE,
    {
    ...ballSettings,
    label: "ball"
    }
);

// const topWall = Matter.Bodies.rectangle(
//     GAME_HEIGHT - 20,
//     -30,
//     GAME_WIDTH,
//     BORDER,
//     { ...wallSettings, label: "topWall" }
// );   
// const bottomWall = Matter.Bodies.rectangle(
//     GAME_HEIGHT - 20,
//     GAME_HEIGHT + 33,
//     GAME_WIDTH,
//     BORDER,
//     { ...wallSettings, label: "bottomWall" }
// );
// const leftWall = Matter.Bodies.rectangle(-50, 160, 10, GAME_HEIGHT, {
//     ...wallSettings,
//     isSensor: true,
//     label: "leftWall"
// });
// const rightWall = Matter.Bodies.rectangle(
//     GAME_WIDTH + 50,
//     160,
//     10,
//     GAME_HEIGHT,
//     { ...wallSettings, isSensor: true, label: "rightWall" }
// );

this.physics = (entities, { time }) => {
    let engine = entities["physics"].engine;
    engine.world.gravity.y = 0; // no downward pull
    Matter.Engine.update(engine, time.delta); // move the simulation forward
    return entities;
};



// next: add code for binding to events for syncing the UI
this.myChannel.bind("client-moved-ball", ({ position, velocity }) => {
    Matter.Sleeping.set(ball, false); // awaken the ball so it can move
    Matter.Body.setPosition(ball, position);
    Matter.Body.setVelocity(ball, velocity);

    setTimeout(() => {
    if (position.x != ball.position.x || position.y != ball.position.y) {
        this.opponentChannel.trigger("client-moved-ball", {
        position: ball.position,
        velocity: ball.velocity
        });

        Matter.Sleeping.set(ball, true); // make the ball sleep while waiting for the event to be triggered by the opponent
    }
    }, 200);
});

// next: add code for sending plank updates to the opponent

addEventListener('click', (event) => {
  const canvas = document.querySelector('canvas')
  const { top, left } = canvas.getBoundingClientRect()
  const playerPosition = {
    x: frontEndPlayers[socket.id].x,
    y: frontEndPlayers[socket.id].y
  }

  const angle = Math.atan2(
    event.clientY - top - playerPosition.y,
    event.clientX - left - playerPosition.x
  )

  const velocity = {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5
    }

    backEndProjectiles[projectileId] = {
      x,
      y,
      velocity,
      playerId: socket.id
    }

  socket.emit('shoot', {
    x: playerPosition.x,
    y: playerPosition.y,
    angle
  })
  // frontEndProjectiles.push(
  //   new Projectile({
  //     x: playerPosition.x,
  //     y: playerPosition.y,
  //     radius: 5,
  //     color: 'white',
  //     velocity
  //   })
  // )
})
setInterval(() => {
  // update projectile positions
  for (const id in backEndProjectiles) {
    backEndProjectiles[id].x += backEndProjectiles[id].velocity.x
    backEndProjectiles[id].y += backEndProjectiles[id].velocity.y

    const PROJECTILE_RADIUS = 5
    if (
      backEndProjectiles[id].x - PROJECTILE_RADIUS >=
        backEndPlayers[backEndProjectiles[id].playerId]?.canvas?.width ||
      backEndProjectiles[id].x + PROJECTILE_RADIUS <= 0 ||
      backEndProjectiles[id].y - PROJECTILE_RADIUS >=
        backEndPlayers[backEndProjectiles[id].playerId]?.canvas?.height ||
      backEndProjectiles[id].y + PROJECTILE_RADIUS <= 0
    ) {
      delete backEndProjectiles[id]
      continue
    }

    for (const playerId in backEndPlayers) {
      const backEndPlayer = backEndPlayers[playerId]

      const DISTANCE = Math.hypot(
        backEndProjectiles[id].x - backEndPlayer.x,
        backEndProjectiles[id].y - backEndPlayer.y
      )

      // collision detection
      if (
        DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius &&
        backEndProjectiles[id].playerId !== playerId
      ) {
        if (backEndPlayers[backEndProjectiles[id].playerId])
          backEndPlayers[backEndProjectiles[id].playerId].score++

        console.log(backEndPlayers[backEndProjectiles[id].playerId])
        delete backEndProjectiles[id]
        delete backEndPlayers[playerId]
        break
      }
    }
}
},)
// //Rotate the character to face where the mouse is so the gun is pointing at mouse
// function drawArrow(angle) {
//     ctx.clearRect(0, 0, cv.width, cv.height);
//     ctx.save();
//     ctx.translate(centerX, centerY);
//     ctx.rotate(-Math.PI / 2);  // correction for image starting position
//     ctx.rotate(angle);
//     ctx.drawImage(arrow, -arrow.width / 2, -arrow.height / 2);
//     ctx.restore();
// }
// document.onmousemove = function(e) {
//     var dx = e.pageX - centerX;
//     var dy = e.pageY - centerY;
//     var theta = Math.atan2(dy, dx);
//     drawArrow(theta);
// };



// import React, { useEffect, useState } from "react";
// import { View } from "react-native";
// import { GameEngine } from "react-native-game-engine";

// /* =========================
//    GRAPH (PATH DEFINITION)
// ========================= */

// const nodes = {
//   A: { x: 50, y: 200 },
//   B: { x: 300, y: 200 }, // intersection (center of T)
//   C: { x: 550, y: 200 },
//   D: { x: 300, y: 50 }   // vertical branch (top of T)
// };

// const edges = [
//   { id: 0, from: "A", to: "B" }, // left → center
//   { id: 1, from: "B", to: "C" }, // center → right
//   { id: 2, from: "B", to: "D" }  // center → up
// ];

// /* =========================
//    HELPERS
// ========================= */

// // Get position along an edge
// function getPosition(edgeId, t) {
//   const edge = edges.find(e => e.id === edgeId);
//   const from = nodes[edge.from];
//   const to = nodes[edge.to];

//   return {
//     x: from.x + (to.x - from.x) * t,
//     y: from.y + (to.y - from.y) * t
//   };
// }

// // Get connected edges from a node
// function getEdgesFromNode(nodeId) {
//   return edges.filter(e => e.from === nodeId);
// }

// // Choose next edge based on input direction
// function chooseEdge(currentNode, input) {
//   const options = getEdgesFromNode(currentNode);

//   if (input === "UP") {
//     return options.find(e => nodes[e.to].y < nodes[currentNode].y);
//   }
//   if (input === "RIGHT") {
//     return options.find(e => nodes[e.to].x > nodes[currentNode].x);
//   }
//   if (input === "LEFT") {
//     return options.find(e => nodes[e.to].x < nodes[currentNode].x);
//   }
//   if (input === "DOWN") {
//     return options.find(e => nodes[e.to].y > nodes[currentNode].y);
//   }

//   return options[0]; // fallback
// }

// /* =========================
//    PLAYER SYSTEM
// ========================= */

// const MovePlayer = (entities, { input }) => {
//   const player = entities.player;

//   let directionInput = null;

//   // read input events
//   input.forEach(i => {
//     if (i.type === "move") {
//       directionInput = i.direction;
//     }
//   });

//   const speed = 0.01;
//   player.t += speed;

//   // reached end of edge
//   if (player.t >= 1) {
//     const currentNode = edges.find(e => e.id === player.edge).to;

//     const nextEdge = chooseEdge(currentNode, directionInput);

//     if (nextEdge) {
//       player.edge = nextEdge.id;
//       player.t = 0;
//     } else {
//       player.t = 1; // stop if nowhere to go
//     }
//   }

//   const pos = getPosition(player.edge, player.t);
//   player.x = pos.x;
//   player.y = pos.y;

//   return entities;
// };

// /* =========================
//    RENDER COMPONENTS
// ========================= */

// const Player = ({ x, y }) => (
//   <View
//     style={{
//       position: "absolute",
//       width: 20,
//       height: 20,
//       borderRadius: 10,
//       backgroundColor: "blue",
//       left: x - 10,
//       top: y - 10
//     }}
//   />
// );

// const Line = ({ from, to }) => (
//   <View
//     style={{
//       position: "absolute",
//       left: from.x,
//       top: from.y,
//       width: Math.hypot(to.x - from.x, to.y - from.y),
//       height: 2,
//       backgroundColor: "black",
//       transform: [
//         {
//           rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad`
//         }
//       ]
//     }}
//   />
// );

// /* =========================
//    MAIN GAME
// ========================= */

// export default function Game() {
//   const [engine, setEngine] = useState(null);

//   const entities = {
//     player: {
//       edge: 0,
//       t: 0,
//       x: nodes.A.x,
//       y: nodes.A.y,
//       renderer: <Player />
//     }
//   };

//   // add path rendering
//   edges.forEach((edge, i) => {
//     entities["line" + i] = {
//       from: nodes[edge.from],
//       to: nodes[edge.to],
//       renderer: <Line />
//     };
//   });

//   useEffect(() => {
//     const handleKey = (e) => {
//       let direction = null;

//       if (e.key === "ArrowUp") direction = "UP";
//       if (e.key === "ArrowDown") direction = "DOWN";
//       if (e.key === "ArrowLeft") direction = "LEFT";
//       if (e.key === "ArrowRight") direction = "RIGHT";

//       if (direction && engine) {
//         engine.dispatch({
//           type: "move",
//           direction
//         });
//       }
//     };

//     window.addEventListener("keydown", handleKey);
//     return () => window.removeEventListener("keydown", handleKey);
//   }, [engine]);

//   return (
//     <GameEngine
//       ref={(ref) => setEngine(ref)}
//       systems={[MovePlayer]}
//       entities={entities}
//     />
//   );
// }