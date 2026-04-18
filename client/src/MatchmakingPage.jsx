import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "./socket";

const MatchmakingPage = () => {
  const [status, setStatus] = useState("Connecting...");
  const [dots, setDots] = useState("");
  const navigate = useNavigate();

  const connectedRef = useRef(false);

  // -------------------------
  // DOT ANIMATION (WAITING UI)
  // -------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // -------------------------
  // SOCKET SETUP
  // -------------------------
  useEffect(() => {
    socket.onopen = () => {
      connectedRef.current = true;
      setStatus("Connected. Ready to find match");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "match_found") {
        setStatus(`Match found! Joining room ${data.roomId}`);

        // small delay for UX polish
        setTimeout(() => {
          navigate(`/game/${data.roomId}`);
        }, 800);
      }
    };

    socket.onclose = () => {
      connectedRef.current = false;
      setStatus("Disconnected from server");
    };

    return () => {
      socket.onmessage = null;
      socket.onopen = null;
      socket.onclose = null;
    };
  }, [navigate]);

  // -------------------------
  // JOIN MATCH
  // -------------------------
  const joinMatch = () => {
    if (!connectedRef.current) {
      setStatus("Still connecting...");
      return;
    }

    socket.send(JSON.stringify({ type: "join_match" }));
    setStatus("Searching for opponent" + dots);
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Matchmaking</h1>

        <div style={styles.status}>
          {status}{status.includes("Searching") ? dots : ""}
        </div>

        <button onClick={joinMatch} style={styles.button}>
          Find Match
        </button>

        <div style={styles.subtext}>
          Queue up and get matched with another player
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0f0f0f",
    color: "white",
    fontFamily: "sans-serif"
  },
  card: {
    textAlign: "center",
    padding: 40,
    border: "1px solid #333",
    borderRadius: 12,
    background: "#1a1a1a",
    minWidth: 300
  },
  title: {
    marginBottom: 20
  },
  status: {
    marginBottom: 20,
    color: "#aaa"
  },
  button: {
    padding: "10px 20px",
    fontSize: 16,
    cursor: "pointer",
    background: "#4caf50",
    border: "none",
    borderRadius: 6,
    color: "white"
  },
  subtext: {
    marginTop: 15,
    fontSize: 12,
    color: "#777"
  }
};

export default MatchmakingPage;