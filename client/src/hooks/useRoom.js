import { useEffect, useState } from "react";
import { socket } from "../socket";
import { getDeviceInfo } from "../utils/deviceInfo";

export function useRoom() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.on("welcome", (info) => {
      setMe(info);

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
    setMyName,
    createRoom: () => socket.emit("create-room"),
    joinRoom: (code) => socket.emit("join-room", code),
    leaveRoom: () => socket.emit("leave-room"),
  };
}
