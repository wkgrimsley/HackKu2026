import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "./socket";

const MatchmakingPage = () => {
  const [status, setStatus] = useState("Initializing...");
  const [dots, setDots] = useState("");
  const navigate = useNavigate();

  const connectedRef = useRef(false);

  /* =========================
     DOT ANIMATION
  ========================= */
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  /* =========================
     SOCKET
  ========================= */
  useEffect(() => {
    socket.onopen = () => {
      connectedRef.current = true;
      setStatus("Neural link established");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "match_found") {
        setStatus(`Syncing grid ${data.roomId}`);

        setTimeout(() => {
          navigate(`/game/${data.roomId}`);
        }, 800);
      }
    };

    socket.onclose = () => {
      connectedRef.current = false;
      setStatus("Connection lost");
    };

    return () => {
      socket.onmessage = null;
      socket.onopen = null;
      socket.onclose = null;
    };
  }, [navigate]);

  /* =========================
     JOIN MATCH
  ========================= */
  const joinMatch = () => {
    if (!connectedRef.current) {
      setStatus("Establishing connection...");
      return;
    }

    socket.send(JSON.stringify({ type: "join_match" }));
    setStatus("Scanning grid" + dots);
  };

  /* =========================
     UI
  ========================= */
  return (
    <div style={styles.container}>
      <div style={styles.gridOverlay}></div>

      <div style={styles.card}>
        <h1 style={styles.title}>TRON ARENA</h1>

        <div style={styles.status}>
          {status}{status.includes("Scanning") ? dots : ""}
        </div>

        <button onClick={joinMatch} style={styles.button}>
          INITIALIZE MATCH
        </button>

        <div style={styles.subtext}>
          Entering digital combat grid
        </div>
      </div>
    </div>
  );
};

/* =========================
   STYLES (TRON THEME)
========================= */

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "radial-gradient(circle at center, #05070a 0%, #000 100%)",
    color: "#00f0ff",
    fontFamily: "monospace",
    position: "relative",
    overflow: "hidden"
  },

  /* animated grid background */
  gridOverlay: {
    position: "absolute",
    width: "200%",
    height: "200%",
    backgroundImage:
      "linear-gradient(rgba(0,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.08) 1px, transparent 1px)",
    backgroundSize: "50px 50px",
    animation: "moveGrid 20s linear infinite",
    transform: "rotate(45deg)",
    opacity: 0.4
  },

  card: {
    textAlign: "center",
    padding: 50,
    border: "1px solid rgba(0,255,255,0.4)",
    borderRadius: 10,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 0 25px rgba(0,255,255,0.2)",
    zIndex: 2,
    minWidth: 320
  },

  title: {
    marginBottom: 20,
    color: "#00f0ff",
    textShadow: "0 0 15px #00f0ff",
    letterSpacing: 4
  },

  status: {
    marginBottom: 20,
    color: "#7df9ff",
    textShadow: "0 0 10px rgba(0,255,255,0.5)"
  },

  button: {
    padding: "12px 24px",
    fontSize: 14,
    cursor: "pointer",
    background: "transparent",
    border: "1px solid #00f0ff",
    borderRadius: 6,
    color: "#00f0ff",
    textTransform: "uppercase",
    letterSpacing: 2,
    boxShadow: "0 0 10px rgba(0,255,255,0.3)",
    transition: "0.2s"
  },

  subtext: {
    marginTop: 15,
    fontSize: 11,
    color: "#5ad7ff",
    opacity: 0.8
  }
};

/* inject animation keyframes */
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
@keyframes moveGrid {
  from { transform: translate(0,0) rotate(45deg); }
  to { transform: translate(-50px,-50px) rotate(45deg); }
}
`, styleSheet.cssRules.length);

export default MatchmakingPage;