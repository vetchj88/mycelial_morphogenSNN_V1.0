// src/main.js - ENHANCED WITH PERFORMANCE TRACKING & BRAIN MANAGEMENT

import * as THREE from 'three';
import { World } from './world.js';
import { Agent } from './agent.js';
import { PerformanceTracker } from './performance_tracker.js';
import { BrainManager } from './brain_manager.js';
import brainSocket from './communication.js';

// --- 1. SETUP ---
const canvas = document.querySelector('#simulation-canvas');

if (!canvas) {
  console.error('Canvas element #simulation-canvas not found!');
  throw new Error('Canvas element not found');
}

const world = new World(canvas);
const agent = new Agent(world);
const clock = new THREE.Clock();

// --- NEW: Initialize performance tracking and brain management ---
const performanceTracker = new PerformanceTracker();
const brainManager = new BrainManager();

// Make them globally accessible
window.performanceTracker = performanceTracker;
window.brainManager = brainManager;
window.brainSocket = brainSocket;

let latestBrainOutput = {};
let lastSensoryData = null;
let statusElements = {}; 
let performanceElements = {};
let positionHistory = [];
const STAGNATION_FRAMES = 100;

// --- 2. ENHANCED UI & STATUS DISPLAY ---
function createStatusPanel() {
    const panel = document.createElement('div');
    panel.id = 'status-panel';
    panel.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.9);
        color: #00ff88;
        font-family: 'Courier New', monospace;
        border-radius: 5px;
        width: 320px;
        border: 1px solid #00ff88;
        z-index: 1000;
        pointer-events: none;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Agent Status & Performance';
    title.style.cssText = 'margin: 0 0 8px 0; color: #ffffff; font-size: 14px;';
    panel.appendChild(title);

    // Basic status section
    const statusSection = document.createElement('div');
    statusSection.style.cssText = 'margin-bottom: 10px; padding: 8px; border: 1px solid #333; border-radius: 3px;';
    
    const statusTitle = document.createElement('h4');
    statusTitle.textContent = '📊 Current Status';
    statusTitle.style.cssText = 'margin: 0 0 5px 0; color: #ffff00; font-size: 12px;';
    statusSection.appendChild(statusTitle);

    const basicStats = {
        'Senses': 'Initializing...',
        'Action': 'Idle',
        'Thinking': 'L: 0.00, R: 0.00',
        'Current Reward': '0.0000',
        'Neurons': '0',
        'Synapses': '0'
    };

    for (const [key, value] of Object.entries(basicStats)) {
        const p = document.createElement('p');
        p.style.cssText = 'margin: 3px 0; font-size: 11px;';
        
        const strong = document.createElement('strong');
        strong.textContent = `${key}: `;
        strong.style.color = '#ffffff';
        
        const span = document.createElement('span');
        span.textContent = value;
        span.style.color = '#00ff88';
        
        p.appendChild(strong);
        p.appendChild(span);
        statusSection.appendChild(p);
        statusElements[key] = span;
    }
    panel.appendChild(statusSection);

    // Performance metrics section
    const perfSection = document.createElement('div');
    perfSection.style.cssText = 'margin-bottom: 10px; padding: 8px; border: 1px solid #333; border-radius: 3px;';
    
    const perfTitle = document.createElement('h4');
    perfTitle.textContent = '🏆 Performance Metrics';
    perfTitle.style.cssText = 'margin: 0 0 5px 0; color: #ffff00; font-size: 12px;';
    perfSection.appendChild(perfTitle);

    const perfStats = {
        'Targets Hit': '0',
        'Wall Collisions': '0',
        'Exploration': '0 areas',
        'Best Streak': '0',
        'Avg Speed': '0.00',
        'Session Time': '0:00'
    };

    for (const [key, value] of Object.entries(perfStats)) {
        const p = document.createElement('p');
        p.style.cssText = 'margin: 3px 0; font-size: 11px;';
        
        const strong = document.createElement('strong');
        strong.textContent = `${key}: `;
        strong.style.color = '#ffffff';
        
        const span = document.createElement('span');
        span.textContent = value;
        span.style.color = '#00aaff';
        
        p.appendChild(strong);
        p.appendChild(span);
        perfSection.appendChild(p);
        performanceElements[key] = span;
    }
    panel.appendChild(perfSection);

    // Milestones section
    const milestoneSection = document.createElement('div');
    milestoneSection.style.cssText = 'padding: 8px; border: 1px solid #333; border-radius: 3px;';
    
    const milestoneTitle = document.createElement('h4');
    milestoneTitle.textContent = '🏅 Recent Milestones';
    milestoneTitle.style.cssText = 'margin: 0 0 5px 0; color: #ffff00; font-size: 12px;';
    milestoneSection.appendChild(milestoneTitle);

    const milestoneList = document.createElement('div');
    milestoneList.id = 'milestone-list';
    milestoneList.style.cssText = 'max-height: 100px; overflow-y: auto; font-size: 10px;';
    milestoneSection.appendChild(milestoneList);
    
    panel.appendChild(milestoneSection);
    
    document.body.appendChild(panel);
    console.log('Enhanced status panel created successfully');
}

function updateStatusPanel(currentAgent, sensoryData, brainOutput) {
    if (!sensoryData || !brainOutput || Object.keys(statusElements).length === 0) return;

    try {
        // Update basic status (existing code)
        let sensesText = 'Nothing';
        if (sensoryData.sees) {
            const dist = isFinite(sensoryData.distance) ? sensoryData.distance.toFixed(1) : 'far';
            sensesText = `${sensoryData.sees.toUpperCase()} (Center, dist: ${dist})`;
        } else if (sensoryData.sees_left) {
            const dist = isFinite(sensoryData.distance_left) ? sensoryData.distance_left.toFixed(1) : 'far';
            sensesText = `${sensoryData.sees_left.toUpperCase()} (Left, dist: ${dist})`;
        } else if (sensoryData.sees_right) {
            const dist = isFinite(sensoryData.distance_right) ? sensoryData.distance_right.toFixed(1) : 'far';
            sensesText = `${sensoryData.sees_right.toUpperCase()} (Right, dist: ${dist})`;
        } else if (sensoryData.sees_wall) {
            const dist = isFinite(sensoryData.wall_distance) ? sensoryData.wall_distance.toFixed(1) : 'far';
            sensesText = `WALL (dist: ${dist})`;
        }
        statusElements['Senses'].textContent = sensesText;

        const motor = brainOutput.motor_commands || { left: 0, right: 0 };
        statusElements['Thinking'].textContent = `L: ${motor.left.toFixed(2)}, R: ${motor.right.toFixed(2)}`;
        
        let action = 'Idle';
        const forward = motor.left + motor.right;
        const turn = motor.left - motor.right;
        if (forward > 0.5) action = 'Moving Forward';
        if (turn > 0.5) action = 'Turning Left';
        if (turn < -0.5) action = 'Turning Right';
        if (Math.abs(turn) > 0.5 && forward > 0.5) action = 'Veering';
        statusElements['Action'].textContent = action;

        statusElements['Current Reward'].textContent = currentAgent.reward.toFixed(4);
        if (brainOutput.learning_stats) {
            statusElements['Neurons'].textContent = `${brainOutput.learning_stats.total_neurons || 0}`;
            statusElements['Synapses'].textContent = `${brainOutput.learning_stats.total_synapses || 0}`;
        }

        // Update performance metrics
        const report = performanceTracker.getPerformanceReport();
        const perf = report.performance;
        const session = report.session;

        performanceElements['Targets Hit'].textContent = perf.successfulReaches.toString();
        performanceElements['Wall Collisions'].textContent = perf.wallCollisions.toString();
        performanceElements['Exploration'].textContent = `${perf.explorationCoverageCount} areas`;
        performanceElements['Best Streak'].textContent = perf.bestRewardStreak.toString();
        performanceElements['Avg Speed'].textContent = perf.averageSpeed.toFixed(2);
        
        const sessionMinutes = Math.floor(session.duration / 60000);
        const sessionSeconds = Math.floor((session.duration % 60000) / 1000);
        performanceElements['Session Time'].textContent = `${sessionMinutes}:${sessionSeconds.toString().padStart(2, '0')}`;

        // Update milestones
        updateMilestoneDisplay(report.milestones);

    } catch (error) {
        console.warn('Error updating status panel:', error);
    }
}

function updateMilestoneDisplay(milestones) {
    const milestoneList = document.getElementById('milestone-list');
    if (!milestoneList) return;

    const recent = milestones.slice(-5).reverse(); // Show last 5, most recent first
    
    if (recent.length === 0) {
        milestoneList.innerHTML = '<div style="color: #666; font-style: italic;">No milestones yet</div>';
        return;
    }

    milestoneList.innerHTML = recent.map(milestone => {
        const timeAgo = Math.floor((Date.now() - milestone.achievedAt) / 1000);
        const displayTime = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo/60)}m ago`;
        
        return `<div style="margin: 2px 0; color: #00ff88;">
            🏅 ${milestone.name} (${displayTime})
        </div>`;
    }).join('');
}

// --- 3. CONNECT TO BRAIN ---
brainSocket.connect((brainData) => {
  if (brainData) {
    latestBrainOutput = brainData;
  }
});

// --- 4. ENHANCED REWARD & COLLISION ---
function calculateReward(sensoryData, lastSensoryData) {
    if (!sensoryData || !lastSensoryData) return 0;
    
    let reward = -0.002; // Cost of living
    const isSeeingRed = sensoryData.sees === 'red' || sensoryData.sees_left === 'red' || sensoryData.sees_right === 'red';
    const isSeeingBlue = sensoryData.sees === 'blue' || sensoryData.sees_left === 'blue' || sensoryData.sees_right === 'blue';
    const isMoving = Math.sqrt(sensoryData.velocity.x**2 + sensoryData.velocity.z**2) > 0.1;

    if (isSeeingRed) {
        reward += 0.01; // Vision bonus for correct target
        const currentDistance = sensoryData.distance !== Infinity ? sensoryData.distance : (sensoryData.distance_left !== Infinity ? sensoryData.distance_left : sensoryData.distance_right);
        const lastDistance = lastSensoryData.distance !== Infinity ? lastSensoryData.distance : (lastSensoryData.distance_left !== Infinity ? lastSensoryData.distance_left : lastSensoryData.distance_right);
        if (currentDistance < lastDistance) reward += 0.2; // Reward for getting closer
    } else if (isSeeingBlue) {
        reward -= 0.1; // Penalty for looking at the wrong target
    } else {
        const isTurning = Math.abs(sensoryData.angular_velocity) > 0.2;
        if (isTurning) reward += 0.1; // Reward for exploring
        if (isMoving && !isTurning) reward -= 0.2; // Penalty for moving aimlessly
    }

    if (sensoryData.sees_wall && sensoryData.wall_distance < 1.0) {
        reward -= 0.5;
    }

    // Stagnation penalty
    positionHistory.push({x: sensoryData.position.x, z: sensoryData.position.z});
    if (positionHistory.length > STAGNATION_FRAMES) {
        positionHistory.shift();
        const firstPos = positionHistory[0];
        const lastPos = positionHistory[positionHistory.length - 1];
        const distanceMoved = Math.sqrt((lastPos.x - firstPos.x)**2 + (lastPos.z - firstPos.z)**2);
        if (distanceMoved < 0.5) reward -= 0.01;
    }
    
    return reward;
}

// Enhanced collision handling with performance tracking
agent.body.addEventListener('collide', (event) => {
    const userData = event.body.userData;
    if (userData?.id === 'button_red') { 
        agent.reward = 5.0;
        performanceTracker.recordEvent('target_hit', { 
            position: { x: agent.body.position.x, z: agent.body.position.z },
            reward: 5.0 
        });
        agent.needsReset = true; // Use deferred reset for all collisions
        console.log('🎯 Agent hit RED button! Reward: +5.0');
    } 
    else if (userData?.id === 'button_blue') { 
        agent.reward = -1.0; 
        performanceTracker.recordEvent('target_hit', { 
            position: { x: agent.body.position.x, z: agent.body.position.z },
            reward: -1.0,
            type: 'blue_button'
        });
        agent.needsReset = true; // Use deferred reset for all collisions
        console.log('❌ Agent hit BLUE button! Penalty: -1.0, resetting position.');
    } 
    else if (userData?.id === 'wall') { 
        agent.reward = -2.0;
        performanceTracker.recordEvent('wall_collision', { 
            position: { x: agent.body.position.x, z: agent.body.position.z },
            reward: -2.0 
        });
        agent.needsReset = true; // Use deferred reset for all collisions
        console.log('💥 Agent hit wall! Penalty: -2.0, resetting position');
    }
});

// Listen for milestone achievements to trigger auto-save
performanceTracker.milestoneDefinitions.forEach(milestone => {
    const originalCondition = milestone.condition;
    milestone.condition = (metrics) => {
        const achieved = originalCondition(metrics);
        if (achieved && !performanceTracker.milestones.find(m => m.id === milestone.id)) {
            brainManager.onMilestoneAchieved(milestone);
        }
        return achieved;
    };
});

// --- 5. MAIN SIMULATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  // --- NEW: Handle deferred reset for all collisions ---
  if (agent.needsReset) {
    // Clear forces and velocities before resetting position to prevent physics glitches
    agent.body.velocity.set(0, 0, 0);
    agent.body.angularVelocity.set(0, 0, 0);
    agent.body.force.set(0, 0, 0);
    agent.body.torque.set(0, 0, 0);
    
    agent.resetPosition();
    agent.needsReset = false;
    
    // Skip the rest of the loop for this frame to ensure a clean reset
    return;
  }
  
  try {
    const deltaTime = clock.getDelta();
    
    // Agent sensing and reward calculation
    agent.checkAndResetReward();
    const sensoryData = agent.sense();
    const continuousReward = calculateReward(sensoryData, lastSensoryData);
    agent.reward += continuousReward;
    
    // Update performance tracking
    performanceTracker.update(agent, sensoryData, latestBrainOutput, latestBrainOutput.motor_commands);
    
    // Send data to brain
    brainSocket.send({ senses: sensoryData, reward: agent.reward });

    // Apply brain commands to agent
    agent.act(latestBrainOutput.motor_commands || {left: 0, right: 0});

    // Update world physics and rendering
    world.update(deltaTime);
    world.visualizer.update(latestBrainOutput);
    world.render();
    
    // Update UI
    updateStatusPanel(agent, sensoryData, latestBrainOutput);
    
    // Store sensory data for next frame
    lastSensoryData = sensoryData;
    
  } catch (error) {
    console.error('Error in animation loop:', error);
  }
}

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case 's':
        case 'S':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                const name = prompt('Enter brain name:') || `QuickSave_${Date.now()}`;
                brainManager.saveBrain(name);
            }
            break;
        case 'r':
        case 'R':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                if (confirm('Reset performance tracking?')) {
                    performanceTracker.reset();
                    console.log('🔄 Performance tracking reset');
                }
            }
            break;
    }
});

// --- START EVERYTHING ---
console.log('🚀 Initializing enhanced simulation with performance tracking...');
createStatusPanel();
console.log('🎬 Starting enhanced animation loop...');
animate();

// Log startup info
console.log(`
🧠 Enhanced Morphogen Simulation Started!
📊 Performance tracking enabled
💾 Brain management enabled
⌨️  Keyboard shortcuts:
   Ctrl+S: Quick save brain
   Ctrl+R: Reset performance tracking
`)
