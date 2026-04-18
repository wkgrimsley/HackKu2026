import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "./socket";

const width = window.innerWidth;
const height = window.innerHeight;

function GamePage() {
    const { name } = useParams();

    const canvasRef = useRef(null);
    const stateRef = useRef({ players: {}, projectiles: {} });

    const keysRef = useRef({});
    const mouseRef = useRef({ x: 0, y: 0, isDown: false });

    // trail memory (for tron effect)
    const trailRef = useRef({});

    const WORLD_WIDTH = 1000;
    const WORLD_HEIGHT = 800;

    const TRACK = {
        x: 200,
        y: 100,
        size: 600
    };

    /* =========================
       NETWORK
    ========================= */

    useEffect(() => {
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: "join_match",
                name
            }));
        };

        socket.onmessage = (event) => {
            stateRef.current = JSON.parse(event.data);
        };

        return () => {
            socket.onmessage = null;
        };
    }, [name]);

    /* =========================
       INPUT
    ========================= */

    useEffect(() => {
        const down = (e) => (keysRef.current[e.key.toLowerCase()] = true);
        const up = (e) => (keysRef.current[e.key.toLowerCase()] = false);

        const mouseMove = (e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
          
            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;
            console.log("canvas ref: ", canvasRef.current.width)
            mouseRef.current.x = (e.clientX - ((width-WORLD_WIDTH)/2));
            mouseRef.current.y = (e.clientY - (height-WORLD_HEIGHT)/2);
            console.log("width: ", width);
            console.log("Height: ", height);
        };

        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("mousemove", mouseMove);

        window.addEventListener("mousedown", () => (mouseRef.current.isDown = true));
        window.addEventListener("mouseup", () => (mouseRef.current.isDown = false));

        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("mousemove", mouseMove);
        };
    }, []);

    /* =========================
       SEND INPUT (FIXED AIM VECTOR)
    ========================= */

    useEffect(() => {
        let last = 0;
        const RATE = 1000 / 30;

        const loop = (t) => {
            if (t - last >= RATE) {
                last = t;

                let dx = 0;
                if (keysRef.current["d"]) dx = 1;
                if (keysRef.current["a"]) dx = -1;

                // 🔥 IMPORTANT FIX: send raw mouse WORLD coords (no weird offsets)
                const mouse = {
                    x: mouseRef.current.x,
                    y: mouseRef.current.y,
                    isDown: mouseRef.current.isDown
                };

                socket.send(JSON.stringify({
                    type: "input",
                    dx,
                    mouse
                }));
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }, []);

    /* =========================
       RENDER (TRON STYLE + TRAILS)
    ========================= */

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resize();
        window.addEventListener("resize", resize);

        const render = () => {
            const { players, projectiles } = stateRef.current;

            /* fade instead of full clear → TRON TRAILS */

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "rgba(10,10,20,0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const scale = Math.min(
                canvas.width / WORLD_WIDTH,
                canvas.height / WORLD_HEIGHT
            );

            const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

            ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

            /* GRID BACKGROUND (TRON FEEL) */
            ctx.strokeStyle = "rgba(0,255,255,0.05)";
            for (let i = 0; i < WORLD_WIDTH; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, WORLD_HEIGHT);
                ctx.stroke();
            }
            for (let i = 0; i < WORLD_HEIGHT; i += 40) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(WORLD_WIDTH, i);
                ctx.stroke();
            }

            /* TRACK */
            ctx.strokeStyle = "cyan";
            ctx.shadowColor = "cyan";
            ctx.shadowBlur = 10;
            ctx.lineWidth = 3;
            ctx.strokeRect(TRACK.x, TRACK.y, TRACK.size, TRACK.size);
            ctx.shadowBlur = 0;

            /* PLAYERS + TRAILS */
            for (let id in players) {
                const p = players[id];

                if (!trailRef.current[id]) trailRef.current[id] = [];

                trailRef.current[id].push({ x: p.x, y: p.y });

                if (trailRef.current[id].length > 10) {
                    trailRef.current[id].shift();
                }

                // draw trail
                ctx.strokeStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 15;

                ctx.beginPath();
                const trail = trailRef.current[id];
                for (let i = 0; i < trail.length; i++) {
                    const pt = trail[i];
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();

                // player
                ctx.beginPath();
                ctx.fillStyle = p.color;
                ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                console.log("p.x: ",p.x);
                console.log("p.y: ",p.y);
                ctx.fill();

                ctx.shadowBlur = 0;
            }

            /* PROJECTILES */
            for (let id in projectiles) {
                const p = projectiles[id];

                ctx.beginPath();
                ctx.fillStyle = "white";
                ctx.shadowColor = "white";
                ctx.shadowBlur = 10;
                ctx.arc(p.x, p.y, p.size || 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            requestAnimationFrame(render);
        };

        render();

        return () => window.removeEventListener("resize", resize);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100vw",
                height: "100vh",
                display: "block",
                background: "#050510",
                border: "yellow",
            }}
        />
    );
}

export default GamePage;