import WebSocket from 'ws';
import Peer from 'simple-peer';
import wrtc from 'wrtc';  // Import the wrtc module

const wsUrl = 'ws://127.0.0.1:3000'; // Replace with your server's WebSocket URL
const ws = new WebSocket(wsUrl);


ws.onopen = () => {
    console.log('Connected to signaling server:', wsUrl);

    const peer = new Peer({
        initiator: true,  // Client initiates the connection
        trickle: true,     // Enable trickle ICE
        wrtc: wrtc,       // Use the wrtc WebRTC implementation
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }, // STUN server
                // Add TURN servers here if needed
            ]
        }
    });


    ws.onmessage = (event) => {
        if (!peer) return;
        const signal = JSON.parse(event.data);
        console.log('Received signal:', signal);
        peer.signal(signal);
    };


    peer.on('signal', signal => {
        console.log('Sending signal:', signal);


        if (ws && ws.readyState === WebSocket.OPEN) { // Send signal data via WebSocket
            ws.send(JSON.stringify(signal));
        }

    });


    peer.on('connect', () => {
        console.log('Connected to peer!');
        // ... send data, media streams, etc.
    });



    peer.on('track', (track, stream) => {
        console.log('Received track:', track);


        // ... handle the incoming media track (e.g., add to a <video> element)

    });



    peer.on('data', data => { // If using data channels.
        console.log('Received data:', data);


    });


    peer.on('error', err => {
        console.error('Peer error:', err);
    });



    ws.onclose = () => { // Handle WebSocket closure.  Clean up if needed
        console.log("WebSocket connection closed.");
        if (peer) {
          peer.destroy();
        }
    }

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    }

};
