import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "./socket";

function GamePage() {
    const { name } = useParams();

    const canvasRef = useRef(null);
    const stateRef = useRef({ players: {}, projectiles: [], walls: [], sparks: [], track: null });

    const keysRef = useRef({});
    const mouseRef = useRef({ x: 0, y: 0, isDown: false });

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
       INPUT (FIXED WORLD COORDS)
    ========================= */

    useEffect(() => {
        const down = (e) => (keysRef.current[e.key.toLowerCase()] = true);
        const up = (e) => (keysRef.current[e.key.toLowerCase()] = false);

        const mouseMove = (e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();

            const scale = Math.min(
                canvas.width / WORLD_WIDTH,
                canvas.height / WORLD_HEIGHT
            );

            const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

            // convert screen → world
            const x = (e.clientX - rect.left - offsetX) / scale;
            const y = (e.clientY - rect.top - offsetY) / scale;

            mouseRef.current.x = x;
            mouseRef.current.y = y;
        };

        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("mousemove", mouseMove);
        const mouseDown = () => (mouseRef.current.isDown = true);
        const mouseUp = () => (mouseRef.current.isDown = false);

        window.addEventListener("mousedown", mouseDown);
        window.addEventListener("mouseup", mouseUp);

        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("mousemove", mouseMove);
            window.removeEventListener("mousedown", mouseDown);
            window.removeEventListener("mouseup", mouseUp);
        };
    }, []);

    /* =========================
       SEND INPUT
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

                socket.send(JSON.stringify({
                    type: "input",
                    dx,
                    mouse: mouseRef.current
                }));
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }, []);

    /* =========================
       RENDER
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
            const { players, projectiles, walls, sparks } = stateRef.current;

            /* TRAIL FADE */
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "rgba(5,5,16,0.2)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            /* WORLD TRANSFORM */
            const scale = Math.min(
                canvas.width / WORLD_WIDTH,
                canvas.height / WORLD_HEIGHT
            );

            const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

            ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

            /* GRID */
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

            /* WALLS (FADE FLASH) */
            const now = Date.now();

            for (const wall of walls || []) {
                const dt = now - wall.flash;
                const intensity = Math.max(0, 1 - dt / 200);

                ctx.strokeStyle = `rgba(255,255,255,${0.3 + intensity})`;
                ctx.lineWidth = 2 + intensity * 4;

                ctx.shadowColor = "#fff";
                ctx.shadowBlur = 10 * intensity;

                ctx.strokeRect(
                    wall.x - wall.width / 2,
                    wall.y - wall.height / 2,
                    wall.width,
                    wall.height
                );

                ctx.shadowBlur = 0;
            }

            // - TRACKS -
            const track = stateRef.current.track;

            if (track) {
                ctx.strokeStyle = "cyan";
                ctx.shadowColor = "cyan";
                ctx.shadowBlur = 10;
                ctx.lineWidth = 3;

                switch (track.name) {
                    case "square":
                        ctx.strokeRect(track.x, track.y, track.size, track.size);
                        break;

                    case "square-cut":
                        drawSquareCut(ctx, track);
                        break;

                    default:
                        console.warn("Unknown track type:", track.name);
                }

                ctx.shadowBlur = 0;
            }

            function drawSquareCut(ctx, { x, y, size: s }) {
                const cut = s * 0.2;

                ctx.beginPath();

                // Start top-left cut point
                ctx.moveTo(x + cut, y);

                // Top edge
                ctx.lineTo(x + s - cut, y);

                // Top-right diagonal
                ctx.lineTo(x + s, y + cut);

                // Right edge
                ctx.lineTo(x + s, y + s - cut);

                // Bottom-right diagonal
                ctx.lineTo(x + s - cut, y + s);

                // Bottom edge
                ctx.lineTo(x + cut, y + s);

                // Bottom-left diagonal
                ctx.lineTo(x, y + s - cut);

                // Left edge
                ctx.lineTo(x, y + cut);

                // Top-left diagonal (close)
                ctx.closePath();

                ctx.stroke();
            }

            /* PLAYERS + TRAILS */
            for (let id in players) {
                const p = players[id];

                if (!trailRef.current[id]) trailRef.current[id] = [];

                trailRef.current[id].push({ x: p.x, y: p.y });

                if (trailRef.current[id].length > 12) {
                    trailRef.current[id].shift();
                }

                const trail = trailRef.current[id];

                ctx.strokeStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 15;

                ctx.beginPath();
                for (let i = 0; i < trail.length; i++) {
                    const pt = trail[i];
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();

                ctx.beginPath();
                ctx.fillStyle = p.color;
                ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;

                const hp = p.health ?? 25;
                const maxHp = 25;

                const barWidth = 40;
                const barHeight = 5;

                const percent = hp / maxHp;

                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(p.x - barWidth / 2, p.y + p.size + 6, barWidth, barHeight);

                ctx.fillStyle = percent > 0.5 ? "#00ffcc" : percent > 0.25 ? "#ffcc00" : "#ff0033";
                ctx.fillRect(p.x - barWidth / 2, p.y + p.size + 6, barWidth * percent, barHeight);
            }

            /* PROJECTILES */
            for (const p of projectiles || []) {
                ctx.beginPath();
                ctx.fillStyle = "white";
                ctx.shadowColor = "white";
                ctx.shadowBlur = 10;
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            /* SPARKS */
            for (const s of sparks || []) {
                ctx.fillStyle = `rgba(0,255,255,${s.life})`;

                ctx.shadowColor = "#0ff";
                ctx.shadowBlur = 10;

                ctx.beginPath();
                ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
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
                background: "#050510"
            }}
        />
    );
}

export default GamePage;