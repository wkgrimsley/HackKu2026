import './App.css';
import { Routes, Route } from "react-router-dom";
import NamePage from "./NamePage";
import GamePage from "./GamePage";
import MatchmakingPage from "./MatchmakingPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MatchmakingPage />} />
      <Route path="/name" element={<NamePage />} />
      <Route path="/player/:name" element={<GamePage />} />
      <Route path="/matchmaking" element={<MatchmakingPage />} />
      <Route path="/game/:roomId" element={<GamePage />} />
    </Routes>
  );
}

export default App;