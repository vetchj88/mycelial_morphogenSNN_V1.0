// src/performance_tracker.js - Agent Performance Analytics

export class PerformanceTracker {
    constructor() {
        this.sessions = [];
        this.currentSession = null;
        this.milestones = [];
        this.startTime = Date.now();
        
        // Performance metrics
        this.metrics = {
            totalReward: 0,
            episodeCount: 0,
            successfulReaches: 0,
            wallCollisions: 0,
            averageEpisodeDuration: 0,
            bestRewardStreak: 0,
            currentStreak: 0,
            explorationCoverage: new Set(),
            learningRate: 0,
            recentPerformance: []
        };
        
        // Milestone definitions
        this.milestoneDefinitions = [
            { id: 'first_move', name: 'First Movement', condition: (metrics) => metrics.totalSteps > 0 && this.hasMovedFromStart },
            { id: 'first_target', name: 'First Target Hit', condition: (metrics) => metrics.successfulReaches > 0 },
            { id: 'consistent_mover', name: 'Consistent Movement', condition: (metrics) => this.averageSpeed > 0.1 },
            { id: 'wall_avoider', name: 'Wall Avoidance', condition: (metrics) => metrics.wallCollisions < metrics.episodeCount * 0.1 && metrics.episodeCount > 10 },
            { id: 'target_seeker', name: 'Target Seeker', condition: (metrics) => metrics.successfulReaches > 5 },
            { id: 'expert_navigator', name: 'Expert Navigator', condition: (metrics) => metrics.successfulReaches > 20 && metrics.wallCollisions < metrics.successfulReaches * 0.2 },
            { id: 'speed_demon', name: 'Speed Demon', condition: (metrics) => this.averageSpeed > 1.0 && metrics.successfulReaches > 10 }
        ];
        
        this.hasMovedFromStart = false;
        this.lastPosition = { x: 0, z: 8 };
        this.speedHistory = [];
        this.averageSpeed = 0;
        
        this.initializeTracking();
    }
    
    initializeTracking() {
        this.currentSession = {
            id: Date.now(),
            startTime: Date.now(),
            steps: 0,
            rewards: [],
            positions: [],
            events: [],
            brainStats: []
        };
    }
    
    update(agent, sensoryData, brainOutput, motorCommands) {
        this.currentSession.steps++;
        this.currentSession.rewards.push(agent.reward);
        this.currentSession.positions.push({ 
            x: sensoryData.position.x, 
            z: sensoryData.position.z, 
            timestamp: Date.now() 
        });
        
        if (brainOutput.learning_stats) {
            this.currentSession.brainStats.push({
                timestamp: Date.now(),
                ...brainOutput.learning_stats
            });
        }
        
        // Update metrics
        this.metrics.totalReward += agent.reward;
        this.updateMovementTracking(sensoryData);
        this.updateExplorationCoverage(sensoryData.position);
        this.checkMilestones();
        
        // Track recent performance (last 100 steps)
        this.metrics.recentPerformance.push({
            reward: agent.reward,
            speed: Math.sqrt(sensoryData.velocity.x**2 + sensoryData.velocity.z**2),
            timestamp: Date.now()
        });
        
        if (this.metrics.recentPerformance.length > 100) {
            this.metrics.recentPerformance.shift();
        }
    }
    
    updateMovementTracking(sensoryData) {
        const currentPos = sensoryData.position;
        const distance = Math.sqrt(
            (currentPos.x - this.lastPosition.x)**2 + 
            (currentPos.z - this.lastPosition.z)**2
        );
        
        if (distance > 0.5) {
            this.hasMovedFromStart = true;
        }
        
        const speed = Math.sqrt(sensoryData.velocity.x**2 + sensoryData.velocity.z**2);
        this.speedHistory.push(speed);
        
        if (this.speedHistory.length > 50) {
            this.speedHistory.shift();
        }
        
        this.averageSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
        this.lastPosition = { ...currentPos };
    }
    
    updateExplorationCoverage(position) {
        // Discretize position into grid cells for exploration tracking
        const gridX = Math.floor(position.x / 2);
        const gridZ = Math.floor(position.z / 2);
        this.metrics.explorationCoverage.add(`${gridX},${gridZ}`);
    }
    
    recordEvent(eventType, data = {}) {
        const event = {
            type: eventType,
            timestamp: Date.now(),
            step: this.currentSession.steps,
            data: data
        };
        
        this.currentSession.events.push(event);
        
        // Update specific metrics based on event type
        switch (eventType) {
            case 'target_hit':
                this.metrics.successfulReaches++;
                this.metrics.currentStreak++;
                if (this.metrics.currentStreak > this.metrics.bestRewardStreak) {
                    this.metrics.bestRewardStreak = this.metrics.currentStreak;
                }
                break;
            case 'wall_collision':
                this.metrics.wallCollisions++;
                this.metrics.currentStreak = 0;
                break;
            case 'episode_end':
                this.metrics.episodeCount++;
                this.calculateAverageEpisodeDuration();
                break;
        }
    }
    
    calculateAverageEpisodeDuration() {
        const episodes = this.currentSession.events.filter(e => e.type === 'episode_end');
        if (episodes.length > 1) {
            const durations = [];
            for (let i = 1; i < episodes.length; i++) {
                durations.push(episodes[i].timestamp - episodes[i-1].timestamp);
            }
            this.metrics.averageEpisodeDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        }
    }
    
    checkMilestones() {
        for (const milestone of this.milestoneDefinitions) {
            if (!this.milestones.find(m => m.id === milestone.id)) {
                if (milestone.condition(this.metrics)) {
                    const achievedMilestone = {
                        ...milestone,
                        achievedAt: Date.now(),
                        step: this.currentSession.steps
                    };
                    this.milestones.push(achievedMilestone);
                    this.recordEvent('milestone_achieved', achievedMilestone);
                    console.log(`🏆 MILESTONE ACHIEVED: ${milestone.name}!`);
                }
            }
        }
    }
    
    getPerformanceReport() {
        const sessionDuration = Date.now() - this.currentSession.startTime;
        const recentRewards = this.metrics.recentPerformance.map(p => p.reward);
        const recentAvgReward = recentRewards.length > 0 ? 
            recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length : 0;
        
        return {
            session: {
                duration: sessionDuration,
                steps: this.currentSession.steps,
                stepsPerMinute: (this.currentSession.steps / (sessionDuration / 60000)).toFixed(1)
            },
            performance: {
                ...this.metrics,
                explorationCoverageCount: this.metrics.explorationCoverage.size,
                recentAvgReward: recentAvgReward,
                averageSpeed: this.averageSpeed
            },
            milestones: this.milestones,
            recentEvents: this.currentSession.events.slice(-10)
        };
    }
    
    exportSession() {
        return {
            ...this.currentSession,
            metrics: this.metrics,
            milestones: this.milestones,
            report: this.getPerformanceReport()
        };
    }
    
    reset() {
        this.sessions.push(this.currentSession);
        this.initializeTracking();
        this.metrics = {
            totalReward: 0,
            episodeCount: 0,
            successfulReaches: 0,
            wallCollisions: 0,
            averageEpisodeDuration: 0,
            bestRewardStreak: 0,
            currentStreak: 0,
            explorationCoverage: new Set(),
            recentPerformance: []
        };
        this.milestones = [];
        this.hasMovedFromStart = false;
    }
}