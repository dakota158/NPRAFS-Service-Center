const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("update", (data) => {
    io.emit("sync", data);
  });
});

server.listen(4000, () => console.log("Sync running"));