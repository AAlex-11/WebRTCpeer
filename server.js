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
  { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
  // {  // Example TURN server config (replace with your own credentials)
  //   urls: "turn:your-turn-server.com:3478",
  //   username: "your-turn-username",
  //   credential: "your-turn-password",
  // },
];

wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  const clientPort = req.socket.remotePort;
  console.log(`Client connected to WebSocket: ${clientIP} ${clientPort}`);

  let peer;

  ws.on("message", (message) => {
    console.log("Message:", ws._socket.remoteAddress, ws._socket.remotePort);

    let signal;
    let isJson = true;

    try {
      signal = JSON.parse(message);
    } catch (error) {
      isJson = false;
      console.log("Received non-JSON message:", message);
      // Handle non-JSON messages here
      ws.send(JSON.stringify({ error: "Non-JSON message received", message: message }));
      return;
    }

    if (isJson) {
      // Log other properties of the signal object.
      console.log("Received signal:", {
        type: signal.type,
        sdp: signal.sdp, // Log SDP if available.
        candidate: signal.candidate, // Log candidate data.
        sdpMid: signal.candidate?.sdpMid, // Get sdpMid if available, otherwise it will be undefined.
        sdpMLineIndex: signal.candidate?.sdpMLineIndex, // Get sdpMLineIndex if available.
      });

      if (signal.type === "offer") {
        peer = new Peer({
          initiator: false,
          trickle: true,
          config: { iceServers },
          wrtc: wrtc,
        }); // Use the iceServers here

        wrtcPeers[peer._id] = peer; // Store if needed

        peer.on("connectionstatechange", () => {
          console.log("Connection state changed:", peer.connectionState);
        });

        peer.on("signal", (signalData) => {
          console.log("Sending signal:", signal);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(signal));
          }
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

        peer.on("datachannel", (event) => {
          console.log("DataChannel opened:", event.channel.label);

          event.channel.onmessage = (msg) => {
            console.log("Received DataChannel message:", msg.data);cd
          };
        });

        peer.on("track", (track, stream) => {
          console.log("Received track:", track);

          // Get a media stream from the peer connection, Access the video track (replace 'video' with 'audio' for audio tracks)
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            // Log the video track
            console.log("Video Track Kind:", videoTrack.kind); //Indicates the type of track ("video" or "audio").
            console.log("Video Track ID:", videoTrack.id); // A unique identifier for the track.
            console.log("Video Track Label:", videoTrack.label); //A descriptive label for the track (often the device name).
            console.log("Video Track Enabled:", videoTrack.enabled); //A boolean indicating whether the track is enabled.
            console.log("Video Track Ready State:", videoTrack.readyState); //Indicates the state of the track ("live", "ended", or "failed").
            if (typeof track.getSettings === "function") {
              console.log("Video Track Settings:", track.getSettings());
            } else {
              console.log("getSettings() is not available in this environment.");
            }
            console.log("Track Capabilities:", track.getCapabilities ? track.getCapabilities() : "Not supported");
            console.log("Track Constraints:", track.getConstraints ? track.getConstraints() : "Not supported");
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
