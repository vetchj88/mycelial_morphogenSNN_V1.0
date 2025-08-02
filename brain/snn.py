# brain/snn.py - FIXED MOTOR OUTPUT VERSION

import numpy as np
from brian2 import *
import builtins
from scipy.ndimage import gaussian_filter

class MorphogenicSNN:
    def __init__(self):
        self.dt = 1 * ms
        prefs.codegen.target = 'numpy'

        # --- UPDATED: Increased sensory neurons for wall detection ---
        self.n_total = 500
        self.n_vision_sensors = 30
        self.n_proprioception = 10
        self.n_wall_sensors = 5 # NEW
        self.n_sensory = self.n_vision_sensors + self.n_proprioception + self.n_wall_sensors
        self.n_motor = 20
        self.n_initial_inter = 100

        # --- Full Neuron and Synapse models ---
        lif_eqs = '''
        dv/dt = (-(v - v_rest) / tau) + I_input / tau + sigma * sqrt(2/tau) * xi : volt (unless refractory)
        dtheta/dt = -((theta - theta_rest) / tau_theta) : volt
        dI_input/dt = -I_input / tau_input : volt
        mycelial_influence : volt (constant)
        v_rest : volt
        tau : second
        tau_theta : second
        tau_input : second (constant)
        theta_rest : volt
        is_active : boolean (constant)
        last_spike : second
        theta_increase : volt (constant)
        sigma : volt (constant)
        neuron_type : integer (constant)
        '''
        
        synapse_model = '''
        w : 1
        dapre/dt = -apre / taupre : 1 (event-driven)
        dapost/dt = -apost / taupost : 1 (event-driven)
        dopamine : 1 (constant)
        taupre : second (constant)
        taupost : second (constant)
        plasticity_rate : 1 (constant)
        '''
        on_pre_eq = 'v_post += w * 80 * mV; I_input_post += w * 40 * mV; apre += Apre; w = clip(w + apost * dopamine * plasticity_rate, 0, w_max)'
        on_post_eq = 'apost += Apost; w = clip(w + apre * dopamine * plasticity_rate, 0, w_max)'
        synapse_namespace = { 'w_max': 0.15, 'Apre': 0.015, 'Apost': -0.012 }
        
        self.neurons = NeuronGroup(
            self.n_total, lif_eqs,
            threshold='v > theta + mycelial_influence',
            reset='v = v_rest; theta += theta_increase',
            refractory=5*ms, method='euler'
        )
        self.synapses = Synapses(self.neurons, self.neurons, model=synapse_model,
                                 on_pre=on_pre_eq, on_post=on_post_eq, namespace=synapse_namespace)

        # --- Full Initialization ---
        self.init_neurons()
        self.init_synapses()
        print("🍄 Initializing Mycelial Grid...")
        self.mycelial_grid_shape = (10, 10, 10)
        self.mycelial_grid = np.zeros(self.mycelial_grid_shape)
        self.neuron_positions = self._calculate_all_neuron_positions()
        self.neuron_to_mycelial_map = self._map_neurons_to_grid()
        self.all_spike_monitor = SpikeMonitor(self.neurons)
        self.net = Network(self.neurons, self.synapses, self.all_spike_monitor)
        self.reward_history = []
        self.step_count = 0
        self.newly_grown_neuron = None
        
        # --- DEBUG: Track motor activity ---
        self.motor_activity_history = []
        
        print(f"🧠 SNN initialized with Myco-Cortical layer.")

    def init_neurons(self):
        self.neurons.v = -70 * mV; self.neurons.v_rest = -70 * mV
        self.neurons.theta = -50 * mV; self.neurons.theta_rest = -50 * mV
        self.neurons.tau = 10 * ms; self.neurons.tau_theta = 100 * ms
        self.neurons.tau_input = 20 * ms; self.neurons.last_spike = -1 * second
        self.neurons.theta_increase = 0.5 * mV; self.neurons.I_input = 0 * mV
        self.neurons.mycelial_influence = 0 * mV; self.neurons.sigma = 2.0 * mV
        
        self.neurons.is_active = False
        self.neurons.neuron_type = 2 # Default to interneuron

        sensory_slice = slice(0, self.n_sensory)
        self.neurons.is_active[sensory_slice] = True
        self.neurons.neuron_type[sensory_slice] = 0
        self.neurons.sigma[sensory_slice] = 1.5 * mV
        
        motor_start = self.n_sensory
        motor_slice = slice(motor_start, motor_start + self.n_motor)
        self.neurons.is_active[motor_slice] = True
        self.neurons.neuron_type[motor_slice] = 1
        self.neurons.sigma[motor_slice] = 4.0 * mV  # INCREASED for more motor activity
        # FIXED: Make motor neurons more excitable
        self.neurons.theta[motor_slice] = -55 * mV  # Lower threshold
        self.neurons.v_rest[motor_slice] = -65 * mV  # Higher resting potential
        
        inter_start = motor_start + self.n_motor
        inter_slice = slice(inter_start, inter_start + self.n_initial_inter)
        self.neurons.is_active[inter_slice] = True

    def init_synapses(self):
        active_indices = np.where(self.neurons.is_active)[0]
        is_sensory = self.neurons.neuron_type[active_indices] == 0
        is_motor = self.neurons.neuron_type[active_indices] == 1
        is_inter = self.neurons.neuron_type[active_indices] == 2
        sensory_indices = active_indices[is_sensory]
        motor_indices = active_indices[is_motor]
        inter_indices = active_indices[is_inter]
        
        # IMPROVED: More connections to motor neurons
        for s_idx in sensory_indices: 
            self.synapses.connect(i=s_idx, j=inter_indices, p=0.4)
            # ADDED: Direct sensory to motor connections
            self.synapses.connect(i=s_idx, j=motor_indices, p=0.2)
        
        for m_idx in motor_indices: 
            self.synapses.connect(i=inter_indices, j=m_idx, p=0.5)  # INCREASED from 0.3
        
        self.synapses.connect(i=inter_indices, j=inter_indices, p=0.2)
        
        self.synapses.dopamine = 0.0
        self.synapses.w = 'rand() * 0.8 + 0.4'  # INCREASED weights
        self.synapses.taupre = 20 * ms; self.synapses.taupost = 20 * ms
        self.synapses.plasticity_rate = 'rand() * 0.5 + 0.5'

    def update(self, sensory_data, reward_signal):
        self.step_count += 1
        self.reward_history.append(reward_signal)
        self.newly_grown_neuron = None
        
        dopamine_level = self._calculate_dopamine(reward_signal)
        self.synapses.dopamine = dopamine_level
        
        self._process_sensory_input(sensory_data)
        self._update_mycelial_layer(dopamine_level)
        self._apply_mycelial_influence()
        
        old_spike_count = len(self.all_spike_monitor.i)
        self.net.run(self.dt)
        new_spikes = self.all_spike_monitor.i[old_spike_count:]

        if len(new_spikes) > 0:
            self.neurons.last_spike[new_spikes] = self.net.t

        if dopamine_level > 0.3 and np.random.random() < dopamine_level * 0.3:
            self._grow()

        motor_output = self._generate_motor_output(new_spikes)
        active_indices = np.where(self.neurons.is_active)[0]
        
        # DEBUG: Track motor activity
        self.motor_activity_history.append({
            'step': self.step_count,
            'motor_spikes': len([s for s in new_spikes if self.n_sensory <= s < self.n_sensory + self.n_motor]),
            'motor_output': motor_output,
            'total_spikes': len(new_spikes)
        })
        
        # Print debug info every 100 steps
        if self.step_count % 100 == 0:
            recent_activity = self.motor_activity_history[-10:]
            avg_motor_spikes = np.mean([a['motor_spikes'] for a in recent_activity])
            print(f"Step {self.step_count}: Avg motor spikes: {avg_motor_spikes:.1f}, Current output: {motor_output}")
        
        return motor_output, [int(x) for x in new_spikes], [int(x) for x in active_indices]

    def _calculate_all_neuron_positions(self):
        positions = np.zeros((self.n_total, 3))
        for i in range(self.n_total):
            pos = {}
            if i < self.n_vision_sensors:
                angle = (i / self.n_vision_sensors) * np.pi
                pos = {'x': np.cos(angle) * 3, 'y': np.sin(angle) * 1 + 2, 'z': -2}
            elif i < self.n_vision_sensors + self.n_proprioception:
                propIndex = i - self.n_vision_sensors
                pos = {'x': (propIndex % 5) * 0.4 - 1, 'y': np.floor(propIndex / 5) * 0.4 + 0.5, 'z': -1.5}
            elif i < self.n_sensory + self.n_motor:
                motorIndex = i - self.n_sensory
                pos = {'x': -2 if motorIndex < self.n_motor / 2 else 2, 'y': (motorIndex % (self.n_motor / 2)) * 0.3, 'z': 2}
            else:
                interIndex = i - (self.n_sensory + self.n_motor)
                if interIndex >= 0:
                    pos = {'x': (interIndex % 20 % 5) * 0.4 - 1, 'y': np.floor((interIndex % 20) / 5) * 0.3, 'z': np.floor(interIndex / 20) * 0.5 - 1}
            positions[i] = [pos.get('x',0), pos.get('y',0), pos.get('z',0)]
        return positions

    def _map_neurons_to_grid(self):
        pos_min, pos_max = self.neuron_positions.min(axis=0), self.neuron_positions.max(axis=0)
        norm_pos = (self.neuron_positions - pos_min) / (pos_max - pos_min + 1e-6)
        return (norm_pos * (np.array(self.mycelial_grid_shape) - 1)).astype(int)

    def _update_mycelial_layer(self, dopamine_level):
        self.mycelial_grid *= 0.995
        if dopamine_level > 0.5:
            spiked_indices = np.where(self.neurons.last_spike > (self.net.t - 20*ms))[0]
            if len(spiked_indices) > 0:
                coords = self.neuron_to_mycelial_map[spiked_indices]
                unique_coords = np.unique(coords, axis=0)
                for x, y, z in unique_coords: self.mycelial_grid[x, y, z] += 0.2 * dopamine_level
        self.mycelial_grid = gaussian_filter(self.mycelial_grid, sigma=0.8)
        np.clip(self.mycelial_grid, 0, 1.0, out=self.mycelial_grid)

    def _apply_mycelial_influence(self):
        coords = self.neuron_to_mycelial_map
        values = self.mycelial_grid[coords[:, 0], coords[:, 1], coords[:, 2]]
        self.neurons.mycelial_influence = values * -4 * mV

    def _calculate_dopamine(self, reward_signal):
        recent = self.reward_history[-10:] if self.reward_history else [0]
        expected = np.mean(recent)
        return np.clip((reward_signal - expected) + 0.1, 0, 1.0)

    def _process_sensory_input(self, sensory_data):
        if not sensory_data: return
        
        # ENHANCED: Add some baseline sensory input to encourage exploration
        self.neurons.I_input[0:5] += 10 * mV  # Base exploration input
        
        # Vision processing
        for key, start, end in [('sees', 0, 10), ('sees_left', 10, 20), ('sees_right', 20, 30)]:
            if sensory_data.get(key):
                color = sensory_data[key]
                dist_key = f'distance_{key.split("_")[-1]}' if '_' in key else 'distance'
                dist = sensory_data.get(dist_key, float('inf'))
                strength = __builtins__['max'](0.5, float(1.0 - dist / 20.0))
                if color == 'red': self.neurons.I_input[start:start+5] += strength * 80 * mV  # INCREASED
                elif color == 'blue': self.neurons.I_input[start+5:end] += strength * 60 * mV  # INCREASED
        
        # Proprioception processing - ENHANCED
        prop_start = self.n_vision_sensors
        pos = sensory_data.get('position', {})
        vel = sensory_data.get('velocity', {})
        x, z = pos.get('x') or 0, pos.get('z') or 0
        vx, vz = vel.get('x') or 0, vel.get('z') or 0
        orient = sensory_data.get('orientation') or 0
        
        self.neurons.I_input[prop_start:prop_start+2] += np.clip((x + 15)/30, 0, 1) * 60 * mV
        self.neurons.I_input[prop_start+2:prop_start+4] += np.clip((z + 15)/30, 0, 1) * 60 * mV
        self.neurons.I_input[prop_start+4:prop_start+6] += np.clip(np.sqrt(vx**2 + vz**2)/10, 0, 1) * 50 * mV
        self.neurons.I_input[prop_start+6:prop_start+8] += ((orient + np.pi) / (2 * np.pi)) * 45 * mV

        # Wall sensor processing - ENHANCED
        wall_start = self.n_vision_sensors + self.n_proprioception
        if sensory_data.get('sees_wall') and sensory_data.get('wall_distance') is not None:
            dist = sensory_data['wall_distance']
            strength = __builtins__['max'](0, float(1.0 - dist / 5.0))
            self.neurons.I_input[wall_start:wall_start + self.n_wall_sensors] += strength * 90 * mV  # INCREASED

    def _generate_motor_output(self, new_spikes):
        output = {'left': 0.0, 'right': 0.0}
        motor_start = self.n_sensory
        motor_end = motor_start + self.n_motor
        spiking_motors = new_spikes[(new_spikes >= motor_start) & (new_spikes < motor_end)]
        
        if len(spiking_motors) > 0:
            # FIXED: Correct boundary calculation
            boundary = motor_start + self.n_motor // 2
            left_spikes = len(spiking_motors[spiking_motors < boundary])
            right_spikes = len(spiking_motors[spiking_motors >= boundary])
            
            # IMPROVED: Better motor output scaling
            if left_spikes > 0: 
                output['left'] = float(builtins.min(1.0, left_spikes / 2.0))  # INCREASED sensitivity
            if right_spikes > 0: 
                output['right'] = float(builtins.min(1.0, right_spikes / 2.0))  # INCREASED sensitivity
        else:
            # ADDED: Fallback - add some random exploration if no motor spikes
            if np.random.random() < 0.05:  # 5% chance of random movement
                output['left'] = np.random.random() * 0.3
                output['right'] = np.random.random() * 0.3
        
        return output

    def _grow(self):
        inactive = np.where(self.neurons.is_active == False)[0]
        if len(inactive) == 0: return 
        new_idx = np.random.choice(inactive)
        self.neurons.is_active[new_idx] = True
        self.newly_grown_neuron = int(new_idx)
        
        active = np.where(self.neurons.is_active)[0]
        if len(active) >= 8:
            recent_active = [i for i in active if self.neurons.last_spike[i] > self.net.t - 20*ms]
            pool = recent_active if len(recent_active) >= 4 else active
            if len(pool) == 0: return

            n_conns = builtins.min(8, len(pool))
            n_from = builtins.min(n_conns // 2, len(pool))
            n_to = builtins.min(n_conns // 2, len(pool))
            if n_from == 0 and n_to == 0: return

            from_conns = np.random.choice(pool, n_from, replace=False)
            to_conns = np.random.choice(pool, n_to, replace=False)

            n_syn_before = len(self.synapses)
            if len(from_conns) > 0: self.synapses.connect(i=from_conns, j=new_idx)
            if len(to_conns) > 0: self.synapses.connect(i=new_idx, j=to_conns)
            n_syn_after = len(self.synapses)
            
            if n_syn_after > n_syn_before:
                new_syn_indices = slice(n_syn_before, n_syn_after)
                self.synapses.w[new_syn_indices] = 'rand() * 0.4 + 0.3'
                self.synapses.dopamine[new_syn_indices] = 0.0
                self.synapses.taupre[new_syn_indices] = 20 * ms
                self.synapses.taupost[new_syn_indices] = 20 * ms
                self.synapses.plasticity_rate[new_syn_indices] = 'rand() * 0.5 + 0.5'
        
        print(f"🌱 Grew neuron {new_idx}! Total active: {np.sum(self.neurons.is_active)}")

    def get_learning_stats(self):
        return {
            'total_neurons': int(np.sum(self.neurons.is_active)),
            'total_synapses': int(len(self.synapses)),
            'avg_recent_reward': float(np.mean(self.reward_history[-50:]) if len(self.reward_history) > 0 else 0),
            'step_count': int(self.step_count),
            'newly_grown_neuron': self.newly_grown_neuron
        }