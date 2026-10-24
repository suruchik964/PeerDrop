import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const GRACE_MS = 15000; // how long a dropped device keeps its seat

// Which websites may connect. Online, set CLIENT_ORIGIN to your site's address
// (several addresses can be separated by commas). Without it, any site is allowed,
// which is fine while developing.
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
  : true;

const io = new Server(server, {
  cors: { origin: allowedOrigins },
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

// socket id -> { id, name, room, device, clientId, ghost, timer }
// ghost = true means the device dropped out and its seat is being held for a moment
const devices = new Map();

function roomExists(code) {
  return [...devices.values()].some((d) => d.room === code);
}

// Only send what other devices need to see (never the secret clientId or the timer)
function sendDeviceList(room) {
  const list = [...devices.values()]
    .filter((d) => d.room === room && !d.ghost)
    .map(({ id, name, room, device }) => ({ id, name, room, device }));
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
  const clientId = String(socket.handshake.auth?.clientId || "").slice(0, 64);

  // Is this a device that just reloaded? Look for its ghost.
  const ghost = clientId
    ? [...devices.values()].find((d) => d.ghost && d.clientId === clientId)
    : null;

  let entry;
  if (ghost) {
    // Welcome back: take over the old seat
    clearTimeout(ghost.timer);
    devices.delete(ghost.id);
    entry = {
      id: socket.id,
      name: ghost.name,
      room: ghost.room,
      device: ghost.device,
      clientId,
    };
    devices.set(socket.id, entry);
    socket.join(entry.room);
  } else {
    entry = {
      id: socket.id,
      name: randomName(),
      room: null,
      device: "",
      clientId,
    };
    devices.set(socket.id, entry);
  }

  socket.emit("welcome", {
    id: socket.id,
    name: entry.name,
    device: entry.device,
    room: entry.room, // not empty when we restored a seat
  });
  if (entry.room) sendDeviceList(entry.room);

  socket.on("set-profile", (profile) => {
    const { name: newName, device } = profile || {};
    const me = devices.get(socket.id);
    if (!me) return;

    const cleanName = String(newName || "")
      .trim()
      .slice(0, 20);
    if (cleanName) me.name = cleanName;
    me.device = String(device || "").slice(0, 40);

    socket.emit("profile-saved", { name: me.name, device: me.device });
    if (me.room) sendDeviceList(me.room);
  });

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

    // allow only 2 devices per room (a held seat counts too)
    const count = [...devices.values()].filter((d) => d.room === code).length;
    if (count >= 2) {
      socket.emit("room-error", "This room is full (2 devices max).");
      return;
    }

    enterRoom(socket, code);
  });

  socket.on("leave-room", () => {
    leaveRoom(socket);
    socket.emit("room-left");
  });

  socket.on("signal", ({ to, data }) => {
    const sender = devices.get(socket.id);
    const target = devices.get(to);
    if (!sender || !target || target.ghost || sender.room !== target.room)
      return;
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    const me = devices.get(socket.id);
    if (!me) return;

    if (!me.room) {
      devices.delete(socket.id); // not in a room, nothing to hold
      return;
    }

    // In a room: hold the seat for a moment in case this is just a reload
    me.ghost = true;
    sendDeviceList(me.room); // the other device stops seeing us
    me.timer = setTimeout(() => {
      devices.delete(me.id);
    }, GRACE_MS);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
