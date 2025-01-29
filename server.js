import express from "express";
import Peer from "simple-peer";
import { WebSocketServer } from "ws";
import http from "http";
import wrtc from "wrtc";

const app = express();
const port = 3000; // Single port for both HTTP and WebSockets

const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // WebSocket server shares the HTTP server

app.get("/", (req, res) => {
  res.send("Hello from Express!");
});

let wrtcPeers = {};

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" }, // Free STUN server by Google
  // {  // Example TURN server config (replace with your own credentials)
  //   urls: "turn:your-turn-server.com:3478",
  //   username: "your-turn-username",
  //   credential: "your-turn-password",
  // },
];

wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");

  let peer;

  ws.on("message", (message) => {
    try {
      const signal = JSON.parse(message);

      if (signal.type === "offer") {
        peer = new Peer({ initiator: false, trickle: true, config: { iceServers }, wrtc: wrtc }); // Use the iceServers here
        wrtcPeers[peer._id] = peer; // Store if needed

        peer.on("signal", (signalData) => {
          ws.send(JSON.stringify(signalData)); // Send the entire signalData object
        });

        //Important event handlers for debugging and monitoring:
        peer.on("connect", () => {
          console.log("Peer connected");
        });

        peer.on("close", () => {
          console.log("Peer closed");
          if (peer) {
            delete wrtcPeers[peer._id];
            peer.destroy();
          }
        });

        peer.on("error", (err) => {
          console.error("Peer error:", err);
          if (peer) {
            delete wrtcPeers[peer._id];
            peer.destroy();
          }
        });

        peer.on("track", (track, stream) => {
          console.log("Received track:", track); // Log received track (for audio/video)
          // Get a media stream from the peer connection
          const mediaStream = stream; // Assuming this works in your setup
          //Access the video track (replace 'video' with 'audio' for audio tracks)
          const videoTrack = mediaStream.getVideoTracks()[0];
          // Log the video track
          console.log("Video Track:", videoTrack);
        });

        peer.signal(signal); // Respond to the offer

        // All other signaling messages
      } else if (signal.type === "answer" && peer) {
        // Explicitly handle the answer
        console.log("Received answer:", signal); // Log the answer
        peer.signal(signal);
      } else if (signal.type === "candidate" && peer) {
        // Explicit ICE candidate handling
        peer.signal(signal);
        console.log("Received ICE candidate:", signal);
      } else if (peer) {
        console.log("Unknown signal type:", signal);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (peer) {
      delete wrtcPeers[peer._id];
      peer.destroy();
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

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
