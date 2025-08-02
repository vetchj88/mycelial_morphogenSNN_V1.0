# brain/main_brain.py - CORRECTED VERSION

import zmq
import json
import traceback
from snn import MorphogenicSNN
import threading
import time

# --- 1. Server Configuration ---
ACKER_PORT = 9000
context = zmq.Context()
socket = context.socket(zmq.ROUTER)
socket.bind(f"tcp://*:{ACKER_PORT}")

print(f"🧠 Brain server started. Listening on tcp://*:{ACKER_PORT}")

# --- 2. Initialize SNN ---
snn = MorphogenicSNN()

# --- NEW: Passive data collection for visualization ---
latest_synapse_data = []
data_lock = threading.Lock()

def collect_visualization_data():
    """
    Periodically collects synapse data in a background thread
    to avoid slowing down the main simulation loop.
    """
    global latest_synapse_data
    while True:
        syn_data = snn.get_synapse_data()
        with data_lock:
            latest_synapse_data = syn_data
        time.sleep(0.5) # Update visualization data every 500ms

# Start the background data collection thread
vis_thread = threading.Thread(target=collect_visualization_data, daemon=True)
vis_thread.start()
print("🛰️  Started passive data collection thread for visualization.")


# --- 3. Main Server Loop ---
step_count = 0
while True:
    try:
        [identity, message_bytes] = socket.recv_multipart()
        step_count += 1
        
        message = json.loads(message_bytes.decode('utf-8'))
        sensory_data = message.get('senses', {})
        reward_signal = message.get('reward', 0.0)

        motor_output, spikes, active_neurons = snn.update(sensory_data, reward_signal)
        
        # --- Get stats AFTER the update, which may include a new neuron ---
        learning_stats = snn.get_learning_stats()
        
        # --- NEW: Get synapse data from the passive collector ---
        with data_lock:
            synapse_data = latest_synapse_data
        
        response_data = {
            'motor_commands': motor_output,
            'spikes': spikes,
            'active_neurons': active_neurons,
            'learning_stats': learning_stats,
            'mycelial_grid': snn.mycelial_grid.tolist(),
            'synapses': synapse_data, # <-- Now passively collected
        }
        
        response_json = json.dumps(response_data)
        socket.send_multipart([identity, response_json.encode('utf-8')])

    except Exception as e:
        print(f"!!!!!!!! ERROR at step {step_count} !!!!!!!!")
        traceback.print_exc()
        if 'identity' in locals():
            error_response = json.dumps({'motor_commands': {'left': 0, 'right': 0}, 'spikes': [], 'active_neurons': []})
            socket.send_multipart([identity, error_response.encode('utf-8')])
