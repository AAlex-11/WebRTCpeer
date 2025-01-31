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
    console.log("Client connected to WebSocket:", ws._socket.remoteAddress, ws._socket.remotePort);
    try {
      const signal = JSON.parse(message);
      // Log other properties of the signal object.
      console.log("Received signal:", {
        type: signal.type,
        sdp: signal.sdp, // Log SDP if available.
        candidate: signal.candidate, // Log candidate data.
        sdpMid: signal.candidate?.sdpMid, // Get sdpMid if available, otherwise it will be undefined.
        sdpMLineIndex: signal.candidate?.sdpMLineIndex, // Get sdpMLineIndex if available.
      });

      if (signal.type === "offer") {
        peer = new Peer({ initiator: false, trickle: true, config: { iceServers }, wrtc: wrtc }); // Use the iceServers here
        wrtcPeers[peer._id] = peer; // Store if needed

        peer.on("connectionstatechange", () => {
          console.log("Connection state changed:", peer.connectionState);
        });

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
          const mediaStream = stream;
          //Access the video track (replace 'video' with 'audio' for audio tracks)
          const videoTrack = mediaStream.getVideoTracks()[0];
          if (videoTrack) {
            // Log the video track
            console.log("Video Track Kind:", videoTrack.kind); //Indicates the type of track ("video" or "audio").
            console.log("Video Track ID:", videoTrack.id); // A unique identifier for the track.
            console.log("Video Track Label:", videoTrack.label); //A descriptive label for the track (often the device name).
            console.log("Video Track Enabled:", videoTrack.enabled); //A boolean indicating whether the track is enabled.
            console.log("Video Track Ready State:", videoTrack.readyState); //Indicates the state of the track ("live", "ended", or "failed").
            console.log("Video Track Settings:", videoTrack.getSettings()); //Returns an object containing the track's settings (e.g., resolution, frame rate).
            console.log("Video Track Capabilities:", videoTrack.getCapabilities()); // Returns an object describing the capabilities of the track (what settings are possible).
            console.log("Video Track Constraints:", videoTrack.getConstraints()); // Returns the constraints that were applied to the track.
            console.log("MediaStream ID:", stream.id); // Access MediaStream properties for additional context.
            console.log("MediaStream tracks:", stream.getTracks()); //Check if there are other tracks as well
          } else {
            console.log("No video track received.");
          }
        });

        peer.signal(signal); // Respond to the offer
        // All other signaling messages

      } else if (signal.type === "answer" && peer) {
        console.log("Received answer:", signal);
        peer.signal(signal);

      } else if (signal.type === "candidate" && peer) {
        try {
          console.log("Received ICE candidate:", signal);
          peer.signal(signal);
        } catch (error) {
          console.error("Error handling ICE candidate:", error, signal);
        }

      } else if (signal.type === "videoFrame" && peer) {
        console.log("Video frame received from client");
        console.log("Received video frame:", signal.frame);
        console.log("Received video frame type:", typeof signal.frame);
        console.log("Received video frame size:", signal.frame.length);
        console.log("Received video frame:", signal.frame.substring(0, 100)); //Logs a small portion (first 100 characters) of the frame data.
        // ... Further processing of the video frame (requires  FFmpeg decoding)
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
