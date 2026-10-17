import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// Google's free STUN server: tells us our outside address
const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const CHUNK_SIZE = 16 * 1024;       // size of each piece: 16 KB
const MAX_SIZE = 5 * 1024 * 1024;   // temporary limit: 5 MB

function App() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [peerStatus, setPeerStatus] = useState("Not connected");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [received, setReceived] = useState([]);
  const [sendProgress, setSendProgress] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);

  const peerRef = useRef(null); // the WebRTC connection
  const channelRef = useRef(null); // the data channel (used in Step 4)
  const pendingRef = useRef([]); // candidates that arrived too early
  const incomingRef = useRef(null);

  // Make a new connection object aimed at one specific device
  function createPeer(targetId) {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", {
          to: targetId,
          data: { candidate: e.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setPeerStatus("Connection failed");
      if (pc.connectionState === "disconnected") setPeerStatus("Disconnected");
    };

    peerRef.current = pc;
    pendingRef.current = [];
    return pc;
  }

  function setupChannel(channel) {
    channelRef.current = channel;
    channel.onopen = () => setPeerStatus("Connected directly!");
    channel.onclose = () => setPeerStatus("Channel closed");
    channel.binaryType = "arraybuffer";
    channel.onmessage = (e) => {
      if (typeof e.data === "string") {
        const msg = JSON.parse(e.data);
        if (msg.type === "chat") {
          setMessages((m) => [...m, { from: "them", text: msg.text }]);
        } else if (msg.type === "file-meta") {
          // A file is about to arrive: prepare an empty list for its pieces
          incomingRef.current = { ...msg, chunks: [], received: 0 };
          setReceiveProgress(0);
        }
      } else {
        // This is one piece of the file
        const meta = incomingRef.current;
        meta.chunks.push(e.data);
        meta.received += e.data.byteLength;
        setReceiveProgress(Math.round((meta.received / meta.size) * 100));

        if (meta.received >= meta.size) {
          // Got everything: join the pieces into one file
          const blob = new Blob(meta.chunks, { type: meta.mime });
          const url = URL.createObjectURL(blob);
          setReceived((r) => [...r, { name: meta.name, size: meta.size, url }]);
          incomingRef.current = null;
          setReceiveProgress(null);
        }
      }
    };
  }

  function sendMessage() {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open" || !text.trim()) return;
    channel.send(JSON.stringify({ type: "chat", text }));
    setMessages((m) => [...m, { from: "me", text }]);
    setText("");
  }

  async function sendFile(e) {
    const file = e.target.files[0];
    const channel = channelRef.current;
    e.target.value = "";
    if (!file || !channel || channel.readyState !== "open") return;

    if (file.size === 0) {
      alert("This file is empty.");
      return;
    }
    if (file.size > MAX_SIZE) {
      alert(
        "For now, choose a file under 5 MB. Bigger files come in the next step.",
      );
      return;
    }

    // 1. Tell the other side what is coming
    channel.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );

    // 2. Cut the file into pieces and send them one by one
    let offset = 0;
    setSendProgress(0);
    while (offset < file.size) {
      const piece = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      channel.send(piece);
      offset += piece.byteLength;
      setSendProgress(Math.round((offset / file.size) * 100));
    }

    setSendProgress(null);
    setMessages((m) => [...m, { from: "me", text: `Sent file: ${file.name}` }]);
  }

  // Candidates can only be added after the other side's card is set
  async function flushCandidates() {
    for (const c of pendingRef.current) {
      await peerRef.current.addIceCandidate(c);
    }
    pendingRef.current = [];
  }

  // The caller starts here
  async function connectTo(targetId) {
    setPeerStatus("Connecting...");
    const pc = createPeer(targetId);
    setupChannel(pc.createDataChannel("files"));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", {
      to: targetId,
      data: { description: pc.localDescription },
    });
  }

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

    // Messages from the other device, carried by our server
    socket.on("signal", async ({ from, data }) => {
      if (data.description) {
        if (data.description.type === "offer") {
          // We are the receiver
          setPeerStatus("Connecting...");
          const pc = createPeer(from);
          pc.ondatachannel = (e) => setupChannel(e.channel);
          await pc.setRemoteDescription(data.description);
          await flushCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", {
            to: from,
            data: { description: pc.localDescription },
          });
        } else {
          // We are the caller and the answer arrived
          await peerRef.current.setRemoteDescription(data.description);
          await flushCandidates();
        }
      } else if (data.candidate) {
        const pc = peerRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(data.candidate);
        } else {
          pendingRef.current.push(data.candidate); // too early, keep it for later
        }
      }
    });

    return () => {
      socket.off("welcome");
      socket.off("room-joined");
      socket.off("room-left");
      socket.off("room-error");
      socket.off("device-list");
      socket.off("signal");
    };
  }, []);

  const others = devices.filter((d) => d.id !== me?.id);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>PeerDrop</h1>
      <p>{me ? `You are ${me.name}` : "Connecting to server..."}</p>

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
              <li key={d.id}>
                {d.name}{" "}
                <button onClick={() => connectTo(d.id)}>Connect</button>
              </li>
            ))}
          </ul>

          <p>
            <b>Direct connection:</b> {peerStatus}
          </p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
          />
          <button onClick={sendMessage}>Send</button>

          <p>
            Send a file: <input type="file" onChange={sendFile} />
          </p>

          {sendProgress !== null && (
            <p>
              Sending: {sendProgress}%{" "}
              <progress value={sendProgress} max="100" />
            </p>
          )}
          {receiveProgress !== null && (
            <p>
              Receiving: {receiveProgress}%{" "}
              <progress value={receiveProgress} max="100" />
            </p>
          )}

          <h3>Received files</h3>
          <ul>
            {received.map((f, i) => (
              <li key={i}>
                <a href={f.url} download={f.name}>
                  {f.name}
                </a>{" "}
                ({f.size} bytes)
              </li>
            ))}
          </ul>

          <ul>
            {messages.map((m, i) => (
              <li key={i}>
                <b>{m.from === "me" ? "You" : "Them"}:</b> {m.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
