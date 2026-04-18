import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

function GamePage() {
    const { name } = useParams();

    const wsRef = useRef(null);
    const stateRef = useRef({}); // latest server state
    const canvasRef = useRef(null);

    // 1. NETWORK LAYER
    useEffect(() => {
        const ws = new WebSocket("ws://localhost");
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "join", name }));
        };

        ws.onmessage = (event) => {
            stateRef.current = JSON.parse(event.data);
        };

        return () => ws.close();
    }, [name]);

    // 2. INPUT SYSTEM
    useEffect(() => {
        const handleKey = (e) => {
            let dx = 0, dy = 0;

            if (e.key === "w") dy = -5;
            if (e.key === "s") dy = 5;
            if (e.key === "a") dx = -5;
            if (e.key === "d") dx = 5;

            wsRef.current?.send(JSON.stringify({
                type: "input",
                dx,
                dy
            }));
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    // 3. RENDER LOOP (IMPORTANT PART)
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const render = () => {
            const players = stateRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let id in players) {
                const p = players[id];
                ctx.fillRect(p.x, p.y, 20, 20);
            }

            requestAnimationFrame(render);
        };

        render();
    }, []);

    return (
        <div style={{ textAlign: "center" }}>
            <h2>Player: {name}</h2>
            <canvas ref={canvasRef} width={500} height={500} />
        </div>
    );
}

export default GamePage;