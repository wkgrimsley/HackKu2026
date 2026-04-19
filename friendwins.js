let socket = null;
let gameState = null;
let playerId = null;

/* =========================
   UI ELEMENTS
========================= */

const menu = document.getElementById("menu");
const game = document.getElementById("game");

/* =========================
   CONNECT / START GAME
========================= */

function startGame() {
    menu.style.display = "none";
    game.style.display = "block";

    socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
        playerId = Math.random().toString(36).slice(2); // replace with server id if you already have one
        socket.send(JSON.stringify({ type: "join" }));
    };

    socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "match_end") {
            showEndScreen(data);
            return;
        }

        gameState = data;
        renderGame(data);
    };

    socket.onclose = () => {
        console.log("Socket closed");
    };
}

/* =========================
   INPUT (example)
========================= */

document.addEventListener("keydown", (e) => {
    if (!socket) return;

    if (e.key === "ArrowRight") {
        socket.send(JSON.stringify({ type: "input", dx: 1 }));
    }

    if (e.key === "ArrowLeft") {
        socket.send(JSON.stringify({ type: "input", dx: -1 }));
    }
});

document.addEventListener("mousedown", (e) => {
    if (!socket) return;

    socket.send(JSON.stringify({
        type: "input",
        mouse: { x: e.clientX, y: e.clientY, isDown: true }
    }));
});

document.addEventListener("mouseup", () => {
    if (!socket) return;

    socket.send(JSON.stringify({
        type: "input",
        mouse: { isDown: false }
    }));
});

/* =========================
   GAME RENDER (placeholder)
========================= */

function renderGame(state) {
    // replace with your canvas rendering
    console.log("render", state);
}

/* =========================
   END SCREEN
========================= */

let endTimer = null;

function showEndScreen(data) {
    const isWinner = data.winner && data.winner === playerId;

    let text = "DRAW";
    if (data.winner) {
        text = isWinner ? "YOU WIN 🎉" : "YOU LOSE 💀";
    }

    const overlay = document.createElement("div");
    overlay.id = "end-screen";
    overlay.style = `
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85);
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        z-index: 9999;
        cursor: pointer;
        text-align: center;
    `;

    overlay.innerHTML = `
        <div>${text}</div>
        <div style="font-size:24px; margin-top:10px;">
            Returning to menu in <span id="count">10</span>...
        </div>
        <div style="font-size:18px; margin-top:20px;">
            Click anywhere to return now
        </div>
    `;

    document.body.appendChild(overlay);

    let time = 10;
    const countEl = overlay.querySelector("#count");

    endTimer = setInterval(() => {
        time--;
        if (countEl) countEl.textContent = time;

        if (time <= 0) {
            returnToMenu();
        }
    }, 1000);

    overlay.addEventListener("click", returnToMenu);
}

/* =========================
   RETURN TO MENU
========================= */

function returnToMenu() {
    if (endTimer) {
        clearInterval(endTimer);
        endTimer = null;
    }

    const overlay = document.getElementById("end-screen");
    if (overlay) overlay.remove();

    if (socket) {
        socket.close();
        socket = null;
    }

    gameState = null;
    playerId = null;

    game.style.display = "none";
    menu.style.display = "block";
}

/* =========================
   BUTTON HOOK (menu)
========================= */

document.getElementById("start-btn").onclick = startGame;