/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILlmCommsService, LlmRequest, LlmResponse } from 'vs/platform/ai/common/aiTypes';
import { ITokenOptimizationService } from 'vs/platform/ai/common/tokenOptimizationService';
import { ILogService } from 'vs/platform/log/common/log';
import { IConfigurationService } from 'vs/platform/ai/common/configurationService';
import { IRequestService } from 'vs/platform/request/common/request';

export interface ICostOptimizedRequest extends LlmRequest {
	priority: 'low' | 'medium' | 'high' | 'critical';
	max_tokens?: number;
	cost_limit?: number;
	speed_priority?: boolean;
	cache_ttl?: number;
}

export interface ICostOptimizedResponse extends LlmResponse {
	optimization_applied: boolean;
	original_token_estimate: number;
	actual_tokens_used: number;
	cost_savings: number;
	response_time: number;
	provider_used: string;
	cache_hit: boolean;
}

export class CostOptimizedLlmService implements ILlmCommsService {
	readonly _serviceBrand: undefined;

	private readonly costBudgets = new Map<string, number>();
	private readonly speedThresholds = new Map<string, number>();
	private readonly requestQueue: ICostOptimizedRequest[] = [];
	private readonly batchProcessor: NodeJS.Timeout | null = null;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRequestService private readonly requestService: IRequestService,
		@ITokenOptimizationService private readonly tokenOptimizationService: ITokenOptimizationService,
	) {
		this.initializeCostManagement();
	}

	async sendMessage(taskId: string, request: LlmRequest): Promise<LlmResponse> {
		const optimizedRequest = request as ICostOptimizedRequest;
		const startTime = Date.now();

		try {
			// 1. Generate prompt hash for caching
			const promptHash = this.generatePromptHash(optimizedRequest.prompt);
			
			// 2. Check cache first
			const cachedResponse = await this.tokenOptimizationService.getCachedResponse(promptHash);
			if (cachedResponse) {
				this.logService.info(`[CostOptimizedLlm] Cache hit for task ${taskId}`);
				return this.createCachedResponse(cachedResponse, startTime);
			}

			// 3. Optimize prompt for cost and efficiency
			const optimizedPrompt = await this.tokenOptimizationService.optimizePrompt(
				optimizedRequest.prompt,
				optimizedRequest.context?.task_type || 'general',
				optimizedRequest.agentName || 'unknown'
			);

			// 4. Select optimal provider
			const optimalProvider = this.tokenOptimizationService.selectOptimalProvider(
				optimizedRequest.context?.task_type || 'general',
				optimizedPrompt.length,
				optimizedRequest.speed_priority || false
			);

			// 5. Apply cost optimization
			const costOptimization = await this.tokenOptimizationService.optimizeForCost(optimizedPrompt, optimizedRequest.context);

			// 6. Check cost limits
			if (optimizedRequest.cost_limit && costOptimization.optimized_cost > optimizedRequest.cost_limit) {
				return this.handleCostLimitExceeded(optimizedRequest, costOptimization);
			}

			// 7. Send optimized request
			const response = await this.sendOptimizedRequest(
				optimizedPrompt,
				optimalProvider,
				optimizedRequest,
				taskId
			);

			// 8. Cache response
			const cacheKey = this.generatePromptHash(optimizedPrompt);
			await this.tokenOptimizationService.cacheResponse(
				cacheKey,
				response.content,
				optimizedRequest.cache_ttl || 3600000 // 1 hour default
			);

			// 9. Track metrics
			this.trackOptimizedUsage(taskId, optimizedRequest, response, optimalProvider, startTime, costOptimization);

			return response;

		} catch (error) {
			this.logService.error(`[CostOptimizedLlm] Request failed for task ${taskId}:`, error);
			throw error;
		}
	}

	getAvailableProviders(): string[] {
		return ['openai', 'claude', 'gemini', 'ollama'];
	}

	setProviderConfig(provider: string, config: any): void {
		// Implementation would update provider configurations
		this.logService.info(`[CostOptimizedLlm] Updated config for provider: ${provider}`);
	}

	/**
	 * Batch multiple requests for cost efficiency
	 */
	async batchOptimizedRequests(requests: ICostOptimizedRequest[]): Promise<ICostOptimizedResponse[]> {
		this.logService.info(`[CostOptimizedLlm] Processing batch of ${requests.length} requests`);

		// Group requests by provider and priority
		const grouped = this.groupRequestsForBatching(requests);
		const responses: ICostOptimizedResponse[] = [];

		for (const [provider, providerRequests] of grouped) {
			// Process high priority first
			const prioritized = providerRequests.sort((a, b) => {
				const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
				return priorityOrder[a.priority] - priorityOrder[b.priority];
			});

			// Batch process requests for this provider
			const batchResponses = await this.processBatchForProvider(provider, prioritized);
			responses.push(...batchResponses);
		}

		return responses;
	}

	/**
	 * Set cost budget for an agent or task type
	 */
	setCostBudget(identifier: string, dailyBudget: number): void {
		this.costBudgets.set(identifier, dailyBudget);
		this.logService.info(`[CostOptimizedLlm] Set daily cost budget for ${identifier}: $${dailyBudget}`);
	}

	/**
	 * Set speed threshold for an agent or task type
	 */
	setSpeedThreshold(identifier: string, maxResponseTime: number): void {
		this.speedThresholds.set(identifier, maxResponseTime);
		this.logService.info(`[CostOptimizedLlm] Set speed threshold for ${identifier}: ${maxResponseTime}ms`);
	}

	/**
	 * Get real-time cost and performance metrics
	 */
	async getRealTimeMetrics(): Promise<any> {
		const analytics = await this.tokenOptimizationService.getCostAnalytics('day');
		
		return {
			daily_cost: analytics.total_cost,
			daily_tokens: analytics.total_tokens,
			avg_response_time: analytics.efficiency_trends.length > 0 ? 
				analytics.efficiency_trends[analytics.efficiency_trends.length - 1].avg_response_time : 0,
			cost_by_provider: analytics.cost_by_provider,
			cost_by_agent: analytics.cost_by_agent,
			efficiency_score: this.calculateOverallEfficiency(analytics),
			recommendations: analytics.recommendations
		};
	}

	private initializeCostManagement(): void {
		// Set default cost budgets for different agent types
		this.setCostBudget('DeveloperAgent', 5.00); // $5/day for development tasks
		this.setCostBudget('TesterAgent', 2.00); // $2/day for testing
		this.setCostBudget('SecurityAgent', 3.00); // $3/day for security scans
		this.setCostBudget('PerformanceAgent', 2.50); // $2.50/day for optimization
		this.setCostBudget('DocumentationAgent', 1.50); // $1.50/day for docs

		// Set speed thresholds
		this.setSpeedThreshold('critical_task', 1000); // 1 second for critical
		this.setSpeedThreshold('interactive_task', 2000); // 2 seconds for interactive
		this.setSpeedThreshold('background_task', 5000); // 5 seconds for background
	}

	private generatePromptHash(prompt: string): string {
		// Generate consistent hash for caching
		let hash = 0;
		for (let i = 0; i < prompt.length; i++) {
			const char = prompt.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}

	private createCachedResponse(cachedContent: string, startTime: number): ICostOptimizedResponse {
		return {
			content: cachedContent,
			metadata: {
				tokensUsed: 0,
				model: 'cached',
				provider: 'cache'
			},
			optimization_applied: true,
			original_token_estimate: 0,
			actual_tokens_used: 0,
			cost_savings: 0.05, // Assume average cost saved
			response_time: Date.now() - startTime,
			provider_used: 'cache',
			cache_hit: true
		};
	}

	private async sendOptimizedRequest(
		prompt: string,
		provider: string,
		request: ICostOptimizedRequest,
		taskId: string
	): Promise<ICostOptimizedResponse> {
		const startTime = Date.now();

		// This would integrate with actual LLM providers
		// For now, simulate optimized response
		const estimatedTokens = Math.ceil(prompt.length / 4);
		const providerProfile = this.tokenOptimizationService['providerProfiles'].get(provider);
		const estimatedCost = estimatedTokens * (providerProfile?.cost_per_input_token || 0.00003);

		// Simulate AI response
		const response: ICostOptimizedResponse = {
			content: `Optimized response from ${provider} for ${request.agentName}`,
			metadata: {
				tokensUsed: estimatedTokens,
				model: providerProfile?.name || provider,
				provider: provider
			},
			optimization_applied: true,
			original_token_estimate: Math.ceil(request.prompt.length / 4),
			actual_tokens_used: estimatedTokens,
			cost_savings: (Math.ceil(request.prompt.length / 4) - estimatedTokens) * 0.00003,
			response_time: Date.now() - startTime,
			provider_used: provider,
			cache_hit: false
		};

		return response;
	}

	private handleCostLimitExceeded(
		request: ICostOptimizedRequest,
		optimization: any
	): ICostOptimizedResponse {
		this.logService.warn(`[CostOptimizedLlm] Cost limit exceeded: ${optimization.optimized_cost} > ${request.cost_limit}`);

		// Return cost-limited response
		return {
			content: 'Request exceeded cost limit. Please simplify the request or increase the cost limit.',
			metadata: {
				tokensUsed: 0,
				model: 'cost_limited',
				provider: 'none'
			},
			optimization_applied: true,
			original_token_estimate: optimization.original_cost / 0.00003,
			actual_tokens_used: 0,
			cost_savings: optimization.original_cost,
			response_time: 0,
			provider_used: 'cost_limiter',
			cache_hit: false
		};
	}

	private trackOptimizedUsage(
		taskId: string,
		request: ICostOptimizedRequest,
		response: ICostOptimizedResponse,
		provider: string,
		startTime: number,
		optimization: any
	): void {
		const metrics = {
			provider: provider,
			model: response.metadata?.model || 'unknown',
			tokensUsed: response.actual_tokens_used,
			cost: response.metadata?.tokensUsed ? 
				response.metadata.tokensUsed * (this.tokenOptimizationService['providerProfiles'].get(provider)?.cost_per_input_token || 0.00003) : 0,
			responseTime: Date.now() - startTime,
			taskType: request.context?.task_type || 'general',
			agentName: request.agentName || 'unknown',
			timestamp: Date.now(),
			efficiency_score: 0 // Will be calculated by tokenOptimizationService
		};

		this.tokenOptimizationService.trackTokenUsage(metrics);
	}

	private groupRequestsForBatching(requests: ICostOptimizedRequest[]): Map<string, ICostOptimizedRequest[]> {
		const grouped = new Map<string, ICostOptimizedRequest[]>();

		for (const request of requests) {
			const provider = this.tokenOptimizationService.selectOptimalProvider(
				request.context?.task_type || 'general',
				request.prompt.length,
				request.speed_priority || false
			);

			if (!grouped.has(provider)) {
				grouped.set(provider, []);
			}
			grouped.get(provider)!.push(request);
		}

		return grouped;
	}

	private async processBatchForProvider(
		provider: string,
		requests: ICostOptimizedRequest[]
	): Promise<ICostOptimizedResponse[]> {
		const responses: ICostOptimizedResponse[] = [];

		// Process requests with intelligent batching
		const batchSize = this.getOptimalBatchSize(provider);
		
		for (let i = 0; i < requests.length; i += batchSize) {
			const batch = requests.slice(i, i + batchSize);
			const batchResponses = await this.processBatch(provider, batch);
			responses.push(...batchResponses);

			// Add delay between batches to respect rate limits
			if (i + batchSize < requests.length) {
				await this.delay(this.getBatchDelay(provider));
			}
		}

		return responses;
	}

	private async processBatch(
		provider: string,
		batch: ICostOptimizedRequest[]
	): Promise<ICostOptimizedResponse[]> {
		// Process batch of requests efficiently
		const promises = batch.map(request => 
			this.sendOptimizedRequest(request.prompt, provider, request, `batch_${Date.now()}`)
		);

		return Promise.all(promises);
	}

	private getOptimalBatchSize(provider: string): number {
		const batchSizes = {
			'openai': 5,    // OpenAI handles moderate batching well
			'claude': 3,    // Claude prefers smaller batches
			'gemini': 8,    // Gemini can handle larger batches
			'ollama': 1     // Local processing, no batching needed
		};

		return batchSizes[provider] || 3;
	}

	private getBatchDelay(provider: string): number {
		const delays = {
			'openai': 1000,  // 1 second between batches
			'claude': 1500,  // 1.5 seconds between batches
			'gemini': 800,   // 0.8 seconds between batches
			'ollama': 0      // No delay for local processing
		};

		return delays[provider] || 1000;
	}

	private calculateOverallEfficiency(analytics: any): number {
		let efficiency = 100;

		// Cost efficiency
		if (analytics.total_cost > 10) efficiency -= 20; // High daily cost
		else if (analytics.total_cost > 5) efficiency -= 10;

		// Speed efficiency
		const avgResponseTime = analytics.efficiency_trends.length > 0 ?
			analytics.efficiency_trends[analytics.efficiency_trends.length - 1].avg_response_time : 0;
		
		if (avgResponseTime > 5000) efficiency -= 25;
		else if (avgResponseTime > 3000) efficiency -= 15;

		// Token efficiency
		const avgTokensPerRequest = analytics.total_tokens / Math.max(analytics.efficiency_trends.reduce((sum, t) => sum + t.requests, 0), 1);
		if (avgTokensPerRequest > 1500) efficiency -= 15;
		else if (avgTokensPerRequest > 1000) efficiency -= 8;

		return Math.max(0, efficiency);
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Advanced cost optimization strategies
	 */
	async implementAdvancedOptimizations(): Promise<void> {
		this.logService.info('[CostOptimizedLlm] Implementing advanced cost optimizations...');

		// 1. Implement prompt templates for common tasks
		await this.createPromptTemplates();

		// 2. Set up intelligent caching
		await this.setupIntelligentCaching();

		// 3. Configure provider fallbacks
		await this.configureProviderFallbacks();

		// 4. Implement request deduplication
		await this.setupRequestDeduplication();

		// 5. Configure cost alerts
		await this.setupCostAlerts();
	}

	private async createPromptTemplates(): Promise<void> {
		const templates = {
			'code_generation': 'Generate {language} code for: {task}. Include error handling.',
			'code_review': 'Review {language} code: {code}. Focus on quality and security.',
			'debugging': 'Debug error: {error}. File: {file}. Provide fix.',
			'optimization': 'Optimize {language} code: {code}. Target: {target}.',
			'documentation': 'Document {language} code: {code}. Include examples.',
			'testing': 'Create tests for {language} code: {code}. Include edge cases.',
			'security': 'Security scan {language} code: {code}. Report vulnerabilities.',
			'refactoring': 'Refactor {language} code: {code}. Improve structure.'
		};

		// Store templates for use by agents
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const projectRoot = workspaceFolders[0].uri;
			const templatesFile = URI.joinPath(projectRoot, '.weezy/prompt_templates.json');
			
			await this.fileService.createFolder(URI.joinPath(projectRoot, '.weezy'));
			await this.fileService.writeFile(templatesFile, VSBuffer.fromString(JSON.stringify(templates, null, 2)));
		}
	}

	private async setupIntelligentCaching(): Promise<void> {
		// Configure intelligent caching with TTL based on content type
		const cachingRules = {
			'static_analysis': 24 * 60 * 60 * 1000, // 24 hours
			'code_review': 12 * 60 * 60 * 1000,     // 12 hours
			'documentation': 48 * 60 * 60 * 1000,   // 48 hours
			'debugging': 1 * 60 * 60 * 1000,        // 1 hour (bugs change)
			'general': 6 * 60 * 60 * 1000           // 6 hours default
		};

		// Store caching rules
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const projectRoot = workspaceFolders[0].uri;
			const rulesFile = URI.joinPath(projectRoot, '.weezy/caching_rules.json');
			
			await this.fileService.writeFile(rulesFile, VSBuffer.fromString(JSON.stringify(cachingRules, null, 2)));
		}
	}

	private async configureProviderFallbacks(): Promise<void> {
		// Configure fallback chains for cost and reliability
		const fallbackChains = {
			'cost_optimized': ['ollama', 'gemini', 'claude', 'openai'],
			'speed_optimized': ['claude', 'gemini', 'openai', 'ollama'],
			'quality_optimized': ['openai', 'claude', 'gemini', 'ollama'],
			'reliability_optimized': ['claude', 'openai', 'gemini', 'ollama']
		};

		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const projectRoot = workspaceFolders[0].uri;
			const fallbackFile = URI.joinPath(projectRoot, '.weezy/provider_fallbacks.json');
			
			await this.fileService.writeFile(fallbackFile, VSBuffer.fromString(JSON.stringify(fallbackChains, null, 2)));
		}
	}

	private async setupRequestDeduplication(): Promise<void> {
		// Implement request deduplication to prevent duplicate costs
		const deduplicationWindow = 5 * 60 * 1000; // 5 minutes
		
		// This would be implemented with a more sophisticated deduplication system
		this.logService.info('[CostOptimizedLlm] Request deduplication configured');
	}

	private async setupCostAlerts(): Promise<void> {
		// Configure cost alerts and budget monitoring
		const alertThresholds = {
			daily_budget: 50.00,     // Alert if daily cost exceeds $50
			hourly_rate: 5.00,       // Alert if hourly cost exceeds $5
			single_request: 1.00,    // Alert if single request costs > $1
			efficiency_drop: 0.7     // Alert if efficiency drops below 70%
		};

		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const projectRoot = workspaceFolders[0].uri;
			const alertsFile = URI.joinPath(projectRoot, '.weezy/cost_alerts.json');
			
			await this.fileService.writeFile(alertsFile, VSBuffer.fromString(JSON.stringify(alertThresholds, null, 2)));
		}
	}

	/**
	 * Emergency cost control - automatically switch to free providers if budget exceeded
	 */
	async emergencyCostControl(currentDailyCost: number, dailyBudget: number): Promise<boolean> {
		if (currentDailyCost > dailyBudget * 0.9) { // 90% of budget used
			this.logService.warn(`[CostOptimizedLlm] Emergency cost control activated: $${currentDailyCost}/$${dailyBudget}`);
			
			// Switch all agents to Ollama (free local AI)
			for (const agent of ['DeveloperAgent', 'TesterAgent', 'SecurityAgent']) {
				this.configurationService.updateConfig({
					agent_settings: {
						[agent]: 'ollama'
					}
				});
			}

			// Enable aggressive caching
			await this.enableAggressiveCaching();

			// Notify user
			this.logService.info('[CostOptimizedLlm] Switched to cost-saving mode to stay within budget');
			
			return true;
		}

		return false;
	}

	private async enableAggressiveCaching(): Promise<void> {
		// Increase cache TTL and enable more aggressive caching
		const aggressiveRules = {
			'code_generation': 7 * 24 * 60 * 60 * 1000,  // 7 days
			'code_review': 3 * 24 * 60 * 60 * 1000,      // 3 days
			'documentation': 14 * 24 * 60 * 60 * 1000,   // 14 days
			'debugging': 6 * 60 * 60 * 1000,             // 6 hours
			'general': 24 * 60 * 60 * 1000               // 24 hours
		};

		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const projectRoot = workspaceFolders[0].uri;
			const rulesFile = URI.joinPath(projectRoot, '.weezy/aggressive_caching.json');
			
			await this.fileService.writeFile(rulesFile, VSBuffer.fromString(JSON.stringify(aggressiveRules, null, 2)));
		}
	}
}