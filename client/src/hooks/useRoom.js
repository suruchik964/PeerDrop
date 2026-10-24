import { useEffect, useState } from "react";
import { socket } from "../socket";
import { getDeviceInfo } from "../utils/deviceInfo";

export function useRoom() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false); // has the server told us the situation yet?
  const [serverOnline, setServerOnline] = useState(socket.connected);

  useEffect(() => {
    socket.on("connect", () => setServerOnline(true));
    socket.on("disconnect", () => setServerOnline(false));

    socket.on("welcome", (info) => {
      setMe({ id: info.id, name: info.name, device: info.device });
      setRoom(info.room || null); // restored after a reload
      if (!info.room) setDevices([]);
      setReady(true);

      // If this browser saved a name earlier, tell the server about it
      let saved = "";
      try {
        saved = localStorage.getItem("peerdrop-name") || "";
      } catch {
        // storage can be blocked, so just carry on
      }
      socket.emit("set-profile", { name: saved, device: getDeviceInfo() });
    });

    socket.on("profile-saved", (p) =>
      setMe((m) => ({ ...(m || {}), name: p.name, device: p.device })),
    );

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
      socket.off("connect");
      socket.off("disconnect");
      socket.off("welcome");
      socket.off("profile-saved");
      socket.off("room-joined");
      socket.off("room-left");
      socket.off("room-error");
      socket.off("device-list");
    };
  }, []);

  function setMyName(name) {
    const clean = name.trim();
    if (!clean) return;
    try {
      localStorage.setItem("peerdrop-name", clean);
    } catch {
      // ignore
    }
    socket.emit("set-profile", { name: clean, device: getDeviceInfo() });
  }

  const others = devices.filter((d) => d.id !== me?.id);

  return {
    me,
    room,
    others,
    error,
    ready,
    serverOnline,
    setMyName,
    createRoom: () => socket.emit("create-room"),
    joinRoom: (code) => socket.emit("join-room", code),
    leaveRoom: () => socket.emit("leave-room"),
  };
}
