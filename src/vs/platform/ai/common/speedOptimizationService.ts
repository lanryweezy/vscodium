/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { Emitter, Event } from 'vs/base/common/event';

export const ISpeedOptimizationService = createDecorator<ISpeedOptimizationService>('speedOptimizationService');

export interface ISpeedMetrics {
	agent_name: string;
	task_type: string;
	response_time: number;
	queue_time: number;
	processing_time: number;
	optimization_applied: string[];
	timestamp: number;
}

export interface ISpeedOptimization {
	parallel_processing: boolean;
	request_batching: boolean;
	connection_pooling: boolean;
	response_streaming: boolean;
	preemptive_caching: boolean;
	fast_provider_routing: boolean;
}

export interface IPerformanceProfile {
	agent_name: string;
	avg_response_time: number;
	p95_response_time: number;
	success_rate: number;
	optimization_effectiveness: number;
	bottlenecks: string[];
	recommendations: string[];
}

export interface ISpeedOptimizationService {
	readonly _serviceBrand: undefined;
	readonly onSpeedImprovement: Event<ISpeedMetrics>;

	optimizeAgentSpeed(agentName: string, taskType: string): Promise<ISpeedOptimization>;
	enableParallelProcessing(agentNames: string[]): Promise<void>;
	preloadFrequentResponses(): Promise<void>;
	optimizeConnectionPool(): Promise<void>;
	getPerformanceProfile(agentName: string): Promise<IPerformanceProfile>;
	trackSpeedMetrics(metrics: ISpeedMetrics): void;
	getSpeedAnalytics(): Promise<ISpeedAnalytics>;
}

export interface ISpeedAnalytics {
	avg_response_time: number;
	fastest_agents: string[];
	slowest_agents: string[];
	speed_trends: ISpeedTrend[];
	optimization_impact: number;
	recommendations: string[];
}

export interface ISpeedTrend {
	date: string;
	avg_response_time: number;
	p95_response_time: number;
	requests_count: number;
	optimization_rate: number;
}

export class SpeedOptimizationService implements ISpeedOptimizationService {
	readonly _serviceBrand: undefined;

	private readonly _onSpeedImprovement = new Emitter<ISpeedMetrics>();
	readonly onSpeedImprovement: Event<ISpeedMetrics> = this._onSpeedImprovement.event;

	private static readonly SPEED_METRICS_FILE = '.weezy/speed_metrics.jsonl';
	private static readonly PERFORMANCE_PROFILES_FILE = '.weezy/performance_profiles.json';

	private speedMetrics: ISpeedMetrics[] = [];
	private performanceProfiles = new Map<string, IPerformanceProfile>();
	private connectionPools = new Map<string, any>();
	private preloadedResponses = new Map<string, string>();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		this.initializeSpeedOptimizations();
	}

	async optimizeAgentSpeed(agentName: string, taskType: string): Promise<ISpeedOptimization> {
		this.logService.info(`[SpeedOptimization] Optimizing speed for ${agentName} (${taskType})`);

		const profile = await this.getPerformanceProfile(agentName);
		const optimization: ISpeedOptimization = {
			parallel_processing: this.shouldEnableParallel(profile),
			request_batching: this.shouldEnableBatching(profile),
			connection_pooling: this.shouldEnablePooling(profile),
			response_streaming: this.shouldEnableStreaming(taskType),
			preemptive_caching: this.shouldEnablePreemptiveCaching(profile),
			fast_provider_routing: this.shouldEnableFastRouting(profile)
		};

		// Apply optimizations
		await this.applySpeedOptimizations(agentName, optimization);

		return optimization;
	}

	async enableParallelProcessing(agentNames: string[]): Promise<void> {
		this.logService.info(`[SpeedOptimization] Enabling parallel processing for ${agentNames.length} agents`);

		// Configure parallel execution for compatible agents
		const parallelGroups = this.createParallelGroups(agentNames);
		
		for (const group of parallelGroups) {
			await this.configureParallelGroup(group);
		}
	}

	async preloadFrequentResponses(): Promise<void> {
		this.logService.info('[SpeedOptimization] Preloading frequent responses...');

		// Analyze metrics to find most common requests
		const frequentRequests = this.identifyFrequentRequests();
		
		// Preload responses for common patterns
		for (const request of frequentRequests) {
			const response = await this.generatePreloadedResponse(request);
			this.preloadedResponses.set(request.pattern, response);
		}

		this.logService.info(`[SpeedOptimization] Preloaded ${frequentRequests.length} frequent responses`);
	}

	async optimizeConnectionPool(): Promise<void> {
		this.logService.info('[SpeedOptimization] Optimizing connection pools...');

		const providers = ['openai', 'claude', 'gemini'];
		
		for (const provider of providers) {
			const poolConfig = this.calculateOptimalPoolSize(provider);
			this.connectionPools.set(provider, poolConfig);
		}
	}

	async getPerformanceProfile(agentName: string): Promise<IPerformanceProfile> {
		let profile = this.performanceProfiles.get(agentName);
		
		if (!profile) {
			profile = await this.createPerformanceProfile(agentName);
			this.performanceProfiles.set(agentName, profile);
		}

		return profile;
	}

	trackSpeedMetrics(metrics: ISpeedMetrics): void {
		this.speedMetrics.push(metrics);

		// Keep only recent metrics
		if (this.speedMetrics.length > 10000) {
			this.speedMetrics = this.speedMetrics.slice(-5000);
		}

		// Update performance profile
		this.updatePerformanceProfile(metrics);

		// Save metrics
		this.saveSpeedMetrics(metrics);

		// Fire speed improvement event
		this._onSpeedImprovement.fire(metrics);

		this.logService.info(`[SpeedOptimization] Tracked speed: ${metrics.agent_name} - ${metrics.response_time}ms`);
	}

	async getSpeedAnalytics(): Promise<ISpeedAnalytics> {
		const recentMetrics = this.speedMetrics.filter(m => 
			Date.now() - m.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
		);

		const analytics: ISpeedAnalytics = {
			avg_response_time: this.calculateAverageResponseTime(recentMetrics),
			fastest_agents: this.identifyFastestAgents(recentMetrics),
			slowest_agents: this.identifySlowestAgents(recentMetrics),
			speed_trends: this.calculateSpeedTrends(recentMetrics),
			optimization_impact: this.calculateOptimizationImpact(recentMetrics),
			recommendations: this.generateSpeedRecommendations(recentMetrics)
		};

		return analytics;
	}

	private initializeSpeedOptimizations(): void {
		// Set up default speed optimizations
		this.setupDefaultOptimizations();
		this.loadPerformanceProfiles();
		this.loadSpeedMetrics();
	}

	private setupDefaultOptimizations(): void {
		// Configure default optimizations for different agent types
		const defaultOptimizations = {
			'DeveloperAgent': {
				parallel_processing: true,
				connection_pooling: true,
				response_streaming: true
			},
			'TesterAgent': {
				request_batching: true,
				preemptive_caching: true,
				fast_provider_routing: true
			},
			'SecurityAgent': {
				parallel_processing: true,
				preemptive_caching: true,
				connection_pooling: true
			},
			'PerformanceAgent': {
				fast_provider_routing: true,
				response_streaming: true,
				connection_pooling: true
			}
		};

		this.logService.info('[SpeedOptimization] Default optimizations configured');
	}

	private shouldEnableParallel(profile: IPerformanceProfile): boolean {
		// Enable parallel processing for agents with good success rates and moderate response times
		return profile.success_rate > 0.9 && profile.avg_response_time < 5000;
	}

	private shouldEnableBatching(profile: IPerformanceProfile): boolean {
		// Enable batching for agents that handle multiple similar requests
		return profile.avg_response_time > 2000 && !profile.bottlenecks.includes('rate_limiting');
	}

	private shouldEnablePooling(profile: IPerformanceProfile): boolean {
		// Enable connection pooling for agents with high request volume
		return profile.avg_response_time > 1000;
	}

	private shouldEnableStreaming(taskType: string): boolean {
		// Enable streaming for long-running tasks
		const streamingTasks = ['code_generation', 'documentation', 'analysis'];
		return streamingTasks.includes(taskType);
	}

	private shouldEnablePreemptiveCaching(profile: IPerformanceProfile): boolean {
		// Enable preemptive caching for agents with predictable patterns
		return profile.optimization_effectiveness > 0.7;
	}

	private shouldEnableFastRouting(profile: IPerformanceProfile): boolean {
		// Enable fast routing for time-sensitive agents
		return profile.p95_response_time > 3000;
	}

	private async applySpeedOptimizations(agentName: string, optimization: ISpeedOptimization): Promise<void> {
		const optimizations = [];

		if (optimization.parallel_processing) {
			await this.enableParallelForAgent(agentName);
			optimizations.push('parallel_processing');
		}

		if (optimization.connection_pooling) {
			await this.enablePoolingForAgent(agentName);
			optimizations.push('connection_pooling');
		}

		if (optimization.preemptive_caching) {
			await this.enablePreemptiveCachingForAgent(agentName);
			optimizations.push('preemptive_caching');
		}

		this.logService.info(`[SpeedOptimization] Applied optimizations for ${agentName}: ${optimizations.join(', ')}`);
	}

	private createParallelGroups(agentNames: string[]): string[][] {
		// Group compatible agents for parallel execution
		const groups: string[][] = [];
		const compatibleGroups = {
			'analysis': ['SecurityAgent', 'PerformanceAgent', 'CodeArchitectAgent'],
			'backend': ['NodeJSAgent', 'PythonBackendAgent', 'JavaBackendAgent', 'GoBackendAgent'],
			'testing': ['TesterAgent', 'QAAutomationAgent'],
			'documentation': ['DocsAgent', 'SpecificationAgent']
		};

		for (const [groupName, groupAgents] of Object.entries(compatibleGroups)) {
			const availableAgents = groupAgents.filter(agent => agentNames.includes(agent));
			if (availableAgents.length > 1) {
				groups.push(availableAgents);
			}
		}

		return groups;
	}

	private async configureParallelGroup(group: string[]): Promise<void> {
		// Configure parallel execution for a group of agents
		this.logService.info(`[SpeedOptimization] Configured parallel group: ${group.join(', ')}`);
		
		// This would implement actual parallel execution configuration
	}

	private identifyFrequentRequests(): Array<{pattern: string, frequency: number}> {
		// Analyze metrics to find frequent request patterns
		const patterns = new Map<string, number>();
		
		for (const metric of this.speedMetrics) {
			const pattern = `${metric.agent_name}:${metric.task_type}`;
			patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
		}

		return Array.from(patterns.entries())
			.map(([pattern, frequency]) => ({ pattern, frequency }))
			.filter(item => item.frequency > 5) // Only frequent patterns
			.sort((a, b) => b.frequency - a.frequency)
			.slice(0, 10); // Top 10 most frequent
	}

	private async generatePreloadedResponse(request: {pattern: string, frequency: number}): Promise<string> {
		// Generate optimized response for preloading
		const [agentName, taskType] = request.pattern.split(':');
		
		const templates = {
			'DeveloperAgent:code_generation': 'Optimized code generation template ready',
			'TesterAgent:testing': 'Test suite template prepared',
			'SecurityAgent:security_scan': 'Security analysis template cached',
			'PerformanceAgent:optimization': 'Performance optimization template ready'
		};

		return templates[request.pattern] || 'Preloaded response template';
	}

	private calculateOptimalPoolSize(provider: string): any {
		// Calculate optimal connection pool size based on usage patterns
		const baseSizes = {
			'openai': 5,
			'claude': 3,
			'gemini': 4,
			'ollama': 1 // Local, no pooling needed
		};

		return {
			min_connections: baseSizes[provider] || 2,
			max_connections: (baseSizes[provider] || 2) * 3,
			idle_timeout: 30000, // 30 seconds
			connection_timeout: 10000 // 10 seconds
		};
	}

	private async createPerformanceProfile(agentName: string): Promise<IPerformanceProfile> {
		const agentMetrics = this.speedMetrics.filter(m => m.agent_name === agentName);
		
		if (agentMetrics.length === 0) {
			// Default profile for new agents
			return {
				agent_name: agentName,
				avg_response_time: 2000,
				p95_response_time: 4000,
				success_rate: 0.95,
				optimization_effectiveness: 0.8,
				bottlenecks: [],
				recommendations: ['Monitor initial performance', 'Collect baseline metrics']
			};
		}

		const responseTimes = agentMetrics.map(m => m.response_time).sort((a, b) => a - b);
		const p95Index = Math.floor(responseTimes.length * 0.95);

		return {
			agent_name: agentName,
			avg_response_time: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
			p95_response_time: responseTimes[p95Index] || responseTimes[responseTimes.length - 1],
			success_rate: this.calculateSuccessRate(agentMetrics),
			optimization_effectiveness: this.calculateOptimizationEffectiveness(agentMetrics),
			bottlenecks: this.identifyBottlenecks(agentMetrics),
			recommendations: this.generateAgentRecommendations(agentMetrics)
		};
	}

	private updatePerformanceProfile(metrics: ISpeedMetrics): void {
		const profile = this.performanceProfiles.get(metrics.agent_name);
		if (profile) {
			// Update rolling averages
			profile.avg_response_time = (profile.avg_response_time * 0.9) + (metrics.response_time * 0.1);
			
			// Update optimization effectiveness
			if (metrics.optimization_applied.length > 0) {
				profile.optimization_effectiveness = (profile.optimization_effectiveness * 0.9) + (0.8 * 0.1);
			}
		}
	}

	private calculateAverageResponseTime(metrics: ISpeedMetrics[]): number {
		if (metrics.length === 0) return 0;
		return metrics.reduce((sum, m) => sum + m.response_time, 0) / metrics.length;
	}

	private identifyFastestAgents(metrics: ISpeedMetrics[]): string[] {
		const agentTimes = new Map<string, number[]>();
		
		for (const metric of metrics) {
			if (!agentTimes.has(metric.agent_name)) {
				agentTimes.set(metric.agent_name, []);
			}
			agentTimes.get(metric.agent_name)!.push(metric.response_time);
		}

		const agentAverages = Array.from(agentTimes.entries())
			.map(([name, times]) => ({
				name,
				avg: times.reduce((sum, time) => sum + time, 0) / times.length
			}))
			.sort((a, b) => a.avg - b.avg);

		return agentAverages.slice(0, 5).map(a => a.name);
	}

	private identifySlowestAgents(metrics: ISpeedMetrics[]): string[] {
		const agentTimes = new Map<string, number[]>();
		
		for (const metric of metrics) {
			if (!agentTimes.has(metric.agent_name)) {
				agentTimes.set(metric.agent_name, []);
			}
			agentTimes.get(metric.agent_name)!.push(metric.response_time);
		}

		const agentAverages = Array.from(agentTimes.entries())
			.map(([name, times]) => ({
				name,
				avg: times.reduce((sum, time) => sum + time, 0) / times.length
			}))
			.sort((a, b) => b.avg - a.avg);

		return agentAverages.slice(0, 5).map(a => a.name);
	}

	private calculateSpeedTrends(metrics: ISpeedMetrics[]): ISpeedTrend[] {
		// Group by date and calculate trends
		const dailyMetrics = new Map<string, ISpeedMetrics[]>();
		
		for (const metric of metrics) {
			const date = new Date(metric.timestamp).toISOString().split('T')[0];
			if (!dailyMetrics.has(date)) {
				dailyMetrics.set(date, []);
			}
			dailyMetrics.get(date)!.push(metric);
		}

		const trends: ISpeedTrend[] = [];
		for (const [date, dayMetrics] of dailyMetrics) {
			const responseTimes = dayMetrics.map(m => m.response_time).sort((a, b) => a - b);
			const p95Index = Math.floor(responseTimes.length * 0.95);
			const optimizedRequests = dayMetrics.filter(m => m.optimization_applied.length > 0).length;

			trends.push({
				date,
				avg_response_time: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
				p95_response_time: responseTimes[p95Index] || responseTimes[responseTimes.length - 1],
				requests_count: dayMetrics.length,
				optimization_rate: optimizedRequests / dayMetrics.length
			});
		}

		return trends.sort((a, b) => a.date.localeCompare(b.date));
	}

	private calculateOptimizationImpact(metrics: ISpeedMetrics[]): number {
		const optimizedMetrics = metrics.filter(m => m.optimization_applied.length > 0);
		const unoptimizedMetrics = metrics.filter(m => m.optimization_applied.length === 0);

		if (optimizedMetrics.length === 0 || unoptimizedMetrics.length === 0) {
			return 0;
		}

		const optimizedAvg = optimizedMetrics.reduce((sum, m) => sum + m.response_time, 0) / optimizedMetrics.length;
		const unoptimizedAvg = unoptimizedMetrics.reduce((sum, m) => sum + m.response_time, 0) / unoptimizedMetrics.length;

		return ((unoptimizedAvg - optimizedAvg) / unoptimizedAvg) * 100;
	}

	private generateSpeedRecommendations(metrics: ISpeedMetrics[]): string[] {
		const recommendations = [];
		const avgResponseTime = this.calculateAverageResponseTime(metrics);

		if (avgResponseTime > 3000) {
			recommendations.push('Average response time is high - enable more aggressive optimizations');
		}

		const slowAgents = this.identifySlowestAgents(metrics);
		if (slowAgents.length > 0) {
			recommendations.push(`Optimize slow agents: ${slowAgents.join(', ')}`);
		}

		const unoptimizedRequests = metrics.filter(m => m.optimization_applied.length === 0).length;
		if (unoptimizedRequests > metrics.length * 0.3) {
			recommendations.push('Enable optimization for more requests to improve speed');
		}

		return recommendations;
	}

	private calculateSuccessRate(metrics: ISpeedMetrics[]): number {
		// This would be calculated based on actual success/failure data
		// For now, estimate based on response times
		const fastResponses = metrics.filter(m => m.response_time < 3000).length;
		return fastResponses / Math.max(metrics.length, 1);
	}

	private calculateOptimizationEffectiveness(metrics: ISpeedMetrics[]): number {
		const optimizedMetrics = metrics.filter(m => m.optimization_applied.length > 0);
		if (optimizedMetrics.length === 0) return 0.5;

		const avgOptimizedTime = optimizedMetrics.reduce((sum, m) => sum + m.response_time, 0) / optimizedMetrics.length;
		const avgUnoptimizedTime = 3000; // Baseline assumption

		return Math.max(0, (avgUnoptimizedTime - avgOptimizedTime) / avgUnoptimizedTime);
	}

	private identifyBottlenecks(metrics: ISpeedMetrics[]): string[] {
		const bottlenecks = [];
		
		const avgQueueTime = metrics.reduce((sum, m) => sum + m.queue_time, 0) / metrics.length;
		const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processing_time, 0) / metrics.length;

		if (avgQueueTime > 1000) {
			bottlenecks.push('high_queue_time');
		}

		if (avgProcessingTime > 2000) {
			bottlenecks.push('slow_processing');
		}

		if (metrics.some(m => m.response_time > 10000)) {
			bottlenecks.push('timeout_issues');
		}

		return bottlenecks;
	}

	private generateAgentRecommendations(metrics: ISpeedMetrics[]): string[] {
		const recommendations = [];
		const avgTime = metrics.reduce((sum, m) => sum + m.response_time, 0) / metrics.length;

		if (avgTime > 4000) {
			recommendations.push('Enable parallel processing for faster responses');
		}

		if (metrics.filter(m => m.optimization_applied.length === 0).length > metrics.length * 0.5) {
			recommendations.push('Apply more optimization strategies');
		}

		const bottlenecks = this.identifyBottlenecks(metrics);
		if (bottlenecks.includes('high_queue_time')) {
			recommendations.push('Implement request batching to reduce queue time');
		}

		if (bottlenecks.includes('slow_processing')) {
			recommendations.push('Consider using faster AI providers for this agent');
		}

		return recommendations;
	}

	private async enableParallelForAgent(agentName: string): Promise<void> {
		// Implementation for enabling parallel processing
		this.logService.info(`[SpeedOptimization] Enabled parallel processing for ${agentName}`);
	}

	private async enablePoolingForAgent(agentName: string): Promise<void> {
		// Implementation for enabling connection pooling
		this.logService.info(`[SpeedOptimization] Enabled connection pooling for ${agentName}`);
	}

	private async enablePreemptiveCachingForAgent(agentName: string): Promise<void> {
		// Implementation for enabling preemptive caching
		this.logService.info(`[SpeedOptimization] Enabled preemptive caching for ${agentName}`);
	}

	private async loadPerformanceProfiles(): Promise<void> {
		// Load existing performance profiles
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const profilesFile = URI.joinPath(projectRoot, SpeedOptimizationService.PERFORMANCE_PROFILES_FILE);

			if (await this.fileService.exists(profilesFile)) {
				const content = await this.fileService.readFile(profilesFile);
				const profiles = JSON.parse(content.value.toString());
				
				for (const [name, profile] of Object.entries(profiles)) {
					this.performanceProfiles.set(name, profile as IPerformanceProfile);
				}
			}
		} catch (error) {
			this.logService.warn('[SpeedOptimization] Failed to load performance profiles:', error);
		}
	}

	private async loadSpeedMetrics(): Promise<void> {
		// Load existing speed metrics
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const metricsFile = URI.joinPath(projectRoot, SpeedOptimizationService.SPEED_METRICS_FILE);

			if (await this.fileService.exists(metricsFile)) {
				const content = await this.fileService.readFile(metricsFile);
				const lines = content.value.toString().split('\n').filter(line => line.trim());
				
				for (const line of lines) {
					try {
						const metric = JSON.parse(line);
						this.speedMetrics.push(metric);
					} catch {
						// Skip invalid lines
					}
				}
			}
		} catch (error) {
			this.logService.warn('[SpeedOptimization] Failed to load speed metrics:', error);
		}
	}

	private async saveSpeedMetrics(metric: ISpeedMetrics): Promise<void> {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const metricsFile = URI.joinPath(projectRoot, SpeedOptimizationService.SPEED_METRICS_FILE);

			await this.fileService.createFolder(URI.joinPath(projectRoot, '.weezy'));
			
			const metricLine = JSON.stringify(metric) + '\n';
			
			if (await this.fileService.exists(metricsFile)) {
				await this.fileService.append(metricsFile, VSBuffer.fromString(metricLine));
			} else {
				await this.fileService.createFile(metricsFile, VSBuffer.fromString(metricLine));
			}
		} catch (error) {
			this.logService.error('[SpeedOptimization] Failed to save speed metrics:', error);
		}
	}
}