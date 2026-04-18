import { useState } from "react";
import { useNavigate } from "react-router-dom";

function NamePage() {
    const [input, setInput] = useState("");
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        navigate(`/player/${input}`);
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