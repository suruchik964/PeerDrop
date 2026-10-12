import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

function App() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    socket.on("welcome", (info) => setMe(info));
    socket.on("room-joined", (code) => {
      setRoom(code);
      setError("");
    });
    socket.on("room-left", () => {
      setRoom(null);
      setDevices([]);
    });
    socket.on("room-error", (msg) => setError(msg));
    socket.on("device-list", (list) => setDevices(list));

    return () => {
      socket.off("welcome");
      socket.off("room-joined");
      socket.off("room-left");
      socket.off("room-error");
      socket.off("device-list");
    };
  }, []);

  const others = devices.filter((d) => d.id !== me?.id);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>PeerDrop</h1>
      <p>{me ? `You are ${me.name}` : "Connecting..."}</p>

      {!room ? (
        <div>
          <button onClick={() => socket.emit("create-room")}>
            Create room
          </button>
          <p>or join a room:</p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Enter room code"
          />
          <button onClick={() => socket.emit("join-room", codeInput)}>
            Join
          </button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <div>
          <h2>Room code: {room}</h2>
          <button onClick={() => socket.emit("leave-room")}>Leave room</button>

          <h3>Other devices in this room</h3>
          {others.length === 0 && <p>Waiting for others to join...</p>}
          <ul>
            {others.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
