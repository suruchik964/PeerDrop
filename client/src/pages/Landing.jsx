import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NameBox from "../components/NameBox";
import Modal from "../components/Modal";

const features = [
  "Direct device-to-device transfer. Files never touch a server.",
  "No signup and no install. It runs in the browser.",
  "Every file is verified, so you know it arrived intact.",
  "Works across different networks using a room code.",
];

export default function Landing({ roomState }) {
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // null, "create" or "join"
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);

  // After a successful join, move to the room page
  useEffect(() => {
    if (modal === "join" && roomState.room) {
      navigate(`/room/${roomState.room}`);
    }
  }, [roomState.room, modal]);

  function openCreate() {
    roomState.createRoom(); // the server creates the room and sends the code back
    setModal("create");
  }

  function openJoin() {
    setCodeInput("");
    setModal("join");
  }

  function closeModal() {
    if (roomState.room) roomState.leaveRoom(); // don't leave a stray room behind
    setModal(null);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomState.room);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be blocked, so do nothing
    }
  }

  function submitJoin(e) {
    e.preventDefault();
    roomState.joinRoom(codeInput);
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <header>
        <b style={{ fontSize: 22 }}>PeerDrop</b>
      </header>

      <main style={{ maxWidth: 480, margin: "40px auto" }}>
        <h1>Send files directly between devices</h1>
        <p>
          No uploads, no accounts. The file goes straight from one device to the
          other.
        </p>

        <NameBox me={roomState.me} onSave={roomState.setMyName} />

        <div style={{ marginTop: 16 }}>
          <button onClick={openCreate}>Create a room</button>{" "}
          <button onClick={openJoin}>Join a room</button>
        </div>

        <h2 style={{ marginTop: 40 }}>Features</h2>
        <ul>
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </main>

      {modal === "create" && (
        <Modal title="Your room is ready" onClose={closeModal}>
          {roomState.room ? (
            <div>
              <p>Share this code with the other person:</p>
              <p
                style={{
                  fontSize: 28,
                  letterSpacing: 4,
                  fontFamily: "monospace",
                }}
              >
                {roomState.room}
              </p>
              <button onClick={copyCode}>
                {copied ? "Copied!" : "Copy code"}
              </button>{" "}
              <button onClick={() => navigate(`/room/${roomState.room}`)}>
                Enter room
              </button>
            </div>
          ) : (
            <p>Creating room...</p>
          )}
        </Modal>
      )}

      {modal === "join" && (
        <Modal title="Join a room" onClose={closeModal}>
          <form onSubmit={submitJoin}>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={5}
              autoFocus
            />{" "}
            <button type="submit">Enter room</button>
          </form>
          {roomState.error && <p style={{ color: "red" }}>{roomState.error}</p>}
        </Modal>
      )}
    </div>
  );
}
