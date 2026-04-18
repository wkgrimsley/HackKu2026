import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function NamePage() {
    const [input, setInput] = useState("");
    const navigate = useNavigate();
    const ws = useRef(null);

    useEffect(() => {
        ws.current = new WebSocket("ws://localhost:3000");

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "match_found") {
                navigate(`/game/${data.roomId}`);
            }
        };

        return () => ws.current.close();
    }, [navigate]);

    const handleSubmit = (e) => {
        e.preventDefault();
        ws.current.send(JSON.stringify({ type: "login", name: input }));
        ws.current.send(JSON.stringify({ type: "join_match" }));
    };

    return (
        <div style={{ textAlign: "center", marginTop: "50px" }}>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter Name!"
                />
                <button type="submit">Submit</button>
            </form>
        </div>
    );
}

export default NamePage;