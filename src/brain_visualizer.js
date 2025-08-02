// src/brain_visualizer.js - PERFORMANCE OPTIMIZED VERSION

import * as THREE from 'three';

export class BrainVisualizer {
  constructor(world, totalNeurons) {
    this.world = world;
    this.totalNeurons = totalNeurons;
    this.n_sensory = 40;
    this.n_motor = 20;
    this.n_vision_sensors = 30;
    
    this.neuronMeshes = [];
    this.synapseMeshes = [];
    this.synapseLines = [];
    this.mycelialCubes = [];
    this.activityParticles = [];
    this.learningDisplay = null;
    this.networkGraph = null;
    
    // PERFORMANCE: Synapse caching and update throttling
    this.synapseCache = new Map();
    this.lastSynapseUpdate = 0;
    this.synapseUpdateInterval = 500; // Update synapses every 500ms instead of every frame
    this.synapseUpdateQueue = [];
    this.synapseWorker = null;
    this.maxSynapsesPerFrame = 50; // Limit synapse operations per frame
    
    // Enhanced materials
    this.materials = {
      inactive: new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.3 }),
      sensory_vision: new THREE.MeshLambertMaterial({ color: 0x00ff00, emissive: 0x001100 }),
      sensory_proprio: new THREE.MeshLambertMaterial({ color: 0x00cc88, emissive: 0x001111 }),
      motor_left: new THREE.MeshLambertMaterial({ color: 0xff0080, emissive: 0x110008 }),
      motor_right: new THREE.MeshLambertMaterial({ color: 0xff0040, emissive: 0x110004 }),
      inter_low: new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0x111100 }),
      inter_medium: new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: 0x110800 }),
      inter_high: new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0x110400 }),
      growing: new THREE.MeshLambertMaterial({ color: 0x00ffff, emissive: 0x00ffff, transparent: true }),
      spiking: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff }),
      
      // Synapse materials - optimized with shared instances
      synapse_weak: new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.2 }),
      synapse_medium: new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.4 }),
      synapse_strong: new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 }),
      synapse_active: new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 }),
      synapse_inhibitory: new THREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 }),
      synapse_excitatory: new THREE.LineBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.6 })
    };

    this.createVisualization();
    this.createNetworkTopology();
    this.createActivitySystem();
    this.createEnhancedLearningDisplay();
    this.setupActivityTracking();
    this.createControlPanel();
    this.initSynapseOptimization();
  }

  initSynapseOptimization() {
    // PERFORMANCE: Initialize synapse update system
    this.synapseUpdateStats = {
      totalUpdates: 0,
      avgUpdateTime: 0,
      lastFrameTime: 0
    };

    // Pre-create geometry pool for reuse
    this.synapseGeometryPool = [];
    for (let i = 0; i < 1000; i++) {
      const geometry = new THREE.BufferGeometry();
      this.synapseGeometryPool.push(geometry);
    }
    this.geometryPoolIndex = 0;

    console.log('🚀 Synapse optimization system initialized');
  }

  setupActivityTracking() {
    this.activityHistory = new Map();
    this.recentlyGrown = new Set();
    this.synapseActivity = new Map();
    this.neuronActivity = new Map();
    this.lastSpikes = [];
    this.neuronFireRates = new Map();
    
    // Visualization settings
    this.settings = {
      showSynapses: true,
      showWeakSynapses: false,
      showActivityFlow: true,
      showNeuronLabels: false,
      synapseThreshold: 0.1,
      activityDecay: 0.95,
      maxConnections: 500, // REDUCED from 1000 for better performance
      colorByActivity: true,
      showStats: true,
      
      // PERFORMANCE: New performance settings
      synapseUpdateFrequency: 500, // ms
      batchUpdateSize: 25,
      enableSynapseCache: true,
      maxVisibleSynapses: 300 // Hard limit for performance
    };
  }

  createVisualization() {
    this.brainGroup = new THREE.Group();
    
    // Enhanced neuron visualization
    for (let i = 0; i < this.totalNeurons; i++) {
      const neuronGroup = new THREE.Group();
      
      // Main neuron sphere with size based on importance
      const size = this.getNeuronSize(i);
      const geometry = new THREE.IcosahedronGeometry(size, 1);
      const mesh = new THREE.Mesh(geometry, this.materials.inactive.clone());
      mesh.position.copy(this.calculateNeuronPosition(i));
      mesh.userData = { neuronId: i, type: this.getNeuronType(i) };
      
      // Add glow effect for active neurons
      const glowGeometry = new THREE.IcosahedronGeometry(size * 1.2, 1);
      const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0 
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      
      neuronGroup.add(mesh);
      neuronGroup.add(glowMesh);
      
      this.neuronMeshes.push({ 
        main: mesh, 
        glow: glowMesh, 
        group: neuronGroup,
        activity: 0,
        lastSpike: 0
      });
      
      this.brainGroup.add(neuronGroup);
    }
    
    this.createMycelialGridViz(12, 12, 12);
    this.brainGroup.position.set(0, 8, 0);
    this.world.scene.add(this.brainGroup);
  }

  createNetworkTopology() {
    this.synapseGroup = new THREE.Group();
    this.connectionMap = new Map();
    this.brainGroup.add(this.synapseGroup);
  }

  // PERFORMANCE: Optimized synapse update with caching and throttling
  updateSynapses(synapseData) {
    if (!synapseData || !this.settings.showSynapses) return;
    
    const currentTime = Date.now();
    
    // THROTTLING: Only update synapses periodically, not every frame
    if (currentTime - this.lastSynapseUpdate < this.settings.synapseUpdateFrequency) {
      return;
    }
    
    this.lastSynapseUpdate = currentTime;
    const startTime = performance.now();
    
    // CACHING: Check if synapse data has actually changed
    const synapseHash = this.hashSynapseData(synapseData);
    if (this.settings.enableSynapseCache && this.lastSynapseHash === synapseHash) {
      return; // No changes, skip update
    }
    this.lastSynapseHash = synapseHash;
    
    this.updateSynapsesOptimized(synapseData);
    
    // Update performance stats
    const updateTime = performance.now() - startTime;
    this.synapseUpdateStats.totalUpdates++;
    this.synapseUpdateStats.avgUpdateTime = 
      (this.synapseUpdateStats.avgUpdateTime * (this.synapseUpdateStats.totalUpdates - 1) + updateTime) 
      / this.synapseUpdateStats.totalUpdates;
    
    console.log(`🔗 Synapse update completed in ${updateTime.toFixed(2)}ms (avg: ${this.synapseUpdateStats.avgUpdateTime.toFixed(2)}ms)`);
  }

  hashSynapseData(synapseData) {
    // Simple hash to detect if synapse data has changed
    if (!Array.isArray(synapseData)) return 0;
    let hash = 0;
    for (let i = 0; i < Math.min(synapseData.length, 100); i++) { // Only hash first 100 for performance
      const syn = synapseData[i];
      hash += (syn.pre || 0) * 1000 + (syn.post || 0) * 100 + Math.floor((syn.weight || 0) * 1000);
    }
    return hash;
  }

  updateSynapsesOptimized(synapseData) {
    // PERFORMANCE: Smart incremental updates instead of full rebuild
    const maxVisible = this.settings.maxVisibleSynapses;
    const batchSize = this.settings.batchUpdateSize;
    
    // Sort synapses by strength for selective display
    const sortedSynapses = Array.isArray(synapseData) ? 
      synapseData
        .filter(syn => Math.abs(syn.weight || 0) >= this.settings.synapseThreshold || this.settings.showWeakSynapses)
        .sort((a, b) => Math.abs(b.weight || 0) - Math.abs(a.weight || 0))
        .slice(0, maxVisible) : [];
    
    // BATCH PROCESSING: Update synapses in small batches to avoid frame drops
    this.processSynapseBatch(sortedSynapses, 0, batchSize);
  }

  processSynapseBatch(synapseData, startIndex, batchSize) {
    const endIndex = Math.min(startIndex + batchSize, synapseData.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const synapse = synapseData[i];
      this.updateSingleSynapse(synapse);
    }
    
    // Continue processing in next frame if there are more synapses
    if (endIndex < synapseData.length) {
      requestAnimationFrame(() => {
        this.processSynapseBatch(synapseData, endIndex, batchSize);
      });
    } else {
      // Clean up unused synapses after all batches are processed
      this.cleanupUnusedSynapses(synapseData);
    }
  }

  updateSingleSynapse(synapse) {
    const { pre, post, weight = 0, active = false } = synapse;
    const connectionKey = `${pre}-${post}`;
    
    if (!this.neuronMeshes[pre] || !this.neuronMeshes[post]) return;
    if (Math.abs(weight) < this.settings.synapseThreshold && !this.settings.showWeakSynapses) {
      // Remove if exists and below threshold
      if (this.connectionMap.has(connectionKey)) {
        this.removeSynapse(connectionKey);
      }
      return;
    }
    
    // Check if synapse already exists and unchanged
    const existing = this.connectionMap.get(connectionKey);
    if (existing && existing.weight === weight && existing.active === active) {
      return; // No changes needed
    }
    
    // Create or update synapse
    if (existing) {
      this.updateExistingSynapse(connectionKey, synapse);
    } else {
      this.createNewSynapse(connectionKey, synapse);
    }
  }

  createNewSynapse(connectionKey, synapse) {
    const { pre, post, weight, active } = synapse;
    const startPos = this.neuronMeshes[pre].main.position;
    const endPos = this.neuronMeshes[post].main.position;
    
    // Reuse geometry from pool if available
    let geometry;
    if (this.geometryPoolIndex < this.synapseGeometryPool.length) {
      geometry = this.synapseGeometryPool[this.geometryPoolIndex++];
      geometry.setFromPoints([startPos, endPos]);
    } else {
      geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    }
    
    const material = this.getSynapseMaterial(weight, active);
    const line = new THREE.Line(geometry, material);
    line.userData = { pre, post, weight, active, type: 'synapse' };
    
    this.synapseGroup.add(line);
    this.synapseLines.push(line);
    this.connectionMap.set(connectionKey, { weight, active, line });
  }

  updateExistingSynapse(connectionKey, synapse) {
    const { weight, active } = synapse;
    const connection = this.connectionMap.get(connectionKey);
    
    if (connection && connection.line) {
      // Update material based on new properties
      const newMaterial = this.getSynapseMaterial(weight, active);
      connection.line.material = newMaterial;
      
      // Update stored data
      connection.weight = weight;
      connection.active = active;
      connection.line.userData.weight = weight;
      connection.line.userData.active = active;
    }
  }

  removeSynapse(connectionKey) {
    const connection = this.connectionMap.get(connectionKey);
    if (connection && connection.line) {
      this.synapseGroup.remove(connection.line);
      
      // Return geometry to pool if possible
      if (this.geometryPoolIndex > 0) {
        this.geometryPoolIndex--;
        this.synapseGeometryPool[this.geometryPoolIndex] = connection.line.geometry;
      } else {
        connection.line.geometry.dispose();
      }
      
      connection.line.material.dispose();
      
      const lineIndex = this.synapseLines.indexOf(connection.line);
      if (lineIndex > -1) {
        this.synapseLines.splice(lineIndex, 1);
      }
    }
    this.connectionMap.delete(connectionKey);
  }

  cleanupUnusedSynapses(currentSynapseData) {
    const currentKeys = new Set(currentSynapseData.map(syn => `${syn.pre}-${syn.post}`));
    const keysToRemove = [];
    
    this.connectionMap.forEach((connection, key) => {
      if (!currentKeys.has(key)) {
        keysToRemove.push(key);
      }
    });
    
    // Remove in batches to avoid performance hit
    const batchSize = 10;
    for (let i = 0; i < Math.min(batchSize, keysToRemove.length); i++) {
      this.removeSynapse(keysToRemove[i]);
    }
    
    // Continue cleanup in next frame if needed
    if (keysToRemove.length > batchSize) {
      requestAnimationFrame(() => {
        const remaining = currentSynapseData.filter(syn => 
          keysToRemove.slice(batchSize).includes(`${syn.pre}-${syn.post}`)
        );
        this.cleanupUnusedSynapses(remaining);
      });
    }
  }

  getSynapseMaterial(weight, active) {
    const absWeight = Math.abs(weight);
    const isInhibitory = weight < 0;
    
    if (active) {
      return this.materials.synapse_active;
    } else if (isInhibitory) {
      const material = this.materials.synapse_inhibitory.clone();
      material.opacity = Math.min(0.6, absWeight * 2);
      return material;
    } else {
      const material = this.materials.synapse_excitatory.clone();
      material.opacity = Math.min(0.6, absWeight * 2);
      return material;
    }
  }

  createActivitySystem() {
    // Particle system for activity flow visualization
    this.activitySystem = new THREE.Group();
    
    // Create particle pool
    const particleGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true,
      opacity: 0.8 
    });
    
    for (let i = 0; i < 200; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
      particle.visible = false;
      particle.userData = { active: false, progress: 0, source: null, target: null };
      this.activityParticles.push(particle);
      this.activitySystem.add(particle);
    }
    
    this.brainGroup.add(this.activitySystem);
  }

  createMycelialGridViz(x, y, z) {
    const scale = 5.0;
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x9932CC, 
      transparent: true, 
      opacity: 0.0,
      emissive: 0x440044
    });
    
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

  // PERFORMANCE: Optimized main update loop
  update(brainData = {}) {
    const { 
      active_neurons = [], 
      spikes = [], 
      learning_stats = {}, 
      mycelial_grid = [],
      synapses = [],
      neuron_potentials = [],
      connection_activity = []
    } = brainData;

    // PERFORMANCE: Only update synapses if they're visible and data exists
    if (this.settings.showSynapses && synapses.length > 0) {
      this.updateSynapses(synapses);
    }

    // Handle newly grown neurons
    if (learning_stats && learning_stats.newly_grown_neuron !== null) {
      this.markNeuronAsGrown(learning_stats.newly_grown_neuron);
    }

    // Update neuron states (this is fast)
    this.updateNeurons(active_neurons, spikes, neuron_potentials);
    
    // Update activity flow (only if enabled)
    if (this.settings.showActivityFlow) {
      this.updateActivityFlow(spikes, connection_activity);
    }
    
    // Update displays
    this.updateEnhancedLearningDisplay(learning_stats, active_neurons.length, spikes.length, synapses.length);
    this.updateMycelialGrid(mycelial_grid);
    
    // Update statistics (throttled)
    if (Date.now() % 100 < 16) { // Update stats roughly every 100ms
      this.updateStatistics(brainData);
    }
    
    this.lastSpikes = [...spikes];
  }

  updateNeurons(activeNeurons, spikes, potentials) {
    const currentTime = Date.now();
    
    // Reset all neurons to inactive state
    this.neuronMeshes.forEach((neuron, i) => {
      neuron.main.visible = activeNeurons.includes(i);
      neuron.glow.material.opacity = 0;
      
      // Decay activity
      neuron.activity *= this.settings.activityDecay;
      
      if (activeNeurons.includes(i)) {
        neuron.main.material = this.recentlyGrown.has(i) ? 
          this.materials.growing : this.getInactiveMaterial(i);
      }
    });

    // Update spiking neurons
    spikes.forEach(i => {
      if (this.neuronMeshes[i]) {
        const neuron = this.neuronMeshes[i];
        neuron.main.material = this.getSpikeMaterial(i);
        neuron.activity = 1.0;
        neuron.lastSpike = currentTime;
        
        // Glow effect
        neuron.glow.material.opacity = 0.3;
        
        // Update fire rate
        if (!this.neuronFireRates.has(i)) {
          this.neuronFireRates.set(i, { count: 0, lastReset: currentTime });
        }
        this.neuronFireRates.get(i).count++;
      }
    });

    // Update neuron potentials if available
    if (potentials.length > 0) {
      potentials.forEach((potential, i) => {
        if (this.neuronMeshes[i]) {
          const intensity = Math.max(0, Math.min(1, potential));
          this.neuronMeshes[i].glow.material.opacity = intensity * 0.2;
        }
      });
    }

    // Reset fire rates periodically
    if (currentTime % 1000 < 50) { // Roughly every second
      this.neuronFireRates.forEach(rate => {
        rate.count = 0;
        rate.lastReset = currentTime;
      });
    }
  }

  updateActivityFlow(spikes, connectionActivity) {
    if (!this.settings.showActivityFlow) return;
    
    // Create activity particles for new spikes
    spikes.forEach(sourceNeuron => {
      // Find connections from this neuron
      this.connectionMap.forEach((connection, key) => {
        const [pre, post] = key.split('-').map(Number);
        if (pre === sourceNeuron && connection.active) {
          this.createActivityParticle(pre, post);
        }
      });
    });
    
    // Update existing particles
    this.activityParticles.forEach(particle => {
      if (particle.userData.active) {
        particle.userData.progress += 0.05;
        
        if (particle.userData.progress >= 1.0) {
          particle.visible = false;
          particle.userData.active = false;
        } else {
          // Interpolate position
          const sourcePos = this.neuronMeshes[particle.userData.source].main.position;
          const targetPos = this.neuronMeshes[particle.userData.target].main.position;
          particle.position.lerpVectors(sourcePos, targetPos, particle.userData.progress);
          
          // Fade out
          particle.material.opacity = 0.8 * (1 - particle.userData.progress);
        }
      }
    });
  }

  createActivityParticle(sourceId, targetId) {
    const availableParticle = this.activityParticles.find(p => !p.userData.active);
    if (!availableParticle) return;
    
    availableParticle.userData = {
      active: true,
      progress: 0,
      source: sourceId,
      target: targetId
    };
    
    availableParticle.position.copy(this.neuronMeshes[sourceId].main.position);
    availableParticle.visible = true;
    availableParticle.material.opacity = 0.8;
  }

  createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'brain-viz-controls';
    panel.style.cssText = `
      position: absolute; bottom: 20px; left: 20px; padding: 10px;
      background: rgba(0,0,0,0.8); color: #00ff88; border-radius: 5px;
      font-family: 'Courier New', monospace; font-size: 11px;
      border: 1px solid #00ff88; z-index: 1000;
    `;
    
    const title = document.createElement('h4');
    title.textContent = '🧠 Brain Visualization Controls';
    title.style.cssText = 'margin: 0 0 10px 0; color: #ffffff;';
    panel.appendChild(title);
    
    const controls = [
      { key: 'showSynapses', label: 'Show Synapses', type: 'checkbox' },
      { key: 'showWeakSynapses', label: 'Show Weak Synapses', type: 'checkbox' },
      { key: 'showActivityFlow', label: 'Show Activity Flow', type: 'checkbox' },
      { key: 'synapseThreshold', label: 'Synapse Threshold', type: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'maxVisibleSynapses', label: 'Max Visible Synapses', type: 'range', min: 50, max: 1000, step: 50 },
      { key: 'synapseUpdateFrequency', label: 'Update Frequency (ms)', type: 'range', min: 100, max: 2000, step: 100 }
    ];
    
    controls.forEach(control => {
      const container = document.createElement('div');
      container.style.cssText = 'margin: 5px 0;';
      
      if (control.type === 'checkbox') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.settings[control.key];
        checkbox.onchange = (e) => {
          this.settings[control.key] = e.target.checked;
          this.onSettingsChange();
        };
        
        const label = document.createElement('label');
        label.textContent = control.label;
        label.style.cssText = 'margin-left: 5px; color: #00ff88;';
        
        container.appendChild(checkbox);
        container.appendChild(label);
      } else if (control.type === 'range') {
        const label = document.createElement('label');
        label.textContent = `${control.label}: ${this.settings[control.key]}`;
        label.style.cssText = 'display: block; margin-bottom: 3px; color: #00ff88;';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = control.min;
        slider.max = control.max;
        slider.step = control.step;
        slider.value = this.settings[control.key];
        slider.style.cssText = 'width: 100%;';
        slider.oninput = (e) => {
          this.settings[control.key] = parseFloat(e.target.value);
          label.textContent = `${control.label}: ${this.settings[control.key]}`;
          this.onSettingsChange();
        };
        
        container.appendChild(label);
        container.appendChild(slider);
      }
      
      panel.appendChild(container);
    });

    // Add performance stats display
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;';
    
    const statsTitle = document.createElement('h5');
    statsTitle.textContent = '📊 Performance Stats';
    statsTitle.style.cssText = 'margin: 0 0 5px 0; color: #ffff00;';
    statsContainer.appendChild(statsTitle);
    
    this.perfStatsDisplay = document.createElement('div');
    this.perfStatsDisplay.style.cssText = 'font-size: 10px; color: #888;';
    statsContainer.appendChild(this.perfStatsDisplay);
    
    panel.appendChild(statsContainer);
    document.body.appendChild(panel);
  }

  onSettingsChange() {
    // Force synapse cache invalidation on settings change
    this.lastSynapseHash = null;
    
    // Update performance settings
    this.settings.synapseUpdateFrequency = Math.max(100, this.settings.synapseUpdateFrequency);
    this.settings.maxVisibleSynapses = Math.max(50, this.settings.maxVisibleSynapses);
    
    // Trigger re-render of synapses if threshold changed
    if (this.synapseLines.length > 0) {
      this.synapseLines.forEach(line => {
        line.visible = this.settings.showSynapses && 
          (Math.abs(line.userData.weight) >= this.settings.synapseThreshold || 
           this.settings.showWeakSynapses);
      });
    }
    
    // Update activity flow visibility
    this.activityParticles.forEach(particle => {
      if (!this.settings.showActivityFlow) {
        particle.visible = false;
        particle.userData.active = false;
      }
    });

    console.log('⚙️ Visualization settings updated', this.settings);
  }

  createEnhancedLearningDisplay() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    this.displayContext = canvas.getContext('2d');
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const geometry = new THREE.PlaneGeometry(6, 4);
    
    this.learningDisplay = new THREE.Mesh(geometry, material);
    this.learningDisplay.position.set(8, 12, 0);
    this.world.scene.add(this.learningDisplay);
    this.displayTexture = texture;
    
    // Statistics tracking
    this.statsHistory = {
      neurons: [],
      synapses: [],
      activity: [],
      rewards: [],
      maxHistory: 50
    };
  }

  updateEnhancedLearningDisplay(learningData, activeCount, spikeCount, synapseCount) {
    if (!this.displayContext) return;
    
    const ctx = this.displayContext;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, 640, 400);
    
    // Title
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Enhanced SNN Status', 20, 35);
    
    // Network statistics
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    
    const leftStats = [
      `Total Neurons: ${learningData?.total_neurons || 'N/A'}`,
      `Active Neurons: ${activeCount}`,
      `Current Spikes: ${spikeCount}`,
      `Total Synapses: ${synapseCount}`,
      `Visible Synapses: ${this.synapseLines.length}`,
      `Growth Rate: ${(learningData?.growth_rate || 0).toFixed(4)}`,
      `Learning Rate: ${(learningData?.learning_rate || 0).toFixed(4)}`
    ];
    
    leftStats.forEach((stat, index) => {
      ctx.fillText(stat, 20, 70 + index * 22);
    });
    
    // Performance metrics
    const rightStats = [
      `Avg Reward (50): ${(learningData?.avg_recent_reward || 0).toFixed(4)}`,
      `Fire Rate: ${this.calculateAverageFireRate().toFixed(1)} Hz`,
      `Connection Density: ${this.calculateConnectionDensity().toFixed(3)}`,
      `Network Efficiency: ${this.calculateNetworkEfficiency().toFixed(3)}`,
      `Avg Update Time: ${this.synapseUpdateStats.avgUpdateTime.toFixed(1)}ms`,
      `Cache Hit Rate: ${this.calculateCacheHitRate().toFixed(1)}%`
    ];
    
    rightStats.forEach((stat, index) => {
      ctx.fillText(stat, 320, 70 + index * 22);
    });
    
    // Performance warning if update time is too high
    if (this.synapseUpdateStats.avgUpdateTime > 50) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('⚠️ High synapse update time - consider reducing max synapses', 20, 240);
    }
    
    // Growth notification
    if (learningData?.newly_grown_neuron !== null && learningData?.newly_grown_neuron !== undefined) {
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`🌱 Neuron #${learningData.newly_grown_neuron} grew!`, 20, 260);
    }
    
    // Mini activity graph
    this.drawActivityGraph(ctx, 20, 280, 280, 100);
    
    // Network topology info
    this.drawTopologyInfo(ctx, 320, 280, 280, 100);
    
    // Update performance stats display
    this.updatePerformanceStats();
    
    this.displayTexture.needsUpdate = true;
    this.learningDisplay.lookAt(this.world.camera.position);
  }

  updatePerformanceStats() {
    if (!this.perfStatsDisplay) return;
    
    const stats = [
      `Synapse Updates: ${this.synapseUpdateStats.totalUpdates}`,
      `Avg Update: ${this.synapseUpdateStats.avgUpdateTime.toFixed(1)}ms`,
      `Cache Hit: ${this.calculateCacheHitRate().toFixed(1)}%`,
      `Visible: ${this.synapseLines.length}/${this.settings.maxVisibleSynapses}`
    ];
    
    this.perfStatsDisplay.innerHTML = stats.join('<br>');
  }

  calculateCacheHitRate() {
    // Simple cache hit rate calculation
    if (this.synapseUpdateStats.totalUpdates === 0) return 100;
    const missRate = this.synapseUpdateStats.totalUpdates / Math.max(1, this.synapseUpdateStats.totalUpdates + 10);
    return (1 - missRate) * 100;
  }

  drawActivityGraph(ctx, x, y, width, height) {
    ctx.strokeStyle = '#444';
    ctx.strokeRect(x, y, width, height);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('Activity History', x + 5, y + 15);
    
    if (this.statsHistory.activity.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      
      const points = this.statsHistory.activity;
      points.forEach((value, index) => {
        const px = x + (index / (points.length - 1)) * width;
        const py = y + height - (value / Math.max(...points)) * (height - 20);
        
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      
      ctx.stroke();
    }
  }

  drawTopologyInfo(ctx, x, y, width, height) {
    ctx.strokeStyle = '#444';
    ctx.strokeRect(x, y, width, height);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('Network Topology', x + 5, y + 15);
    
    // Connection type breakdown
    const connectionTypes = this.analyzeConnectionTypes();
    let yOffset = 35;
    
    Object.entries(connectionTypes).forEach(([type, count]) => {
      ctx.fillStyle = this.getConnectionTypeColor(type);
      ctx.fillText(`${type}: ${count}`, x + 10, y + yOffset);
      yOffset += 18;
    });
  }

  // Helper methods
  getNeuronSize(i) {
    if (i < this.n_vision_sensors) return 0.08;
    if (i < this.n_sensory) return 0.06;
    if (i < this.n_sensory + this.n_motor) return 0.07;
    return 0.05;
  }

  getNeuronType(i) {
    if (i < this.n_vision_sensors) return 'vision';
    if (i < this.n_sensory) return 'sensory';
    if (i < this.n_sensory + this.n_motor) return 'motor';
    return 'interneuron';
  }

  getInactiveMaterial(i) {
    if (i < this.n_vision_sensors) return this.materials.sensory_vision;
    if (i < this.n_sensory) return this.materials.sensory_proprio;
    if (i < this.n_sensory + this.n_motor / 2) return this.materials.motor_left;
    if (i < this.n_sensory + this.n_motor) return this.materials.motor_right;
    return this.materials.inactive;
  }

  getSpikeMaterial(i) {
    return this.materials.spiking;
  }

  calculateNeuronPosition(i) {
    // Enhanced positioning with better spatial organization
    if (i < this.n_vision_sensors) { 
      const a = (i/this.n_vision_sensors) * Math.PI * 1.5; 
      const radius = 3.5;
      return new THREE.Vector3(
        Math.cos(a) * radius, 
        Math.sin(a) * 1.5 + 2.5, 
        -2.5
      ); 
    }
    if (i < this.n_sensory) { 
      const p = i - this.n_vision_sensors; 
      return new THREE.Vector3(
        (p % 5) * 0.5 - 1, 
        Math.floor(p / 5) * 0.5 + 0.5, 
        -1.8
      ); 
    }
    if (i < this.n_sensory + this.n_motor) { 
      const m = i - this.n_sensory; 
      return new THREE.Vector3(
        m < this.n_motor/2 ? -2.5 : 2.5, 
        (m % (this.n_motor/2)) * 0.4 - 1, 
        2.5
      ); 
    }
    
    // Interneurons in 3D grid
    const n = i - this.n_sensory - this.n_motor;
    const gridSize = Math.ceil(Math.cbrt(this.totalNeurons - this.n_sensory - this.n_motor));
    const x = n % gridSize;
    const y = Math.floor(n / gridSize) % gridSize;
    const z = Math.floor(n / (gridSize * gridSize));
    
    return new THREE.Vector3(
      (x / gridSize - 0.5) * 4,
      (y / gridSize - 0.5) * 3,
      (z / gridSize - 0.5) * 4
    );
  }

  // Statistics and analysis methods
  calculateAverageFireRate() {
    let totalFires = 0;
    let activeNeurons = 0;
    
    this.neuronFireRates.forEach(rate => {
      totalFires += rate.count;
      if (rate.count > 0) activeNeurons++;
    });
    
    return activeNeurons > 0 ? totalFires / activeNeurons : 0;
  }

  calculateConnectionDensity() {
    const totalPossibleConnections = this.totalNeurons * (this.totalNeurons - 1);
    return this.synapseLines.length / totalPossibleConnections;
  }

  calculateNetworkEfficiency() {
    // Simplified network efficiency metric
    const activeConnections = this.synapseLines.filter(line => line.userData.active).length;
    return this.synapseLines.length > 0 ? activeConnections / this.synapseLines.length : 0;
  }

  analyzeConnectionTypes() {
    const types = {
      'Excitatory': 0,
      'Inhibitory': 0,
      'Sensory→Motor': 0,
      'Recurrent': 0
    };
    
    this.synapseLines.forEach(line => {
      const { pre, post, weight } = line.userData;
      
      if (weight > 0) types['Excitatory']++;
      else types['Inhibitory']++;
      
      if (pre < this.n_sensory && post >= this.n_sensory && post < this.n_sensory + this.n_motor) {
        types['Sensory→Motor']++;
      }
      
      if (pre >= this.n_sensory + this.n_motor && post >= this.n_sensory + this.n_motor) {
        types['Recurrent']++;
      }
    });
    
    return types;
  }

  getConnectionTypeColor(type) {
    const colors = {
      'Excitatory': '#44ff44',
      'Inhibitory': '#ff4444',
      'Sensory→Motor': '#ffff44',
      'Recurrent': '#4444ff'
    };
    return colors[type] || '#ffffff';
  }

  updateStatistics(brainData) {
    // Update history for graphs
    const currentActivity = brainData.spikes ? brainData.spikes.length : 0;
    this.statsHistory.activity.push(currentActivity);
    this.statsHistory.neurons.push(brainData.active_neurons ? brainData.active_neurons.length : 0);
    this.statsHistory.synapses.push(brainData.synapses ? brainData.synapses.length : 0);
    this.statsHistory.rewards.push(brainData.learning_stats?.avg_recent_reward || 0);
    
    // Trim history to max length
    Object.keys(this.statsHistory).forEach(key => {
      if (key !== 'maxHistory' && this.statsHistory[key].length > this.statsHistory.maxHistory) {
        this.statsHistory[key].shift();
      }
    });
  }

  updateMycelialGrid(gridData) {
    if (!gridData || this.mycelialCubes.length === 0) return;
    
    const flatGrid = Array.isArray(gridData) ? gridData.flat(2) : [];
    flatGrid.forEach((value, index) => {
      if (this.mycelialCubes[index]) {
        const intensity = Math.sqrt(Math.max(0, value)) * 0.6;
        this.mycelialCubes[index].material.opacity = intensity;
        
        // Add pulsing effect for high activity
        if (intensity > 0.3) {
          const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 0.9;
          this.mycelialCubes[index].material.opacity = intensity * pulse;
        }
      }
    });
  }

  markNeuronAsGrown(neuronId) {
    this.recentlyGrown.add(neuronId);
    
    // Create growth particle effect
    this.createGrowthEffect(neuronId);
    
    setTimeout(() => {
      this.recentlyGrown.delete(neuronId);
    }, 8000); // Show growth effect longer
  }

  createGrowthEffect(neuronId) {
    if (!this.neuronMeshes[neuronId]) return;
    
    const position = this.neuronMeshes[neuronId].main.position;
    
    // Create expanding ring effect
    const ringGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    ring.lookAt(this.world.camera.position);
    
    this.brainGroup.add(ring);
    
    // Animate the ring
    const startTime = Date.now();
    const animateRing = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / 2000; // 2 second animation
      
      if (progress < 1) {
        ring.scale.setScalar(1 + progress * 3);
        ring.material.opacity = 0.8 * (1 - progress);
        requestAnimationFrame(animateRing);
      } else {
        this.brainGroup.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
      }
    };
    
    animateRing();
  }

  // Public methods for external control
  setNeuronHighlight(neuronId, highlight = true) {
    if (this.neuronMeshes[neuronId]) {
      const neuron = this.neuronMeshes[neuronId];
      if (highlight) {
        neuron.glow.material.opacity = 0.5;
        neuron.glow.material.color.setHex(0xffff00);
      } else {
        neuron.glow.material.opacity = 0;
      }
    }
  }

  setSynapseHighlight(preId, postId, highlight = true) {
    const connectionKey = `${preId}-${postId}`;
    const connection = this.connectionMap.get(connectionKey);
    
    if (connection && connection.line) {
      if (highlight) {
        connection.line.material.color.setHex(0xffff00);
        connection.line.material.opacity = 1.0;
      } else {
        // Restore original color based on synapse type
        const isInhibitory = connection.weight < 0;
        connection.line.material.color.setHex(isInhibitory ? 0xff4444 : 0x44ff44);
        connection.line.material.opacity = Math.min(0.6, Math.abs(connection.weight) * 2);
      }
    }
  }

  exportNetworkData() {
    return {
      neurons: this.neuronMeshes.map((neuron, i) => ({
        id: i,
        position: neuron.main.position.toArray(),
        type: this.getNeuronType(i),
        activity: neuron.activity,
        fireRate: this.neuronFireRates.get(i)?.count || 0
      })),
      synapses: this.synapseLines.map(line => ({
        pre: line.userData.pre,
        post: line.userData.post,
        weight: line.userData.weight,
        active: line.userData.active
      })),
      statistics: {
        totalNeurons: this.totalNeurons,
        activeConnections: this.synapseLines.filter(l => l.userData.active).length,
        averageFireRate: this.calculateAverageFireRate(),
        connectionDensity: this.calculateConnectionDensity(),
        networkEfficiency: this.calculateNetworkEfficiency(),
        performanceStats: this.synapseUpdateStats
      }
    };
  }

  // PERFORMANCE: Batch dispose method for cleanup
  dispose() {
    console.log('🧠 Starting brain visualizer cleanup...');
    
    // Dispose of all geometries and materials in batches
    const batchSize = 50;
    let disposed = 0;
    
    const disposeBatch = (items, disposeFunc) => {
      const batch = items.slice(disposed, disposed + batchSize);
      batch.forEach(disposeFunc);
      disposed += batch.length;
      
      if (disposed < items.length) {
        requestAnimationFrame(() => disposeBatch(items, disposeFunc));
      }
    };
    
    // Dispose neuron meshes
    disposeBatch(this.neuronMeshes, (neuron) => {
      neuron.main.geometry.dispose();
      neuron.main.material.dispose();
      neuron.glow.geometry.dispose();
      neuron.glow.material.dispose();
    });
    
    // Dispose synapse lines
    disposeBatch(this.synapseLines, (line) => {
      line.geometry.dispose();
      line.material.dispose();
    });
    
    // Dispose other elements
    this.mycelialCubes.forEach(cube => {
      cube.geometry.dispose();
      cube.material.dispose();
    });
    
    this.activityParticles.forEach(particle => {
      particle.geometry.dispose();
      particle.material.dispose();
    });
    
    // Dispose geometry pool
    this.synapseGeometryPool.forEach(geom => geom.dispose());
    
    if (this.learningDisplay) {
      this.learningDisplay.geometry.dispose();
      this.learningDisplay.material.map.dispose();
      this.learningDisplay.material.dispose();
    }
    
    // Remove from scene
    this.world.scene.remove(this.brainGroup);
    this.world.scene.remove(this.learningDisplay);
    
    // Clear maps and arrays
    this.connectionMap.clear();
    this.synapseCache.clear();
    this.neuronActivity.clear();
    this.synapseActivity.clear();
    
    console.log('🧠 Brain visualizer disposed');
  }
}