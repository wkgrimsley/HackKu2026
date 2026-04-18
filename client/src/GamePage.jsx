import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "./socket"; // SINGLE shared socket

function GamePage() {
    const { name } = useParams();

    const wsRef = useRef(null);
    const stateRef = useRef({});
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const keysRef = useRef({});

    // -----------------------------
    // NETWORK
    // -----------------------------
    useEffect(() => {
        wsRef.current = socket;

        socket.onopen = () => {
            console.log("Connected");

            socket.send(JSON.stringify({
                type: "login",
                name
            }));
        };

        socket.onmessage = (event) => {
            const state = JSON.parse(event.data);
            stateRef.current = state;
        };

        return () => {
            socket.onmessage = null;
        };
    }, [name]);

    // -----------------------------
    // INPUT SYSTEM
    // -----------------------------
    useEffect(() => {
        const handleKeyDown = (e) => {
            keysRef.current[e.key.toLowerCase()] = true;
        };

        const handleKeyUp = (e) => {
            keysRef.current[e.key.toLowerCase()] = false;
        };

        const handleMouseMove = (e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            mouseRef.current.x = e.clientX - rect.left;
            mouseRef.current.y = e.clientY - rect.top;
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);

    // -----------------------------
    // SEND INPUT LOOP (30 TPS)
    // -----------------------------
    useEffect(() => {
        let last = 0;
        const RATE = 1000 / 30;

        const loop = (t) => {
            if (t - last >= RATE) {
                last = t;

                const keys = keysRef.current;

                let dx = 0;
                let dy = 0;

                if (keys["w"]) dy -= 1;
                if (keys["s"]) dy += 1;
                if (keys["a"]) dx -= 1;
                if (keys["d"]) dx += 1;

                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: "input",
                        dx,
                        dy,
                        mouse: mouseRef.current
                    }));
                }
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }, []);

    // -----------------------------
    // RENDER LOOP
    // -----------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const WORLD_WIDTH = 2000;
        const WORLD_HEIGHT = 2000;

        const render = () => {
            const state = stateRef.current;

            const players = state.players || {};

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
        <div style={{ width: "100vw", height: "100vh", background: "#111" }}>
            <h2 style={{ position: "absolute", color: "white", margin: 10 }}>
                Player: {name}
            </h2>

            <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                style={{ display: "block" }}
            />
        </div>
    );
}

export default GamePage;