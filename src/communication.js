// src/communication.js
// Manages the WebSocket connection to the brain's proxy.

class BrainSocket {
  constructor(url) {
    this.socket = null;
    this.url = url;
    this.onMessageCallback = null;
  }

  /**
   * Establishes the WebSocket connection and sets up event listeners.
   * @param {function} onMessageCallback - The function to call when a message is received from the brain.
   */
  connect(onMessageCallback) {
    this.onMessageCallback = onMessageCallback;
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log('✅ Connection to brain proxy established.');
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(data);
        }
      } catch (e) {
        console.error('Error parsing message from brain:', e);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    this.socket.onclose = () => {
      console.log('🛑 Connection to brain proxy closed.');
    };
  }

  /**
   * Sends data to the brain.
   * @param {object} data - The data object to send (e.g., { senses: {...}, reward: 0.1 }).
   */
  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      // console.warn('WebSocket is not open. Cannot send data.');
    }
  }
}

// Create and export a single instance to be used throughout the application.
const brainSocket = new BrainSocket('ws://localhost:8765');
export default brainSocket;