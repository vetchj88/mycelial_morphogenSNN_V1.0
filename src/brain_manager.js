// src/brain_manager.js - Brain State Management

export class BrainManager {
    constructor() {
        this.savedBrains = new Map();
        this.currentBrainId = null;
        this.autoSaveEnabled = false;
        this.autoSaveInterval = null;
        this.milestoneAutoSave = true;
        
        this.loadSavedBrains();
        this.createUI();
    }
    
    createUI() {
        // Create brain management panel
        const panel = document.createElement('div');
        panel.id = 'brain-manager-panel';
        panel.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 15px;
            background-color: rgba(0, 0, 0, 0.85);
            color: #00ff88;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            border-radius: 8px;
            width: 320px;
            border: 2px solid #00ff88;
            z-index: 1000;
            max-height: 80vh;
            overflow-y: auto;
        `;

        const title = document.createElement('h3');
        title.textContent = '🧠 Brain Manager';
        title.style.cssText = 'margin: 0 0 10px 0; color: #ffffff; font-size: 16px; text-align: center;';
        panel.appendChild(title);

        // Save section
        const saveSection = document.createElement('div');
        saveSection.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 1px solid #444; border-radius: 5px;';
        
        const saveTitle = document.createElement('h4');
        saveTitle.textContent = '💾 Save Brain';
        saveTitle.style.cssText = 'margin: 0 0 8px 0; color: #ffff00;';
        saveSection.appendChild(saveTitle);
        
        const saveInput = document.createElement('input');
        saveInput.type = 'text';
        saveInput.placeholder = 'Enter brain name...';
        saveInput.style.cssText = `
            width: 100%; padding: 5px; margin: 5px 0;
            background: rgba(0,0,0,0.7); color: #00ff88;
            border: 1px solid #00ff88; border-radius: 3px;
            font-family: 'Courier New', monospace;
        `;
        saveSection.appendChild(saveInput);
        
        const saveButton = document.createElement('button');
        saveButton.textContent = '💾 Save Current Brain';
        saveButton.style.cssText = `
            width: 100%; padding: 8px; margin: 5px 0;
            background: #00ff88; color: black; border: none;
            border-radius: 3px; cursor: pointer; font-weight: bold;
            font-family: 'Courier New', monospace;
        `;
        saveButton.onclick = () => this.saveBrain(saveInput.value || `Brain_${Date.now()}`);
        saveSection.appendChild(saveButton);
        
        panel.appendChild(saveSection);

        // Load section
        const loadSection = document.createElement('div');
        loadSection.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 1px solid #444; border-radius: 5px;';
        
        const loadTitle = document.createElement('h4');
        loadTitle.textContent = '📂 Load Brain';
        loadTitle.style.cssText = 'margin: 0 0 8px 0; color: #ffff00;';
        loadSection.appendChild(loadTitle);
        
        this.brainList = document.createElement('div');
        this.brainList.style.cssText = 'max-height: 200px; overflow-y: auto;';
        loadSection.appendChild(this.brainList);
        
        panel.appendChild(loadSection);

        // Auto-save section
        const autoSaveSection = document.createElement('div');
        autoSaveSection.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 1px solid #444; border-radius: 5px;';
        
        const autoSaveTitle = document.createElement('h4');
        autoSaveTitle.textContent = '⚙️ Auto-Save Settings';
        autoSaveTitle.style.cssText = 'margin: 0 0 8px 0; color: #ffff00;';
        autoSaveSection.appendChild(autoSaveTitle);
        
        const autoSaveCheckbox = document.createElement('input');
        autoSaveCheckbox.type = 'checkbox';
        autoSaveCheckbox.checked = this.autoSaveEnabled;
        autoSaveCheckbox.onchange = (e) => this.toggleAutoSave(e.target.checked);
        
        const autoSaveLabel = document.createElement('label');
        autoSaveLabel.style.cssText = 'color: #00ff88; margin-left: 5px;';
        autoSaveLabel.textContent = 'Auto-save every 5 minutes';
        autoSaveLabel.prepend(autoSaveCheckbox);
        autoSaveSection.appendChild(autoSaveLabel);
        
        const milestoneCheckbox = document.createElement('input');
        milestoneCheckbox.type = 'checkbox';
        milestoneCheckbox.checked = this.milestoneAutoSave;
        milestoneCheckbox.onchange = (e) => this.milestoneAutoSave = e.target.checked;
        
        const milestoneLabel = document.createElement('label');
        milestoneLabel.style.cssText = 'color: #00ff88; margin-left: 5px; display: block; margin-top: 5px;';
        milestoneLabel.textContent = 'Auto-save on milestones';
        milestoneLabel.prepend(milestoneCheckbox);
        autoSaveSection.appendChild(milestoneLabel);
        
        panel.appendChild(autoSaveSection);

        // Export/Import section
        const exportSection = document.createElement('div');
        exportSection.style.cssText = 'padding: 10px; border: 1px solid #444; border-radius: 5px;';
        
        const exportTitle = document.createElement('h4');
        exportTitle.textContent = '📤 Export/Import';
        exportTitle.style.cssText = 'margin: 0 0 8px 0; color: #ffff00;';
        exportSection.appendChild(exportTitle);
        
        const exportButton = document.createElement('button');
        exportButton.textContent = '📤 Export All Brains';
        exportButton.style.cssText = `
            width: 48%; padding: 6px; margin: 2px 1%;
            background: #0088ff; color: white; border: none;
            border-radius: 3px; cursor: pointer; font-size: 10px;
            font-family: 'Courier New', monospace;
        `;
        exportButton.onclick = () => this.exportBrains();
        exportSection.appendChild(exportButton);
        
        const importButton = document.createElement('button');
        importButton.textContent = '📥 Import Brains';
        importButton.style.cssText = `
            width: 48%; padding: 6px; margin: 2px 1%;
            background: #ff8800; color: white; border: none;
            border-radius: 3px; cursor: pointer; font-size: 10px;
            font-family: 'Courier New', monospace;
        `;
        
        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.json';
        importInput.style.display = 'none';
        importInput.onchange = (e) => this.importBrains(e.target.files[0]);
        
        importButton.onclick = () => importInput.click();
        exportSection.appendChild(importButton);
        exportSection.appendChild(importInput);
        
        panel.appendChild(exportSection);
        
        document.body.appendChild(panel);
        
        this.updateBrainList();
    }
    
    async saveBrain(name, metadata = {}) {
        try {
            // Request brain state from the brain server
            const brainState = await this.requestBrainState();
            
            const brainData = {
                id: Date.now(),
                name: name,
                timestamp: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    performance: window.performanceTracker ? window.performanceTracker.getPerformanceReport() : null
                },
                brainState: brainState
            };
            
            this.savedBrains.set(brainData.id, brainData);
            this.saveBrainsToStorage();
            this.updateBrainList();
            
            console.log(`🧠 Brain saved: ${name}`);
            this.showNotification(`Brain "${name}" saved successfully!`, 'success');
            
        } catch (error) {
            console.error('Failed to save brain:', error);
            this.showNotification('Failed to save brain!', 'error');
        }
    }
    
    async requestBrainState() {
        // This would communicate with your brain server to get the current state
        // For now, we'll simulate this - you'll need to implement actual communication
        return new Promise((resolve) => {
            // Send a special message to the brain server requesting current state
            if (window.brainSocket && window.brainSocket.isConnected) {
                // You'll need to modify your brain server to handle state requests
                window.brainSocket.send({ action: 'get_state' });
                
                // Listen for response (you'll need to implement this)
                setTimeout(() => {
                    resolve({
                        timestamp: Date.now(),
                        message: 'Brain state capture - implement actual brain serialization'
                    });
                }, 100);
            } else {
                resolve({ error: 'No brain connection' });
            }
        });
    }
    
    async loadBrain(brainId) {
        const brainData = this.savedBrains.get(brainId);
        if (!brainData) {
            this.showNotification('Brain not found!', 'error');
            return;
        }
        
        try {
            // Send load command to brain server
            if (window.brainSocket && window.brainSocket.isConnected) {
                window.brainSocket.send({ 
                    action: 'load_state', 
                    brainState: brainData.brainState 
                });
                
                this.currentBrainId = brainId;
                console.log(`🧠 Brain loaded: ${brainData.name}`);
                this.showNotification(`Brain "${brainData.name}" loaded successfully!`, 'success');
                
                // Reset performance tracker
                if (window.performanceTracker) {
                    window.performanceTracker.reset();
                }
            } else {
                this.showNotification('No brain connection!', 'error');
            }
            
        } catch (error) {
            console.error('Failed to load brain:', error);
            this.showNotification('Failed to load brain!', 'error');
        }
    }
    
    deleteBrain(brainId) {
        const brainData = this.savedBrains.get(brainId);
        if (brainData && confirm(`Delete brain "${brainData.name}"?`)) {
            this.savedBrains.delete(brainId);
            this.saveBrainsToStorage();
            this.updateBrainList();
            this.showNotification(`Brain "${brainData.name}" deleted!`, 'warning');
        }
    }
    
    updateBrainList() {
        this.brainList.innerHTML = '';
        
        if (this.savedBrains.size === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No saved brains';
            emptyMsg.style.cssText = 'color: #666; font-style: italic; text-align: center; padding: 10px;';
            this.brainList.appendChild(emptyMsg);
            return;
        }
        
        for (const [id, brain] of this.savedBrains) {
            const brainItem = document.createElement('div');
            brainItem.style.cssText = `
                margin: 5px 0; padding: 8px; border: 1px solid #333;
                border-radius: 4px; background: rgba(0,0,0,0.5);
            `;
            
            const brainInfo = document.createElement('div');
            brainInfo.style.cssText = 'margin-bottom: 5px;';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = brain.name;
            nameSpan.style.cssText = 'color: #ffffff; font-weight: bold;';
            brainInfo.appendChild(nameSpan);
            
            const dateSpan = document.createElement('span');
            dateSpan.textContent = ` (${new Date(brain.timestamp).toLocaleString()})`;
            dateSpan.style.cssText = 'color: #888; font-size: 10px;';
            brainInfo.appendChild(dateSpan);
            
            if (brain.metadata.performance) {
                const perfSpan = document.createElement('div');
                const perf = brain.metadata.performance.performance;
                perfSpan.textContent = `Targets: ${perf.successfulReaches}, Collisions: ${perf.wallCollisions}, Milestones: ${brain.metadata.performance.milestones.length}`;
                perfSpan.style.cssText = 'color: #00ff88; font-size: 10px;';
                brainInfo.appendChild(perfSpan);
            }
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 5px;';
            
            const loadBtn = document.createElement('button');
            loadBtn.textContent = '📂 Load';
            loadBtn.style.cssText = `
                flex: 1; padding: 4px; background: #00aa00; color: white;
                border: none; border-radius: 3px; cursor: pointer; font-size: 10px;
            `;
            loadBtn.onclick = () => this.loadBrain(id);
            buttonContainer.appendChild(loadBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.style.cssText = `
                padding: 4px 8px; background: #aa0000; color: white;
                border: none; border-radius: 3px; cursor: pointer; font-size: 10px;
            `;
            deleteBtn.onclick = () => this.deleteBrain(id);
            buttonContainer.appendChild(deleteBtn);
            
            brainItem.appendChild(brainInfo);
            brainItem.appendChild(buttonContainer);
            this.brainList.appendChild(brainItem);
        }
    }
    
    toggleAutoSave(enabled) {
        this.autoSaveEnabled = enabled;
        
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        if (enabled) {
            this.autoSaveInterval = setInterval(() => {
                this.saveBrain(`AutoSave_${new Date().toISOString()}`, { autoSave: true });
            }, 5 * 60 * 1000); // 5 minutes
        }
    }
    
    onMilestoneAchieved(milestone) {
        if (this.milestoneAutoSave) {
            this.saveBrain(`Milestone_${milestone.name}_${Date.now()}`, { milestone: milestone });
        }
    }
    
    exportBrains() {
        const exportData = {
            timestamp: new Date().toISOString(),
            brains: Array.from(this.savedBrains.values())
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `morphogen_brains_${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Brains exported successfully!', 'success');
    }
    
    importBrains(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (importData.brains && Array.isArray(importData.brains)) {
                    for (const brain of importData.brains) {
                        this.savedBrains.set(brain.id, brain);
                    }
                    
                    this.saveBrainsToStorage();
                    this.updateBrainList();
                    this.showNotification(`Imported ${importData.brains.length} brains!`, 'success');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                console.error('Import failed:', error);
                this.showNotification('Failed to import brains!', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    saveBrainsToStorage() {
        try {
            const data = JSON.stringify(Array.from(this.savedBrains.entries()));
            localStorage.setItem('morphogen_saved_brains', data);
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }
    
    loadSavedBrains() {
        try {
            const data = localStorage.getItem('morphogen_saved_brains');
            if (data) {
                const entries = JSON.parse(data);
                this.savedBrains = new Map(entries);
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            this.savedBrains = new Map();
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 50px; right: 50px; z-index: 10000;
            padding: 15px 20px; border-radius: 5px; color: white;
            font-family: 'Courier New', monospace; font-weight: bold;
            background: ${type === 'success' ? '#00aa00' : type === 'error' ? '#aa0000' : type === 'warning' ? '#aa8800' : '#0088aa'};
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}