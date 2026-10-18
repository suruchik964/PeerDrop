import { useEffect, useState } from "react";
import { socket } from "../socket";

export function useRoom() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);
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

  return {
    me,
    room,
    others,
    error,
    createRoom: () => socket.emit("create-room"),
    joinRoom: (code) => socket.emit("join-room", code),
    leaveRoom: () => socket.emit("leave-room"),
  };
}
