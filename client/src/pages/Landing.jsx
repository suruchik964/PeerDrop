import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import NameBox from "../components/NameBox";
import Modal from "../components/Modal";

const features = [
  {
    icon: "⚡",
    title: "Direct transfer",
    text: "Files go straight from device to device. Nothing is uploaded to a server.",
  },
  {
    icon: "🔓",
    title: "No signup",
    text: "Open the page, share a code, and send. No account and no install.",
  },
  {
    icon: "✅",
    title: "Verified files",
    text: "Every file is checked with a fingerprint (SHA-256), so you know it arrived intact.",
  },
  {
    icon: "🌐",
    title: "Works anywhere",
    text: "A room code connects devices even when they are on different networks.",
  },
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
    roomState.createRoom();
    setModal("create");
  }

  function openJoin() {
    setCodeInput("");
    setModal("join");
  }

  function closeModal() {
    if (roomState.room) roomState.leaveRoom();
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
    <div className="min-h-screen">
      <header className="px-6 py-4">
        <Logo />
      </header>

      <main className="mx-auto max-w-xl px-4 pb-16 pt-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Send files <span className="text-indigo-400">directly</span> between
          devices
        </h1>
        <p className="mt-4 text-slate-400">
          No uploads and no accounts. The file goes straight from one device to
          the other.
        </p>

        <div className="mt-8">
          <NameBox me={roomState.me} onSave={roomState.setMyName} />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={openCreate}
            className="flex-1 rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500"
          >
            Create a room
          </button>
          <button
            onClick={openJoin}
            className="flex-1 rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800"
          >
            Join a room
          </button>
        </div>

        <h2 className="mb-4 mt-16 text-left text-xl font-semibold">Features</h2>
        <div className="grid gap-3 text-left sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <p className="text-2xl">{f.icon}</p>
              <p className="mt-2 font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs text-slate-600">
          Built with WebRTC, Socket.io and React
        </p>
      </main>

      {modal === "create" && (
        <Modal title="Your room is ready" onClose={closeModal}>
          {roomState.room ? (
            <div>
              <p className="text-sm text-slate-400">
                Share this code with the other person:
              </p>
              <p className="my-4 text-center font-mono text-4xl font-bold tracking-widest">
                {roomState.room}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyCode}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2 font-medium hover:bg-slate-600"
                >
                  {copied ? "Copied!" : "Copy code"}
                </button>
                <button
                  onClick={() => navigate(`/room/${roomState.room}`)}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500"
                >
                  Enter room
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">Creating room...</p>
          )}
        </Modal>
      )}

      {modal === "join" && (
        <Modal title="Join a room" onClose={closeModal}>
          <form onSubmit={submitJoin}>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              maxLength={5}
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-indigo-500"
            />
            {roomState.error && (
              <p className="mt-2 text-sm text-red-400">{roomState.error}</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500"
            >
              Enter room
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
