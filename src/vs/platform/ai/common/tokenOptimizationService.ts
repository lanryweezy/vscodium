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

export const ITokenOptimizationService = createDecorator<ITokenOptimizationService>('tokenOptimizationService');

export interface ITokenUsageMetrics {
	provider: string;
	model: string;
	tokensUsed: number;
	cost: number;
	responseTime: number;
	taskType: string;
	agentName: string;
	timestamp: number;
	efficiency_score: number;
}

export interface ITokenOptimizationStrategy {
	prompt_compression: boolean;
	context_pruning: boolean;
	response_caching: boolean;
	provider_switching: boolean;
	batch_processing: boolean;
	smart_truncation: boolean;
}

export interface ICostOptimizationResult {
	original_cost: number;
	optimized_cost: number;
	savings_percentage: number;
	tokens_saved: number;
	speed_improvement: number;
	optimization_strategies_used: string[];
}

export interface IProviderCostProfile {
	name: string;
	cost_per_input_token: number;
	cost_per_output_token: number;
	avg_response_time: number;
	reliability_score: number;
	strengths: string[];
	optimal_for: string[];
}

export interface ITokenOptimizationService {
	readonly _serviceBrand: undefined;
	readonly onCostSavings: Event<ICostOptimizationResult>;

	optimizePrompt(prompt: string, taskType: string, agentName: string): Promise<string>;
	selectOptimalProvider(taskType: string, promptLength: number, prioritizeSpeed: boolean): string;
	getCachedResponse(promptHash: string): Promise<string | null>;
	cacheResponse(promptHash: string, response: string, ttl: number): Promise<void>;
	trackTokenUsage(metrics: ITokenUsageMetrics): void;
	getCostAnalytics(timeframe: 'day' | 'week' | 'month'): Promise<ICostAnalytics>;
	optimizeForCost(prompt: string, context: any): Promise<ICostOptimizationResult>;
}

export interface ICostAnalytics {
	total_cost: number;
	total_tokens: number;
	avg_cost_per_request: number;
	cost_by_provider: Record<string, number>;
	cost_by_agent: Record<string, number>;
	efficiency_trends: IEfficiencyTrend[];
	recommendations: string[];
}

export interface IEfficiencyTrend {
	date: string;
	cost: number;
	tokens: number;
	requests: number;
	avg_response_time: number;
}

export class TokenOptimizationService implements ITokenOptimizationService {
	readonly _serviceBrand: undefined;

	private readonly _onCostSavings = new Emitter<ICostOptimizationResult>();
	readonly onCostSavings: Event<ICostOptimizationResult> = this._onCostSavings.event;

	private static readonly CACHE_FILE = '.weezy/response_cache.json';
	private static readonly METRICS_FILE = '.weezy/token_metrics.jsonl';
	private static readonly ANALYTICS_FILE = '.weezy/cost_analytics.json';

	private responseCache = new Map<string, { response: string; timestamp: number; ttl: number }>();
	private tokenMetrics: ITokenUsageMetrics[] = [];
	private providerProfiles: Map<string, IProviderCostProfile> = new Map();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		this.initializeProviderProfiles();
		this.loadCache();
		this.loadMetrics();
	}

	private initializeProviderProfiles(): void {
		// Updated pricing as of 2024
		this.providerProfiles.set('openai', {
			name: 'OpenAI GPT-4',
			cost_per_input_token: 0.00003, // $30 per 1M input tokens
			cost_per_output_token: 0.00006, // $60 per 1M output tokens
			avg_response_time: 2000,
			reliability_score: 0.95,
			strengths: ['code_generation', 'debugging', 'explanation'],
			optimal_for: ['complex_reasoning', 'code_generation', 'problem_solving']
		});

		this.providerProfiles.set('claude', {
			name: 'Claude 3.5 Sonnet',
			cost_per_input_token: 0.000015, // $15 per 1M input tokens
			cost_per_output_token: 0.000075, // $75 per 1M output tokens
			avg_response_time: 1500,
			reliability_score: 0.97,
			strengths: ['code_analysis', 'refactoring', 'architecture'],
			optimal_for: ['code_analysis', 'refactoring', 'documentation']
		});

		this.providerProfiles.set('gemini', {
			name: 'Gemini 1.5 Pro',
			cost_per_input_token: 0.0000035, // $3.50 per 1M input tokens
			cost_per_output_token: 0.0000105, // $10.50 per 1M output tokens
			avg_response_time: 1800,
			reliability_score: 0.92,
			strengths: ['multimodal', 'analysis', 'reasoning'],
			optimal_for: ['data_analysis', 'research', 'planning']
		});

		this.providerProfiles.set('ollama', {
			name: 'Ollama Local',
			cost_per_input_token: 0, // Free local execution
			cost_per_output_token: 0,
			avg_response_time: 3000, // Slower but free
			reliability_score: 0.88,
			strengths: ['privacy', 'offline', 'cost_free'],
			optimal_for: ['privacy_sensitive', 'offline_work', 'cost_optimization']
		});
	}

	async optimizePrompt(prompt: string, taskType: string, agentName: string): Promise<string> {
		this.logService.info(`[TokenOptimization] Optimizing prompt for ${agentName} (${taskType})`);

		let optimizedPrompt = prompt;
		const originalLength = prompt.length;

		// 1. Remove redundant information
		optimizedPrompt = this.removeRedundancy(optimizedPrompt);

		// 2. Compress verbose descriptions
		optimizedPrompt = this.compressDescriptions(optimizedPrompt);

		// 3. Use agent-specific optimization
		optimizedPrompt = this.applyAgentSpecificOptimization(optimizedPrompt, agentName);

		// 4. Apply task-specific optimization
		optimizedPrompt = this.applyTaskSpecificOptimization(optimizedPrompt, taskType);

		// 5. Smart truncation if still too long
		optimizedPrompt = this.smartTruncation(optimizedPrompt, taskType);

		const optimizedLength = optimizedPrompt.length;
		const reduction = ((originalLength - optimizedLength) / originalLength) * 100;

		this.logService.info(`[TokenOptimization] Prompt optimized: ${reduction.toFixed(1)}% reduction (${originalLength} → ${optimizedLength} chars)`);

		return optimizedPrompt;
	}

	selectOptimalProvider(taskType: string, promptLength: number, prioritizeSpeed: boolean): string {
		const providers = Array.from(this.providerProfiles.entries());
		let bestProvider = 'claude'; // Default
		let bestScore = 0;

		for (const [name, profile] of providers) {
			let score = 0;

			// Cost efficiency (higher weight for longer prompts)
			const estimatedCost = this.estimateCost(promptLength, profile);
			const costScore = estimatedCost === 0 ? 100 : Math.max(0, 100 - (estimatedCost * 10000));
			score += costScore * 0.4;

			// Speed (higher weight if prioritizing speed)
			const speedScore = Math.max(0, 100 - (profile.avg_response_time / 50));
			score += speedScore * (prioritizeSpeed ? 0.4 : 0.2);

			// Task suitability
			const suitabilityScore = profile.optimal_for.includes(taskType) ? 100 : 
									profile.strengths.some(s => taskType.includes(s)) ? 80 : 50;
			score += suitabilityScore * 0.3;

			// Reliability
			score += profile.reliability_score * 100 * 0.1;

			if (score > bestScore) {
				bestScore = score;
				bestProvider = name;
			}
		}

		this.logService.info(`[TokenOptimization] Selected ${bestProvider} for ${taskType} (score: ${bestScore.toFixed(1)})`);
		return bestProvider;
	}

	async getCachedResponse(promptHash: string): Promise<string | null> {
		const cached = this.responseCache.get(promptHash);
		
		if (cached && Date.now() < cached.timestamp + cached.ttl) {
			this.logService.info(`[TokenOptimization] Cache hit for prompt hash: ${promptHash.substring(0, 8)}...`);
			return cached.response;
		}

		if (cached) {
			// Remove expired cache
			this.responseCache.delete(promptHash);
		}

		return null;
	}

	async cacheResponse(promptHash: string, response: string, ttl: number): Promise<void> {
		this.responseCache.set(promptHash, {
			response,
			timestamp: Date.now(),
			ttl
		});

		// Limit cache size to prevent memory bloat
		if (this.responseCache.size > 1000) {
			const oldestKey = this.responseCache.keys().next().value;
			this.responseCache.delete(oldestKey);
		}

		// Persist cache to disk
		await this.saveCache();
	}

	trackTokenUsage(metrics: ITokenUsageMetrics): void {
		// Calculate efficiency score
		metrics.efficiency_score = this.calculateEfficiencyScore(metrics);
		
		this.tokenMetrics.push(metrics);

		// Keep only recent metrics in memory
		if (this.tokenMetrics.length > 10000) {
			this.tokenMetrics = this.tokenMetrics.slice(-5000);
		}

		// Save metrics to disk
		this.saveMetrics(metrics);

		this.logService.info(`[TokenOptimization] Tracked usage: ${metrics.agentName} - ${metrics.tokensUsed} tokens ($${metrics.cost.toFixed(4)})`);
	}

	async getCostAnalytics(timeframe: 'day' | 'week' | 'month'): Promise<ICostAnalytics> {
		const now = Date.now();
		const timeframes = {
			day: 24 * 60 * 60 * 1000,
			week: 7 * 24 * 60 * 60 * 1000,
			month: 30 * 24 * 60 * 60 * 1000
		};

		const cutoff = now - timeframes[timeframe];
		const recentMetrics = this.tokenMetrics.filter(m => m.timestamp > cutoff);

		const analytics: ICostAnalytics = {
			total_cost: recentMetrics.reduce((sum, m) => sum + m.cost, 0),
			total_tokens: recentMetrics.reduce((sum, m) => sum + m.tokensUsed, 0),
			avg_cost_per_request: 0,
			cost_by_provider: {},
			cost_by_agent: {},
			efficiency_trends: this.calculateEfficiencyTrends(recentMetrics),
			recommendations: []
		};

		analytics.avg_cost_per_request = analytics.total_cost / Math.max(recentMetrics.length, 1);

		// Group by provider
		for (const metric of recentMetrics) {
			analytics.cost_by_provider[metric.provider] = (analytics.cost_by_provider[metric.provider] || 0) + metric.cost;
			analytics.cost_by_agent[metric.agentName] = (analytics.cost_by_agent[metric.agentName] || 0) + metric.cost;
		}

		// Generate cost optimization recommendations
		analytics.recommendations = this.generateCostRecommendations(analytics, recentMetrics);

		return analytics;
	}

	async optimizeForCost(prompt: string, context: any): Promise<ICostOptimizationResult> {
		const originalPrompt = prompt;
		const originalLength = prompt.length;
		const originalTokens = this.estimateTokens(prompt);

		// Apply optimization strategies
		const strategies: string[] = [];
		let optimizedPrompt = prompt;

		// 1. Prompt compression
		const compressed = this.compressPrompt(optimizedPrompt);
		if (compressed.length < optimizedPrompt.length) {
			optimizedPrompt = compressed;
			strategies.push('prompt_compression');
		}

		// 2. Context pruning
		if (context && Object.keys(context).length > 0) {
			const pruned = this.pruneContext(optimizedPrompt, context);
			if (pruned.length < optimizedPrompt.length) {
				optimizedPrompt = pruned;
				strategies.push('context_pruning');
			}
		}

		// 3. Template optimization
		const templated = this.optimizeWithTemplates(optimizedPrompt);
		if (templated.length < optimizedPrompt.length) {
			optimizedPrompt = templated;
			strategies.push('template_optimization');
		}

		// 4. Smart truncation
		const truncated = this.intelligentTruncation(optimizedPrompt);
		if (truncated.length < optimizedPrompt.length) {
			optimizedPrompt = truncated;
			strategies.push('smart_truncation');
		}

		// Calculate savings
		const optimizedTokens = this.estimateTokens(optimizedPrompt);
		const tokensSaved = originalTokens - optimizedTokens;
		const costSavings = tokensSaved * 0.00003; // Average cost per token

		const result: ICostOptimizationResult = {
			original_cost: originalTokens * 0.00003,
			optimized_cost: optimizedTokens * 0.00003,
			savings_percentage: (tokensSaved / originalTokens) * 100,
			tokens_saved: tokensSaved,
			speed_improvement: this.estimateSpeedImprovement(tokensSaved),
			optimization_strategies_used: strategies
		};

		// Fire cost savings event
		this._onCostSavings.fire(result);

		this.logService.info(`[TokenOptimization] Cost optimization: ${result.savings_percentage.toFixed(1)}% savings, ${result.tokens_saved} tokens saved`);

		return result;
	}

	private removeRedundancy(prompt: string): string {
		// Remove repeated phrases and redundant information
		let optimized = prompt;

		// Remove duplicate sentences
		const sentences = optimized.split(/[.!?]+/);
		const uniqueSentences = [...new Set(sentences.map(s => s.trim()))];
		optimized = uniqueSentences.join('. ').trim();

		// Remove redundant phrases
		const redundantPhrases = [
			'please note that',
			'it should be noted that',
			'it is important to',
			'as mentioned before',
			'as we discussed',
			'in other words'
		];

		for (const phrase of redundantPhrases) {
			const regex = new RegExp(phrase, 'gi');
			optimized = optimized.replace(regex, '');
		}

		// Clean up extra whitespace
		optimized = optimized.replace(/\s+/g, ' ').trim();

		return optimized;
	}

	private compressDescriptions(prompt: string): string {
		// Replace verbose descriptions with concise equivalents
		const compressionMap = new Map([
			['implement a function that', 'implement function to'],
			['create a new file that contains', 'create file with'],
			['generate code that will', 'generate code to'],
			['analyze the provided code and', 'analyze code and'],
			['perform a comprehensive review of', 'review'],
			['execute the following steps in order', 'execute steps'],
			['make sure to include proper error handling', 'include error handling'],
			['ensure that the code follows best practices', 'follow best practices'],
			['provide detailed documentation for', 'document'],
			['create comprehensive test cases for', 'test']
		]);

		let compressed = prompt;
		for (const [verbose, concise] of compressionMap) {
			const regex = new RegExp(verbose, 'gi');
			compressed = compressed.replace(regex, concise);
		}

		return compressed;
	}

	private applyAgentSpecificOptimization(prompt: string, agentName: string): string {
		// Agent-specific prompt optimizations
		const agentOptimizations = {
			'DeveloperAgent': (p: string) => p.replace(/write code that/g, 'code:').replace(/implement functionality for/g, 'implement:'),
			'TesterAgent': (p: string) => p.replace(/create test cases for/g, 'test:').replace(/verify that/g, 'verify:'),
			'SecurityAgent': (p: string) => p.replace(/perform security analysis on/g, 'scan:').replace(/check for vulnerabilities in/g, 'audit:'),
			'PerformanceAgent': (p: string) => p.replace(/optimize the performance of/g, 'optimize:').replace(/analyze bottlenecks in/g, 'profile:'),
			'DatabaseAgent': (p: string) => p.replace(/design database schema for/g, 'schema:').replace(/optimize query/g, 'optimize:'),
			'APIAgent': (p: string) => p.replace(/create REST API for/g, 'API:').replace(/design endpoints for/g, 'endpoints:')
		};

		const optimization = agentOptimizations[agentName];
		return optimization ? optimization(prompt) : prompt;
	}

	private applyTaskSpecificOptimization(prompt: string, taskType: string): string {
		// Task-specific optimizations
		const taskOptimizations = {
			'code_generation': (p: string) => p.replace(/generate code that implements/g, 'implement').replace(/create a function that/g, 'function:'),
			'code_review': (p: string) => p.replace(/review the following code and provide feedback/g, 'review:').replace(/analyze code quality/g, 'quality:'),
			'debugging': (p: string) => p.replace(/debug the following error/g, 'debug:').replace(/find and fix the issue/g, 'fix:'),
			'optimization': (p: string) => p.replace(/optimize the performance/g, 'optimize:').replace(/improve efficiency/g, 'improve:'),
			'documentation': (p: string) => p.replace(/create documentation for/g, 'document:').replace(/write comprehensive docs/g, 'docs:')
		};

		const optimization = taskOptimizations[taskType];
		return optimization ? optimization(prompt) : prompt;
	}

	private smartTruncation(prompt: string, taskType: string): string {
		const maxTokens = this.getMaxTokensForTask(taskType);
		const estimatedTokens = this.estimateTokens(prompt);

		if (estimatedTokens <= maxTokens) {
			return prompt;
		}

		// Intelligent truncation preserving important parts
		const sentences = prompt.split(/[.!?]+/);
		const importantSentences = sentences.filter(s => this.isImportantSentence(s, taskType));
		const lessImportantSentences = sentences.filter(s => !this.isImportantSentence(s, taskType));

		// Start with important sentences
		let truncated = importantSentences.join('. ') + '.';
		
		// Add less important sentences until we hit the limit
		for (const sentence of lessImportantSentences) {
			const testPrompt = truncated + ' ' + sentence + '.';
			if (this.estimateTokens(testPrompt) <= maxTokens) {
				truncated = testPrompt;
			} else {
				break;
			}
		}

		return truncated;
	}

	private compressPrompt(prompt: string): string {
		// Advanced compression techniques
		let compressed = prompt;

		// Replace common programming terms with abbreviations
		const abbreviations = new Map([
			['function', 'fn'],
			['variable', 'var'],
			['parameter', 'param'],
			['argument', 'arg'],
			['implementation', 'impl'],
			['configuration', 'config'],
			['optimization', 'opt'],
			['performance', 'perf'],
			['documentation', 'docs'],
			['specification', 'spec']
		]);

		for (const [full, abbrev] of abbreviations) {
			const regex = new RegExp(`\\b${full}\\b`, 'gi');
			compressed = compressed.replace(regex, abbrev);
		}

		// Remove filler words
		const fillerWords = ['really', 'very', 'quite', 'rather', 'pretty', 'just', 'simply', 'basically'];
		for (const filler of fillerWords) {
			const regex = new RegExp(`\\b${filler}\\b`, 'gi');
			compressed = compressed.replace(regex, '');
		}

		// Compress whitespace
		compressed = compressed.replace(/\s+/g, ' ').trim();

		return compressed;
	}

	private pruneContext(prompt: string, context: any): string {
		// Remove less relevant context to reduce token usage
		const relevantKeys = ['task_description', 'file_path', 'error_message', 'requirements'];
		const prunedContext = {};

		for (const key of relevantKeys) {
			if (context[key]) {
				prunedContext[key] = context[key];
			}
		}

		// Replace full context with pruned version in prompt
		const contextStr = JSON.stringify(prunedContext, null, 2);
		return prompt.replace(/\{\{.*CONTEXT.*\}\}/g, contextStr);
	}

	private optimizeWithTemplates(prompt: string): string {
		// Use pre-optimized templates for common patterns
		const templates = {
			'code_generation': 'Generate {{LANGUAGE}} code for: {{TASK}}. Include error handling and tests.',
			'code_review': 'Review {{LANGUAGE}} code: {{CODE}}. Focus on quality and security.',
			'debugging': 'Debug error: {{ERROR}}. File: {{FILE}}. Provide fix.',
			'optimization': 'Optimize {{LANGUAGE}} code: {{CODE}}. Target: performance.',
			'documentation': 'Document {{LANGUAGE}} code: {{CODE}}. Include examples.'
		};

		// Try to match prompt to template pattern
		for (const [pattern, template] of Object.entries(templates)) {
			if (prompt.toLowerCase().includes(pattern.replace('_', ' '))) {
				// Extract key information and use template
				const optimized = this.applyTemplate(template, prompt);
				if (optimized.length < prompt.length) {
					return optimized;
				}
			}
		}

		return prompt;
	}

	private intelligentTruncation(prompt: string): string {
		const maxLength = 4000; // Conservative limit
		
		if (prompt.length <= maxLength) {
			return prompt;
		}

		// Prioritize keeping the beginning and end, truncate middle
		const keepStart = Math.floor(maxLength * 0.6);
		const keepEnd = Math.floor(maxLength * 0.3);
		
		const start = prompt.substring(0, keepStart);
		const end = prompt.substring(prompt.length - keepEnd);
		
		return start + '\n\n[... content optimized for efficiency ...]\n\n' + end;
	}

	private estimateCost(promptLength: number, profile: IProviderCostProfile): number {
		const estimatedTokens = this.estimateTokens(promptLength.toString());
		const inputCost = estimatedTokens * profile.cost_per_input_token;
		const outputCost = (estimatedTokens * 0.3) * profile.cost_per_output_token; // Assume 30% output ratio
		return inputCost + outputCost;
	}

	private estimateTokens(text: string): number {
		// Rough token estimation (1 token ≈ 4 characters for English)
		return Math.ceil(text.length / 4);
	}

	private getMaxTokensForTask(taskType: string): number {
		const limits = {
			'simple_task': 1000,
			'code_generation': 2000,
			'code_review': 3000,
			'debugging': 2500,
			'documentation': 1500,
			'complex_analysis': 4000
		};

		return limits[taskType] || 2000;
	}

	private isImportantSentence(sentence: string, taskType: string): boolean {
		const importantKeywords = {
			'code_generation': ['implement', 'create', 'function', 'class', 'method'],
			'debugging': ['error', 'bug', 'fix', 'issue', 'problem'],
			'optimization': ['performance', 'speed', 'memory', 'optimize'],
			'security': ['security', 'vulnerability', 'auth', 'permission'],
			'testing': ['test', 'verify', 'validate', 'check']
		};

		const keywords = importantKeywords[taskType] || [];
		const sentenceLower = sentence.toLowerCase();
		
		return keywords.some(keyword => sentenceLower.includes(keyword));
	}

	private calculateEfficiencyScore(metrics: ITokenUsageMetrics): number {
		let score = 100;

		// Penalize high token usage
		if (metrics.tokensUsed > 2000) score -= 20;
		else if (metrics.tokensUsed > 1000) score -= 10;

		// Penalize high cost
		if (metrics.cost > 0.10) score -= 30;
		else if (metrics.cost > 0.05) score -= 15;

		// Penalize slow response
		if (metrics.responseTime > 5000) score -= 25;
		else if (metrics.responseTime > 3000) score -= 10;

		// Bonus for free providers
		if (metrics.cost === 0) score += 20;

		return Math.max(0, Math.min(100, score));
	}

	private calculateEfficiencyTrends(metrics: ITokenUsageMetrics[]): IEfficiencyTrend[] {
		// Group metrics by day
		const dailyMetrics = new Map<string, ITokenUsageMetrics[]>();
		
		for (const metric of metrics) {
			const date = new Date(metric.timestamp).toISOString().split('T')[0];
			if (!dailyMetrics.has(date)) {
				dailyMetrics.set(date, []);
			}
			dailyMetrics.get(date)!.push(metric);
		}

		// Calculate daily trends
		const trends: IEfficiencyTrend[] = [];
		for (const [date, dayMetrics] of dailyMetrics) {
			trends.push({
				date,
				cost: dayMetrics.reduce((sum, m) => sum + m.cost, 0),
				tokens: dayMetrics.reduce((sum, m) => sum + m.tokensUsed, 0),
				requests: dayMetrics.length,
				avg_response_time: dayMetrics.reduce((sum, m) => sum + m.responseTime, 0) / dayMetrics.length
			});
		}

		return trends.sort((a, b) => a.date.localeCompare(b.date));
	}

	private generateCostRecommendations(analytics: ICostAnalytics, metrics: ITokenUsageMetrics[]): string[] {
		const recommendations = [];

		// High cost provider recommendations
		const expensiveProviders = Object.entries(analytics.cost_by_provider)
			.filter(([_, cost]) => cost > analytics.total_cost * 0.4)
			.map(([provider, _]) => provider);

		if (expensiveProviders.length > 0) {
			recommendations.push(`Consider using more cost-effective providers for: ${expensiveProviders.join(', ')}`);
		}

		// High usage agent recommendations
		const expensiveAgents = Object.entries(analytics.cost_by_agent)
			.filter(([_, cost]) => cost > analytics.total_cost * 0.2)
			.map(([agent, _]) => agent);

		if (expensiveAgents.length > 0) {
			recommendations.push(`Optimize prompts for high-usage agents: ${expensiveAgents.join(', ')}`);
		}

		// Cost efficiency recommendations
		if (analytics.avg_cost_per_request > 0.05) {
			recommendations.push('Average request cost is high - implement more aggressive prompt optimization');
		}

		// Speed recommendations
		const slowRequests = metrics.filter(m => m.responseTime > 3000).length;
		if (slowRequests > metrics.length * 0.2) {
			recommendations.push('Consider using faster providers for time-sensitive tasks');
		}

		// Caching recommendations
		const duplicatePrompts = this.findDuplicatePrompts(metrics);
		if (duplicatePrompts > 0) {
			recommendations.push(`${duplicatePrompts} duplicate requests detected - improve caching strategy`);
		}

		return recommendations;
	}

	private applyTemplate(template: string, originalPrompt: string): string {
		// Extract key information from original prompt
		const extracted = this.extractKeyInformation(originalPrompt);
		
		let optimized = template;
		for (const [placeholder, value] of Object.entries(extracted)) {
			optimized = optimized.replace(`{{${placeholder}}}`, value);
		}

		return optimized;
	}

	private extractKeyInformation(prompt: string): Record<string, string> {
		// Simple extraction - would be enhanced with NLP
		const info: Record<string, string> = {};
		
		// Extract language
		const languages = ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'php', 'c#'];
		for (const lang of languages) {
			if (prompt.toLowerCase().includes(lang)) {
				info.LANGUAGE = lang;
				break;
			}
		}

		// Extract task description (first sentence)
		const sentences = prompt.split(/[.!?]+/);
		if (sentences.length > 0) {
			info.TASK = sentences[0].trim();
		}

		return info;
	}

	private estimateSpeedImprovement(tokensSaved: number): number {
		// Estimate speed improvement based on tokens saved
		// Roughly 1ms per token saved
		return tokensSaved;
	}

	private findDuplicatePrompts(metrics: ITokenUsageMetrics[]): number {
		const promptHashes = new Map<string, number>();
		
		for (const metric of metrics) {
			// Create simple hash of the request
			const hash = this.createSimpleHash(metric.taskType + metric.agentName);
			promptHashes.set(hash, (promptHashes.get(hash) || 0) + 1);
		}

		return Array.from(promptHashes.values()).filter(count => count > 1).length;
	}

	private createSimpleHash(input: string): string {
		// Simple hash function for caching
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			const char = input.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString(36);
	}

	private async loadCache(): Promise<void> {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const cacheFile = URI.joinPath(projectRoot, TokenOptimizationService.CACHE_FILE);

			if (await this.fileService.exists(cacheFile)) {
				const content = await this.fileService.readFile(cacheFile);
				const cacheData = JSON.parse(content.value.toString());
				
				for (const [key, value] of Object.entries(cacheData)) {
					this.responseCache.set(key, value as any);
				}
			}
		} catch (error) {
			this.logService.warn('[TokenOptimization] Failed to load cache:', error);
		}
	}

	private async saveCache(): Promise<void> {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const cacheFile = URI.joinPath(projectRoot, TokenOptimizationService.CACHE_FILE);

			// Convert Map to Object for JSON serialization
			const cacheData = Object.fromEntries(this.responseCache);
			
			await this.fileService.createFolder(URI.joinPath(projectRoot, '.weezy'));
			await this.fileService.writeFile(cacheFile, VSBuffer.fromString(JSON.stringify(cacheData, null, 2)));
		} catch (error) {
			this.logService.error('[TokenOptimization] Failed to save cache:', error);
		}
	}

	private async loadMetrics(): Promise<void> {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const metricsFile = URI.joinPath(projectRoot, TokenOptimizationService.METRICS_FILE);

			if (await this.fileService.exists(metricsFile)) {
				const content = await this.fileService.readFile(metricsFile);
				const lines = content.value.toString().split('\n').filter(line => line.trim());
				
				for (const line of lines) {
					try {
						const metric = JSON.parse(line);
						this.tokenMetrics.push(metric);
					} catch {
						// Skip invalid lines
					}
				}
			}
		} catch (error) {
			this.logService.warn('[TokenOptimization] Failed to load metrics:', error);
		}
	}

	private async saveMetrics(metric: ITokenUsageMetrics): Promise<void> {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 0) return;

			const projectRoot = workspaceFolders[0].uri;
			const metricsFile = URI.joinPath(projectRoot, TokenOptimizationService.METRICS_FILE);

			await this.fileService.createFolder(URI.joinPath(projectRoot, '.weezy'));
			
			const metricLine = JSON.stringify(metric) + '\n';
			
			if (await this.fileService.exists(metricsFile)) {
				await this.fileService.append(metricsFile, VSBuffer.fromString(metricLine));
			} else {
				await this.fileService.createFile(metricsFile, VSBuffer.fromString(metricLine));
			}
		} catch (error) {
			this.logService.error('[TokenOptimization] Failed to save metrics:', error);
		}
	}
}