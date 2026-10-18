import { useState } from "react";

export default function RoomPanel({ onCreate, onJoin, error }) {
  const [codeInput, setCodeInput] = useState("");

  return (
    <div>
      <button onClick={onCreate}>Create room</button>
      <p>or join a room:</p>
      <input
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value)}
        placeholder="Enter room code"
      />
      <button onClick={() => onJoin(codeInput)}>Join</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
