import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "./socket"; // IMPORTANT: shared websocket

function GamePage() {
    const { name } = useParams();

    const wsRef = useRef(null);
    const stateRef = useRef({});
    const canvasRef = useRef(null);

    // -----------------------------
    // NETWORK LAYER
    // -----------------------------
    useEffect(() => {
        wsRef.current = socket;

        // Login once socket is open
        socket.onopen = () => {
            console.log("Game socket connected");

            socket.send(JSON.stringify({
                type: "login",
                name
            }));
        };

        // Receive game state OR messages
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Match state updates (your server sends raw players object)
            if (typeof data === "object" && !data.type) {
                stateRef.current = data;
            }

            // Optional debug
            if (data.type === "match_found") {
                console.log("Joined room:", data.roomId);
            }
        };

        return () => {
            socket.onmessage = null;
        };
    }, [name]);

    // -----------------------------
    // INPUT SYSTEM
    // -----------------------------
    useEffect(() => {
        const handleKey = (e) => {
            let dx = 0;
            let dy = 0;

            if (e.key === "w") dy = -5;
            if (e.key === "s") dy = 5;
            if (e.key === "a") dx = -5;
            if (e.key === "d") dx = 5;

            const ws = wsRef.current;

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "input",
                    dx,
                    dy
                }));
            }
        };

        window.addEventListener("keydown", handleKey);

        return () => {
            window.removeEventListener("keydown", handleKey);
        };
    }, []);

    // -----------------------------
    // RENDER LOOP
    // -----------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const render = () => {
            const players = stateRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let id in players) {
                const p = players[id];

                if (!p) continue;

                ctx.fillStyle = "white";
                ctx.fillRect(p.x, p.y, 20, 20);
            }

            requestAnimationFrame(render);
        };

        render();
    }, []);

    // -----------------------------
    // UI
    // -----------------------------
    return (
        <div style={{ textAlign: "center", background: "#111", color: "white", height: "100vh" }}>
            <h2>Player: {name}</h2>
            <canvas
                ref={canvasRef}
                width={500}
                height={500}
                style={{ border: "1px solid white" }}
            />
        </div>
    );
}

export default GamePage;