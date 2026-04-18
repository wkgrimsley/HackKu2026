import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "./socket";

const MatchmakingPage = () => {
  const [status, setStatus] = useState("Click 'Join Match' to find a game.");
  const navigate = useNavigate();

  useEffect(() => {
    socket.onopen = () => {
      console.log("Connected to server");

      // optional login
      socket.send(JSON.stringify({
        type: "login",
        name: "Player"
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "match_found") {
        setStatus(`Match found! Joining room ${data.roomId}...`);

        setTimeout(() => {
          navigate(`/game/${data.roomId}`);
        }, 500);
      }
    };

    return () => {
      socket.onmessage = null;
    };
  }, [navigate]);

  const joinMatch = () => {
    socket.send(JSON.stringify({ type: "join_match" }));
    setStatus("Waiting for a match...");
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Matchmaking</h1>
      <p>{status}</p>

      <button onClick={joinMatch} style={{ padding: "10px 20px", fontSize: "16px" }}>
        Join Match
      </button>
    </div>
  );
};

export default MatchmakingPage;