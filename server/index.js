import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// Socket.io sits on top of the same HTTP server
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" }, // allow our client
});

// A normal HTTP route, just to check the server is alive
app.get("/", (req, res) => {
  res.send("PeerDrop signaling server is running");
});

// Runs every time a device connects
io.on("connection", (socket) => {
  console.log("Device connected:", socket.id);

  // Listen for a "hello" event from this device
  socket.on("hello", (msg) => {
    console.log("Message from", socket.id, ":", msg);
    socket.emit("hello-reply", `Server received: ${msg}`);
  });

  socket.on("disconnect", () => {
    console.log("Device disconnected:", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
