import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" },
});

app.get("/", (req, res) => {
  res.send("PeerDrop signaling server is running");
});

// ---------- helpers ----------

const adjectives = ["Blue", "Calm", "Brave", "Happy", "Swift", "Gentle"];
const animals = ["Tiger", "Otter", "Panda", "Falcon", "Fox", "Koala"];

function randomName() {
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const b = animals[Math.floor(Math.random() * animals.length)];
  return `${a} ${b}`;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const devices = new Map(); // socket id -> { id, name, room }

function roomExists(code) {
  return [...devices.values()].some((d) => d.room === code);
}

function sendDeviceList(room) {
  const list = [...devices.values()].filter((d) => d.room === room);
  io.to(room).emit("device-list", list);
}

function leaveRoom(socket) {
  const device = devices.get(socket.id);
  if (!device || !device.room) return;
  const oldRoom = device.room;
  socket.leave(oldRoom);
  device.room = null;
  sendDeviceList(oldRoom);
}

function enterRoom(socket, code) {
  leaveRoom(socket);
  const device = devices.get(socket.id);
  device.room = code;
  socket.join(code);
  socket.emit("room-joined", code);
  sendDeviceList(code);
}

// ---------- connections ----------

io.on("connection", (socket) => {
  const name = randomName();
  devices.set(socket.id, { id: socket.id, name, room: null });
  socket.emit("welcome", { id: socket.id, name });

  socket.on("create-room", () => {
    let code = makeCode();
    while (roomExists(code)) code = makeCode();
    enterRoom(socket, code);
  });

  socket.on("join-room", (input) => {
    const code = String(input).trim().toUpperCase();
    if (!roomExists(code)) {
      socket.emit("room-error", "Room not found. Check the code.");
      return;
    }
    enterRoom(socket, code);
  });

  socket.on("leave-room", () => {
    leaveRoom(socket);
    socket.emit("room-left");
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
    devices.delete(socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
