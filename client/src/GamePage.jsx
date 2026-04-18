import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "./socket";

function GamePage() {
    const { name } = useParams();
    const WsRef = useRef(null);
    const canvasRef = useRef(null);
    const stateRef = useRef({ players: {} });
    const keysRef = useRef({});
    const mouseRef = useRef({});

    /* =========================
       WORLD SETTINGS (MATCH SERVER)
    ========================= */

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
        const down = (e) => keysRef.current[e.key.toLowerCase()] = true;
        const up = (e) => keysRef.current[e.key.toLowerCase()] = false;
        const handleMouseMove = (e) => {
            const rect = canvasRef.current.getBoundingClientRect();
            if (!rect) return;

            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;

            mouseRef.current.x = (e.clientX - rect.left) * scaleX;
            mouseRef.current.y = (e.clientY - rect.top) * scaleY;
        };

        const handleMouseDown = () => {
            mouseRef.current.isDown = true;
        };

        const handleMouseUp = () => {
            mouseRef.current.isDown = false;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("mousedown",handleMouseDown);
        window.addEventListener("mouseup",handleMouseUp);
        
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mousedown",handleMouseDown);
            window.addEventListener("mouseup",handleMouseUp);

        };
    }, []);

    /* =========================
       SEND INPUT
    ========================= */

    useEffect(() => {
        let last = 0;
        const RATE = 1000/30;
        const loop = (t) => {
            if (t - last >= RATE) {
                last = t;

                let dx = 0;
                if (keysRef.current["d"]) dx = 1;
                if (keysRef.current["a"]) dx = -1;


                socket.send(JSON.stringify({
                    type: "input",
                    dx,
                    mouseRef
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
            const { players } = stateRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            /* =========================
               SCALE + CENTER WORLD
            ========================= */

            const scale = Math.min(
                canvas.width / WORLD_WIDTH,
                canvas.height / WORLD_HEIGHT
            );

            const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

            ctx.setTransform(
                scale, 0,
                0, scale,
                offsetX,
                offsetY
            );

            /* =========================
               DRAW BACKGROUND
            ========================= */

            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

            /* =========================
               DRAW TRACK (IMPORTANT)
            ========================= */

            ctx.strokeStyle = "white";
            ctx.lineWidth = 4;

            ctx.strokeRect(
                TRACK.x,
                TRACK.y,
                TRACK.size,
                TRACK.size
            );

            /* =========================
               DRAW PLAYERS
            ========================= */

            for (let id in players) {
                const p = players[id];

                ctx.shadowColor = p.color;
                ctx.shadowBlur = 15;

                ctx.fillStyle = p.color;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
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
                display: "block"
            }}
        />
    );
}

export default GamePage;