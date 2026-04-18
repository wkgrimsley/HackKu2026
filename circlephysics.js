import React, { PureComponent } from "react";
import { View, Text, Dimensions, Alert } from "react-native";
import { GameEngine } from "react-native-game-engine";
import Circle from "../components/Circle";
import Box from "../components/Box";

import Matter from "matter-js";

const BALL_SIZE = 50;

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

