// src/world.js - FIXED VERSION WITH PROPER SETUP

import * as THREE from 'three';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';
import { BrainVisualizer } from './brain_visualizer.js';

class CameraControls {
  constructor(camera) {
    this.camera = camera;
    this.isMouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.distance = 20;
    this.minDistance = 5;
    this.maxDistance = 50;
    
    this.setupEventListeners();
    this.updateCameraPosition();
  }

  setupEventListeners() {
    document.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    document.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      
      const deltaX = e.clientX - this.mouseX;
      const deltaY = e.clientY - this.mouseY;
      
      this.targetX += deltaX * 0.01;
      this.targetY += deltaY * 0.01;
      this.targetY = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.targetY));
      
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      
      this.updateCameraPosition();
    });

    document.addEventListener('wheel', (e) => {
      this.distance += e.deltaY * 0.01;
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
      this.updateCameraPosition();
    });
  }

  updateCameraPosition() {
    const x = Math.cos(this.targetY) * Math.sin(this.targetX) * this.distance;
    const y = Math.sin(this.targetY) * this.distance + 5;
    const z = Math.cos(this.targetY) * Math.cos(this.targetX) * this.distance;
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    
    this.physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    this.physicsWorld.solver.iterations = 10;

    this.objectsToUpdate = [];
    this.buttons = [];
    this.walls = [];

    this._setup();
    this.createEnvironment();

    // Initialize visualizer with error handling
    try {
      this.visualizer = new BrainVisualizer(this, 500);
    } catch (error) {
      console.warn('BrainVisualizer failed to initialize:', error);
      this.visualizer = { update: () => {} }; // Fallback
    }
    
    this.cameraControls = new CameraControls(this.camera);
  }

  _setup() {
    // Set up renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87CEEB); // Sky blue background
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Set up camera initial position
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);
    
    // Add lighting - THIS WAS MISSING!
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  createEnvironment() {
    // Floor setup
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x888888, 
      side: THREE.DoubleSide 
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);
    
    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.physicsWorld.addBody(floorBody);

    // Button setup
    const createButton = (color, position, userData) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 0.5), 
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.copy(position);
      mesh.userData = userData;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.buttons.push(mesh);
      
      const body = new CANNON.Body({ 
        mass: 0, 
        shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.25)) 
      });
      body.position.copy(position);
      body.userData = userData;
      this.physicsWorld.addBody(body);
    };
    
    createButton(0xff0000, new THREE.Vector3(-10, 1, 0), { id: 'button_red', color: 'red' });
    createButton(0x0000ff, new THREE.Vector3(10, 1, 0), { id: 'button_blue', color: 'blue' });

    // Wall creation
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xaaaaaa, 
      transparent: true, 
      opacity: 0.5 
    });
    
    const createWall = (size, position) => {
      const [sx, sy, sz] = size;
      const [px, py, pz] = position;
      
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMaterial);
      wallMesh.position.set(px, py, pz);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.scene.add(wallMesh);
      this.walls.push(wallMesh);
      
      const wallBody = new CANNON.Body({ 
        mass: 0, 
        shape: new CANNON.Box(new CANNON.Vec3(sx/2, sy/2, sz/2)) 
      });
      wallBody.position.set(px, py, pz);
      wallBody.userData = { id: 'wall' };
      this.physicsWorld.addBody(wallBody);
    };
    
    // Create boundary walls
    createWall([30, 2, 0.5], [0, 1, -15]);   // North wall
    createWall([30, 2, 0.5], [0, 1, 15]);    // South wall
    createWall([0.5, 2, 30], [-15, 1, 0]);   // West wall
    createWall([0.5, 2, 30], [15, 1, 0]);    // East wall
  }

  update(deltaTime) {
    this.physicsWorld.step(1/60, deltaTime, 3);
    
    // Update all physics objects
    for (const object of this.objectsToUpdate) {
      if (object.mesh && object.body) {
        object.mesh.position.copy(object.body.position);
        object.mesh.quaternion.copy(object.body.quaternion);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}