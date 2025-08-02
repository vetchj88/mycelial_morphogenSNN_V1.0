// src/brain_visualizer.js - FIXED AND COMPLETE VERSION

import * as THREE from 'three';

export class BrainVisualizer {
  constructor(world, totalNeurons) {
    this.world = world;
    this.totalNeurons = totalNeurons;
    this.n_sensory = 40;
    this.n_motor = 20;
    this.n_vision_sensors = 30;
    
    this.neuronMeshes = [];
    this.mycelialCubes = [];
    this.learningDisplay = null;

    this.materials = {
      inactive: new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.3 }),
      sensory_vision: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      sensory_proprio: new THREE.MeshBasicMaterial({ color: 0x00cc88 }),
      motor_left: new THREE.MeshBasicMaterial({ color: 0xff0080 }),
      motor_right: new THREE.MeshBasicMaterial({ color: 0xff0040 }),
      inter_low: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
      inter_high: new THREE.MeshBasicMaterial({ color: 0xff8800 }),
      growing: new THREE.MeshBasicMaterial({ color: 0x00ffff, emissive: 0x00ffff }),
    };

    this.createVisualization();
    this.createLearningDisplay(); // This method is now fully implemented below
    this.setupActivityTracking();
  }

  setupActivityTracking() {
    this.activityHistory = new Map();
    this.recentlyGrown = new Set();
  }

  createVisualization() {
    const geometry = new THREE.SphereGeometry(0.06, 8, 8);
    this.brainGroup = new THREE.Group();
    for (let i = 0; i < this.totalNeurons; i++) {
        const mesh = new THREE.Mesh(geometry, this.materials.inactive.clone());
        mesh.position.copy(this.calculateNeuronPosition(i));
        this.neuronMeshes.push(mesh);
        this.brainGroup.add(mesh);
    }
    this.createMycelialGridViz(10, 10, 10);
    this.brainGroup.position.set(0, 8, 0);
    this.world.scene.add(this.brainGroup);
  }

  createMycelialGridViz(x, y, z) {
    const scale = 4.0;
    const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const material = new THREE.MeshBasicMaterial({ color: 0x9932CC, transparent: true, opacity: 0.0 });
    for (let i = 0; i < x*y*z; i++) {
        const cube = new THREE.Mesh(geometry, material.clone());
        const ix = i % x;
        const iy = Math.floor(i / x) % y;
        const iz = Math.floor(i / (x * y));
        cube.position.set(
            (ix / x - 0.5) * scale,
            (iy / y - 0.5) * scale,
            (iz / z - 0.5) * scale
        );
        this.mycelialCubes.push(cube);
        this.brainGroup.add(cube);
    }
  }

  update(brainData = {}) {
    const { active_neurons = [], spikes = [], learning_stats = {}, mycelial_grid = [] } = brainData;

    if (learning_stats && learning_stats.newly_grown_neuron !== null) {
        this.markNeuronAsGrown(learning_stats.newly_grown_neuron);
    }

    this.neuronMeshes.forEach((mesh) => { mesh.visible = false; });
    
    active_neurons.forEach(i => {
        if (this.neuronMeshes[i]) {
            this.neuronMeshes[i].visible = true;
            this.neuronMeshes[i].material = this.recentlyGrown.has(i) ? this.materials.growing : this.getInactiveMaterial(i);
        }
    });

    spikes.forEach(i => {
        if (this.neuronMeshes[i]) {
            this.neuronMeshes[i].material = this.getSpikeMaterial(i);
        }
    });

    this.updateLearningDisplay(learning_stats, active_neurons.length, spikes.length);
    this.updateMycelialGrid(mycelial_grid);
  }
  
  markNeuronAsGrown(neuronId) {
    this.recentlyGrown.add(neuronId);
    setTimeout(() => {
      this.recentlyGrown.delete(neuronId);
    }, 5000);
  }

  updateMycelialGrid(gridData) {
    if (!gridData || this.mycelialCubes.length === 0) return;
    const flatGrid = gridData.flat(2);
    flatGrid.forEach((value, index) => {
        if (this.mycelialCubes[index]) {
            this.mycelialCubes[index].material.opacity = Math.sqrt(value) * 0.4;
        }
    });
  }

  getInactiveMaterial(i) {
    if (i < this.n_vision_sensors) return this.materials.sensory_vision;
    if (i < this.n_sensory) return this.materials.sensory_proprio;
    if (i < this.n_sensory + this.n_motor / 2) return this.materials.motor_left;
    if (i < this.n_sensory + this.n_motor) return this.materials.motor_right;
    return this.materials.inactive;
  }

  getSpikeMaterial(i) {
    if (i < this.n_sensory) return this.materials.sensory_vision;
    if (i < this.n_sensory + this.n_motor) return this.materials.motor_right;
    return this.materials.inter_high;
  }

  calculateNeuronPosition(i) {
    if (i < this.n_vision_sensors) { const a = (i/this.n_vision_sensors)*Math.PI; return new THREE.Vector3(Math.cos(a)*3, Math.sin(a)*1+2, -2); }
    if (i < this.n_sensory) { const p = i-this.n_vision_sensors; return new THREE.Vector3((p%5)*0.4-1, Math.floor(p/5)*0.4+0.5, -1.5); }
    if (i < this.n_sensory+this.n_motor) { const m=i-this.n_sensory; return new THREE.Vector3(m<this.n_motor/2?-2:2, (m%(this.n_motor/2))*0.3, 2); }
    const n = i-this.n_sensory-this.n_motor; return new THREE.Vector3((n%20%5)*0.4-1, Math.floor((n%20)/5)*0.3, Math.floor(n/20)*0.5-1);
  }

  // --- RESTORED METHOD ---
  createLearningDisplay() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    this.displayContext = canvas.getContext('2d');
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const geometry = new THREE.PlaneGeometry(4, 2);
    
    this.learningDisplay = new THREE.Mesh(geometry, material);
    this.learningDisplay.position.set(5, 12, 0);
    this.world.scene.add(this.learningDisplay);
    this.displayTexture = texture;
  }

  // --- RESTORED METHOD ---
  updateLearningDisplay(learning_data, activeCount, spikeCount) {
    if (!this.displayContext) return;
    
    const ctx = this.displayContext;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 512, 256);
    
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('SNN Status', 20, 40);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    
    const stats = [
      `Active Neurons: ${learning_data?.total_neurons || activeCount || 'N/A'}`,
      `Synapses: ${learning_data?.total_synapses || 'N/A'}`,
      `Current Spikes: ${spikeCount || 0}`,
      `Avg Reward (50): ${(learning_data?.avg_recent_reward || 0).toFixed(4)}`
    ];
    
    stats.forEach((stat, index) => {
      ctx.fillText(stat, 20, 85 + index * 35);
    });
    
    if (learning_data?.newly_grown_neuron) {
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`🌱 Neuron #${learning_data.newly_grown_neuron} grew!`, 20, 230);
    }
    
    this.displayTexture.needsUpdate = true;
    this.learningDisplay.lookAt(this.world.camera.position);
  }
}
