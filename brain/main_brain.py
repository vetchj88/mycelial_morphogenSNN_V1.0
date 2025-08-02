# brain/main_brain.py - CORRECTED VERSION

import zmq
import json
import traceback
from snn import MorphogenicSNN

# --- 1. Server Configuration ---
ACKER_PORT = 9000
context = zmq.Context()
socket = context.socket(zmq.ROUTER)
socket.bind(f"tcp://*:{ACKER_PORT}")

print(f"🧠 Brain server started. Listening on tcp://*:{ACKER_PORT}")

# --- 2. Initialize SNN ---
snn = MorphogenicSNN()

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
        
        response_data = {
            'motor_commands': motor_output,
            'spikes': spikes,
            'active_neurons': active_neurons,
            'learning_stats': learning_stats, # This now includes newly_grown_neuron
            'mycelial_grid': snn.mycelial_grid.tolist(),
        }
        
        response_json = json.dumps(response_data)
        socket.send_multipart([identity, response_json.encode('utf-8')])

    except Exception as e:
        print(f"!!!!!!!! ERROR at step {step_count} !!!!!!!!")
        traceback.print_exc()
        if 'identity' in locals():
            error_response = json.dumps({'motor_commands': {'left': 0, 'right': 0}, 'spikes': [], 'active_neurons': []})
            socket.send_multipart([identity, error_response.encode('utf-8')])