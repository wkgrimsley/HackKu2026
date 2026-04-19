import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "./socket";

function GamePage() {
    const { name } = useParams();

    const canvasRef = useRef(null);

    const stateRef = useRef({
        players: {},
        projectiles: [],
        walls: [],
        sparks: []
    });

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
            try {
                stateRef.current = JSON.parse(event.data);
            } catch {}
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
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();

            const scale = Math.min(
                canvas.width / WORLD_WIDTH,
                canvas.height / WORLD_HEIGHT
            );

            const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

            mouseRef.current.x = (e.clientX - rect.left - offsetX) / scale;
            mouseRef.current.y = (e.clientY - rect.top - offsetY) / scale;
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

            /* TRON FADE */
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "rgba(5,5,16,0.18)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const scale = Math.min(
                canvas.width / WORLD_WIDTH,
                canvas.height / WORLD_HEIGHT
            );

            const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
            const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

            ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

            /* GRID (TRON LIVING GRID) */
            const time = Date.now();

            /* fade layer (keeps trails + motion blur feel) */
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "rgba(5,5,16,0.12)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            /* world transform */
            ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

            /* === NOVA BURSTS === */
            if (!window.__nova) window.__nova = [];

            const novaList = window.__nova;

            /* spawn new nova occasionally */
            if (Math.random() < 0.08) {
                novaList.push({
                    x: Math.random() * WORLD_WIDTH,
                    y: Math.random() * WORLD_HEIGHT,
                    r: 0,
                    life: 1,
                    hue: 180 + Math.random() * 40
                });
            }

            /* update + draw nova bursts */
            for (let i = novaList.length - 1; i >= 0; i--) {
                const n = novaList[i];

                n.r += 1.2;
                n.life -= 0.015;

                if (n.life <= 0) {
                    novaList.splice(i, 1);
                    continue;
                }

                const glow = n.life;

                const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);

                grad.addColorStop(0, `hsla(${n.hue},100%,70%,${0.25 * glow})`);
                grad.addColorStop(0.4, `hsla(${n.hue},100%,60%,${0.12 * glow})`);
                grad.addColorStop(1, "rgba(0,0,0,0)");

                ctx.fillStyle = grad;

                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fill();
            }

            /* === SUBTLE FLOATING PARTICLES === */
            for (let i = 0; i < 18; i++) {
                const px = (i * 173.3 + time * 0.02) % WORLD_WIDTH;
                const py = (i * 97.7 + time * 0.015) % WORLD_HEIGHT;

                ctx.beginPath();
                ctx.fillStyle = "rgba(0,255,255,0.06)";
                ctx.shadowColor = "#00f0ff";
                ctx.shadowBlur = 10;

                ctx.arc(px, py, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.shadowBlur = 0;

            /* WALLS */
            const now = Date.now();

            for (const w of walls || []) {
                const dt = now - w.flash;
                const intensity = Math.max(0, 1 - dt / 200);

                ctx.strokeStyle = `rgba(255,255,255,${0.3 + intensity})`;
                ctx.lineWidth = 2 + intensity * 3;
                ctx.shadowColor = "#fff";
                ctx.shadowBlur = 12 * intensity;

                ctx.strokeRect(
                    w.x - w.width / 2,
                    w.y - w.height / 2,
                    w.width,
                    w.height
                );

                ctx.shadowBlur = 0;
            }

            /* TRACK */
            ctx.strokeStyle = "cyan";
            ctx.shadowColor = "cyan";
            ctx.shadowBlur = 12;
            ctx.strokeRect(TRACK.x, TRACK.y, TRACK.size, TRACK.size);
            ctx.shadowBlur = 0;

            /* PLAYERS */
            for (let id in players) {
                const p = players[id];

                if (!trailRef.current[id]) trailRef.current[id] = [];

                trailRef.current[id].push({ x: p.x, y: p.y });

                if (trailRef.current[id].length > 18) {
                    trailRef.current[id].shift();
                }

                const trail = trailRef.current[id];

                /* TRAIL */
                ctx.strokeStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 14;

                ctx.beginPath();
                for (let i = 0; i < trail.length; i++) {
                    const pt = trail[i];
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();

                /* HIT FLASH */
                const flash = p.hitFlash || 0;
                const flashIntensity = Math.max(0, 1 - (now - flash) / 150);

                ctx.shadowColor = flashIntensity > 0 ? "#fff" : p.color;
                ctx.shadowBlur = flashIntensity > 0 ? 30 : 15;

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                ctx.fill();

                if (flashIntensity > 0) {
                    ctx.fillStyle = `rgba(255,255,255,${flashIntensity})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size / 2 + 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.shadowBlur = 0;

                /* HEALTH BAR */
                const hp = p.health ?? 25;
                const percent = hp / 25;

                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(p.x - 20, p.y + 25, 40, 5);

                ctx.fillStyle =
                    percent > 0.5 ? "#00ffcc" :
                    percent > 0.25 ? "#ffcc00" : "#ff0033";

                ctx.fillRect(p.x - 20, p.y + 25, 40 * percent, 5);
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
                ctx.beginPath();
                ctx.fillStyle = `rgba(0,255,255,${s.life})`;
                ctx.shadowColor = "#0ff";
                ctx.shadowBlur = 10;
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