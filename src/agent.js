// src/agent.js - FIXED PHYSICS AND POSITIONING

import * as THREE from 'three';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

export class Agent {
  constructor(world) {
    this.world = world;
    this.reward = 0.0;
    this.totalReward = 0;
    this.stepCount = 0;
    this.needsReset = false; // Flag to signal a reset is needed

    this.movementHistory = [];
    this.maxHistoryLength = 100;

    // --- FIXED: Agent's starting position (higher Y to avoid floor clipping) ---
    this.initialPosition = new CANNON.Vec3(0, 3, 8);  // Raised Y from 2 to 3

    // --- Create Agent ---
    const radius = 0.5;
    const height = 1.0;
    
    // THREE.js Visual Mesh
    this.mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, 16),
        new THREE.MeshStandardMaterial({ color: 0xffff00 })
    );
    this.mesh.castShadow = true;
    this.world.scene.add(this.mesh);
    
    // Front indicator to show direction
    const frontIndicator = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, radius * 2),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    frontIndicator.position.y = 0.25;
    this.mesh.add(frontIndicator);

    // CANNON.js Physics Body - FIXED
    const shape = new CANNON.Cylinder(radius, radius, height, 16);
    this.body = new CANNON.Body({
        mass: 5,  // Good mass
        shape: shape,
        position: this.initialPosition.clone(),
        angularDamping: 0.7,  // Reduced from 0.9 for better turning
        linearDamping: 0.3,   // Reduced from 0.5 for better movement
    });
    
    // FIXED: Allow rotation around Y axis only
    this.body.angularFactor.set(0, 1, 0);
    this.body.userData = { id: 'agent' };
    
    // ADDED: Prevent sleeping to ensure physics always work
    this.body.sleepState = CANNON.Body.AWAKE;
    this.body.sleepSpeedLimit = 0.1;
    this.body.sleepTimeLimit = 0.1;
    
    this.world.physicsWorld.addBody(this.body);
    this.world.objectsToUpdate.push({ mesh: this.mesh, body: this.body });

    this.createVisionSystem();
    
    // DEBUG: Log initial position
    console.log('､�Agent created at position:', this.body.position);
  }

  // --- Reset method with better positioning ---
  
resetPosition() {
    // FIXED: Use set() instead of copy() for CANNON.js Vec3
    this.body.position.set(
        this.initialPosition.x, 
        this.initialPosition.y, 
        this.initialPosition.z
    );
    
    // Reset velocities
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    
    // Reset rotation to face forward (no rotation)
    this.body.quaternion.set(0, 0, 0, 1);
    
    // Force wake up the body to ensure physics update
    this.body.wakeUp();
    
    // ADDED: Force immediate physics sync
    this.body.aabb.setFromPoints([this.body.position]);
    
    console.log("徴 Agent reset to starting position:", {
        x: this.body.position.x,
        y: this.body.position.y, 
        z: this.body.position.z
    });
}


  createVisionSystem() {
    this.visionRays = [];
    // Rays for seeing targets (buttons)
    const targetRayAngles = [0, -0.3, 0.3]; 
    targetRayAngles.forEach(angle => {
        const line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 })
        );
        this.world.scene.add(line);
        this.visionRays.push({ line, angle, type: 'target' });
    });

    // Rays for seeing walls ("whiskers")
    const wallRayAngles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    wallRayAngles.forEach(angle => {
        const line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 })
        );
        this.world.scene.add(line);
        this.visionRays.push({ line, angle, type: 'wall' });
    });
  }

  sense() {
    const agentPosition = this.mesh.position;
    const baseForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    
    const sensorData = {
      // Target sensors
      sees: null, distance: Infinity,
      sees_left: null, distance_left: Infinity,
      sees_right: null, distance_right: Infinity,
      // Wall sensors
      sees_wall: false, wall_distance: Infinity,
      // Proprioception
      position: { x: agentPosition.x, z: agentPosition.z },
      orientation: this.mesh.rotation.y,
      velocity: { x: this.body.velocity.x, z: this.body.velocity.z },
      angular_velocity: this.body.angularVelocity.y
    };

    let closestWallDist = Infinity;

    this.visionRays.forEach((ray) => {
      const forward = baseForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ray.angle);
      const raycaster = new THREE.Raycaster(agentPosition, forward, 0, 20);
      
      let intersects;
      if (ray.type === 'target') {
        intersects = raycaster.intersectObjects(this.world.buttons);
        if (intersects.length > 0) {
            const firstHit = intersects[0];
            if (ray.angle === 0) { 
                sensorData.sees = firstHit.object.userData.color; 
                sensorData.distance = firstHit.distance; 
            }
            else if (ray.angle < 0) { 
                sensorData.sees_left = firstHit.object.userData.color; 
                sensorData.distance_left = firstHit.distance; 
            }
            else { 
                sensorData.sees_right = firstHit.object.userData.color; 
                sensorData.distance_right = firstHit.distance; 
            }
        }
      } else if (ray.type === 'wall') {
        intersects = raycaster.intersectObjects(this.world.walls);
        if (intersects.length > 0) {
            sensorData.sees_wall = true;
            if (intersects[0].distance < closestWallDist) {
                closestWallDist = intersects[0].distance;
            }
        }
      }
      
      // Update visual line
      const endPoint = agentPosition.clone().add(forward.multiplyScalar(20));
      ray.line.geometry.setFromPoints([agentPosition, endPoint]);
      ray.line.geometry.attributes.position.needsUpdate = true;
    });

    sensorData.wall_distance = closestWallDist;
    return sensorData;
  }

  act(commands) {
    if (!commands || typeof commands !== 'object') {
      return;
    }

    const { left = 0, right = 0 } = commands;
    
    // DEBUG: Log motor commands
    if (left > 0 || right > 0) {
      console.log(`純 Motor commands - Left: ${left.toFixed(2)}, Right: ${right.toFixed(2)}`);
    }

    // FIXED: Improved motor control with proper scaling
    const maxForce = 150;  // Increased from potential lower values
    const maxTorque = 50;  // Good torque for turning
    
    // Calculate forward and turning forces
    const forwardForce = (left + right) * maxForce * 0.5;
    const turningTorque = (left - right) * maxTorque;
    
    // Apply forces in local coordinate system
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    // Apply forward force
    if (Math.abs(forwardForce) > 0.1) {
      const forceVector = forward.multiplyScalar(forwardForce);
      this.body.force.set(forceVector.x, 0, forceVector.z);
      
      // DEBUG: Log applied forces
      console.log(`笞｡ Applied force: ${forceVector.x.toFixed(1)}, ${forceVector.z.toFixed(1)}`);
    }
    
    // Apply turning torque
    if (Math.abs(turningTorque) > 0.1) {
      this.body.torque.set(0, turningTorque, 0);
      
      // DEBUG: Log applied torque
      console.log(`劇 Applied torque: ${turningTorque.toFixed(1)}`);
    }
    
    // Ensure body stays awake
    this.body.wakeUp();
    
    // DEBUG: Log current velocity every few steps
    if (this.stepCount % 50 === 0) {
      const vel = this.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      console.log(`投 Step ${this.stepCount}: Speed: ${speed.toFixed(2)}, Pos: (${this.body.position.x.toFixed(1)}, ${this.body.position.z.toFixed(1)})`);
    }
    
    this.stepCount++;
  }

  checkAndResetReward() {
    const currentReward = this.reward;
    this.totalReward += currentReward;
    this.reward = 0.0;
    return currentReward;
  }
}
