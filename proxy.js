// proxy.js
import { WebSocketServer } from 'ws';
import zmq from 'zeromq';

const brainPort = 9000;
const browserPort = 8765;

// --- 1. ZMQ Socket (to Python Brain) ---
const brainSocket = new zmq.Dealer();
brainSocket.connect(`tcp://localhost:${brainPort}`);
console.log(`ZMQ DEALER connected to tcp://localhost:${brainPort}`);

// --- 2. WebSocket Server (to Browser) ---
const browserWSS = new WebSocketServer({ port: browserPort });
console.log(`WebSocket Server listening on ws://localhost:${browserPort}`);

// --- 3. Unified Communication Logic ---
async function forwardBrainToBrowsers() {
  console.log("Brain-to-Browser forwarder is running.");
  for await (const [message] of brainSocket) {
    // --- DEBUG: Log message received from the brain ---
    console.log('\x1b[35m[BRAIN → PROXY] Received message from brain, forwarding to browser.\x1b[0m');
    
    browserWSS.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message.toString('utf-8'));
      }
    });
  }
}

browserWSS.on('connection', browserSocket => {
  console.log('Browser client connected.');

  browserSocket.on('message', message => {
    // --- DEBUG: Log message received from the browser ---
    console.log('\x1b[34m[BROWSER → PROXY] Received message from browser, forwarding to brain.\x1b[0m');
    brainSocket.send(message);
  });

  browserSocket.on('close', () => {
    console.log('Browser client disconnected.');
  });
});

forwardBrainToBrowsers();
