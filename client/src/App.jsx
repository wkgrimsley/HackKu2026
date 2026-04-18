import './App.css';
import { Routes, Route } from "react-router-dom";
import NamePage from "./NamePage";
import GamePage from "./GamePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<NamePage />} />
      <Route path="/player/:name" element={<GamePage />} />
    </Routes>
  );
}

export default App;