import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

function GamePage() {
    const { name } = useParams();

    const wsRef = useRef(null);
    const stateRef = useRef({}); // latest server state
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const keysRef = useRef({});

    // 1. NETWORK LAYER
    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8080");
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "join", name }));
        };

        ws.onmessage = (event) => {
            const state = JSON.parse(event.data);
            stateRef.current = state;
        };

        return () => ws.close();
    }, [name]);

    // 2. INPUT SYSTEM
    useEffect(() => {
        const handleKeyDown = (e) => {
            keysRef.current[e.key.toLowerCase()] = true;
            // console.log("down");
        };

        const handleKeyUp = (e) => {
            keysRef.current[e.key.toLowerCase()] = false;
            // console.log("up");
        };

        const handleMouseMove = (e) => {
            const rect = canvasRef.current.getBoundingClientRect();
            if (!rect) return;

            mouseRef.current.x = e.clientX - rect.left;
            mouseRef.current.y = e.clientY - rect.top;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const WORLD_WIDTH = 2000;
        const WORLD_HEIGHT = 2000;

        let dpr = window.devicePixelRatio || 1;

        const resize = () => {
            dpr = window.devicePixelRatio || 1;

            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;

            canvas.style.width = window.innerWidth + "px";
            canvas.style.height = window.innerHeight + "px";
        };

        resize();
        window.addEventListener("resize", resize);

        const render = () => {
            // clear full pixel buffer
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // compute world scale
            const scale = Math.min(
                canvas.width / (WORLD_WIDTH * dpr),
                canvas.height / (WORLD_HEIGHT * dpr)
            );

            // center world
            const offsetX = (canvas.width / dpr - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height / dpr - WORLD_HEIGHT * scale) / 2;

            // apply BOTH transforms
            ctx.setTransform(
                scale * dpr, 0,
                0, scale * dpr,
                offsetX * dpr,
                offsetY * dpr
            );

            // draw players
            const players = stateRef.current;

            for (let id in players) {
                const p = players[id];
                ctx.fillRect(p.x, p.y, 20, 20);
                console.log("world:", p.x, p.y);
                console.log("screen:", screenX, screenY);
            }

            requestAnimationFrame(render);
        };

        render();

        return () => window.removeEventListener("resize", resize);
    }, []);

    useEffect(() => {
        let lastSent = 0;
        const SEND_RATE = 1000 / 30; // 30 packets/sec

        const loop = (time) => {
            if (time - lastSent >= SEND_RATE) {
                lastSent = time;

                const keys = keysRef.current;

                let dx = 0, dy = 0;

                if (keys["w"]) dy -= 1;
                if (keys["s"]) dy += 1;
                if (keys["a"]) dx -= 1;
                if (keys["d"]) dx += 1;

                const packet = {
                    type: "input",
                    dx,
                    dy,
                    mouse: {
                        x: mouseRef.current.x,
                        y: mouseRef.current.y
                    }
                };
                
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify(packet));
                }
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }, []);

    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
            <h2
                style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    zIndex: 10,
                    color: "black",
                    margin: 0
                }}
            >
                Player: {name}
            </h2>
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    border: "2px solid black"
                }}
            />

        </div>
    );
}

export default GamePage;