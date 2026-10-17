import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// Google's free STUN server: tells us our outside address
const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function App() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [peerStatus, setPeerStatus] = useState("Not connected");

  const peerRef = useRef(null); // the WebRTC connection
  const channelRef = useRef(null); // the data channel (used in Step 4)
  const pendingRef = useRef([]); // candidates that arrived too early

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
        </div>
      )}
    </div>
  );
}

export default App;
