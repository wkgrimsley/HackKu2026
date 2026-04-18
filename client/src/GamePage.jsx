import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

function GamePage() {
    const { name } = useParams();

    const wsRef = useRef(null);
    const stateRef = useRef({});
    const canvasRef = useRef(null);
    const keysRef = useRef({});
    const mouseRef = useRef({});

    /* =========================
       NETWORK
    ========================= */

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:80");
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: "join_match",
                name
            }));
        };

        ws.onmessage = (event) => {
            stateRef.current = JSON.parse(event.data);
        };

        return () => ws.close();
    }, [name]);

    /* =========================
       INPUT
    ========================= */

    useEffect(() => {
        const down = (e) => {
            e.preventDefault();
            keysRef.current[e.key.toLowerCase()] = true;
        };

        const up = (e) => {
            keysRef.current[e.key.toLowerCase()] = false;
        };

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
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
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

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: "input",
                        dx,
                        mouseRef
                    }));
                }
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

        const TRACK = {
            x: 150,
            y: 50,
            width: 900,
            height: 900
        };

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            /* TRACK */
            ctx.strokeStyle = "white";
            ctx.lineWidth = 4;
            ctx.strokeRect(TRACK.x, TRACK.y, TRACK.width, TRACK.height);

            /* PLAYERS */
            const players = stateRef.current.players || {};

            ctx.fillStyle = "white";

            for (let id in players) {
                const p = players[id];

                const size = p.size || 30;

                ctx.fillRect(
                    p.x - size / 2,
                    p.y - size / 2,
                    size,
                    size
                );
            }

            requestAnimationFrame(render);
        };

        render();
    }, []);

    return (
        <div>
            <canvas
                ref={canvasRef}
                width={1200}
                height={1000}
                style={{ background: "#111" }}
            />
        </div>
    );
}

export default GamePage;