import { Routes, Route, Navigate } from "react-router-dom";
import { useRoom } from "./hooks/useRoom";
import Landing from "./pages/Landing";
import RoomPage from "./pages/RoomPage";

function App() {
  const roomState = useRoom(); // kept here so it survives page changes

  return (
    <Routes>
      <Route path="/" element={<Landing roomState={roomState} />} />
      <Route path="/room/:code" element={<RoomPage roomState={roomState} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
