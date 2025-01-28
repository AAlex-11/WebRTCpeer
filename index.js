import express from "express";
import Peer from "simple-peer";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const port = 3000;  // HTTP server port
const wssPort = 3001; // WebSocket server port

// Create the HTTP server
const server = http.createServer(app);

// Express routes (If you still need them for basic functionality)
app.get("/", (req, res) => {
  res.send("Hello from Express!");
});


let wrtcPeers = {}; // Make sure this is accessible to both HTTP and WS logic (if needed)


// WebSocket setup
const wss = new WebSocketServer({ port: wssPort });

wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");

  let peer;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "offer" && !peer) {
        peer = new Peer({ initiator: false, trickle: false }); // Create peer on offer
        wrtcPeers[peer._id] = peer; // Store if needed

        peer.on("signal", (signalData) => {
          ws.send(JSON.stringify({ type: "answer", answer: signalData }));
        });

        peer.signal(data.offer); // Handle the offer

      } else if (data.type === "answer" && peer) {
        peer.signal(data.answer); // Handle the answer
      }

    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  });


  ws.on("close", () => {
    console.log("Client disconnected");
    if (peer) {
      delete wrtcPeers[peer._id];
      peer.destroy(); // Properly clean up peer connection
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    if (peer) {
      delete wrtcPeers[peer._id];
      peer.destroy();
    }
  });
});




server.listen(port, () => {
  console.log(`HTTP server listening on port ${port}`);
});

console.log(`WebSocket server listening on port ${wssPort}`);