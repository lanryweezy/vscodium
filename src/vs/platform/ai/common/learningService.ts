/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IAgentActivity, IAgentTask } from 'vs/platform/ai/common/aiTypes';

export const ILearningService = createDecorator<ILearningService>('learningService');

export interface ILearningService {
	readonly _serviceBrand: undefined;
	recordSuccess(taskType: string, approach: string, outcome: any): void;
	recordFailure(taskType: string, approach: string, error: any): void;
	getBestApproach(taskType: string, context?: any): ILearningRecommendation;
	getInsights(): ILearningInsight[];
	adaptStrategy(agentName: string, performance: number): IStrategyAdaptation;
}

export interface ILearningRecommendation {
	approach: string;
	confidence: number;
	reasoning: string;
	alternatives: string[];
}

export interface ILearningInsight {
	type: 'pattern' | 'optimization' | 'anti_pattern' | 'best_practice';
	description: string;
	frequency: number;
	impact: 'low' | 'medium' | 'high';
	recommendation: string;
}

export interface IStrategyAdaptation {
	currentStrategy: string;
	suggestedStrategy: string;
	confidence: number;
	reasoning: string;
	expectedImprovement: number;
}

interface ILearningRecord {
	taskType: string;
	approach: string;
	outcome: 'success' | 'failure';
	timestamp: number;
	context: any;
	performance?: number;
	metadata: any;
}

export class LearningService implements ILearningService {
	_serviceBrand: undefined;

	private readonly learningData: ILearningRecord[] = [];
	private readonly maxRecords = 10000;
	private readonly insights: Map<string, ILearningInsight> = new Map();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		this.loadLearningData();
	}

	recordSuccess(taskType: string, approach: string, outcome: any): void {
		const record: ILearningRecord = {
			taskType,
			approach,
			outcome: 'success',
			timestamp: Date.now(),
			context: outcome.context || {},
			performance: outcome.performance || 1.0,
			metadata: outcome
		};

		this.learningData.push(record);
		this.updateInsights(record);
		this.persistLearningData();
		
		this.logService.info(`[LearningService] Recorded success for ${taskType} with approach: ${approach}`);
	}

	recordFailure(taskType: string, approach: string, error: any): void {
		const record: ILearningRecord = {
			taskType,
			approach,
			outcome: 'failure',
			timestamp: Date.now(),
			context: error.context || {},
			performance: 0,
			metadata: { error: error.message, stack: error.stack }
		};

		this.learningData.push(record);
		this.updateInsights(record);
		this.persistLearningData();
		
		this.logService.info(`[LearningService] Recorded failure for ${taskType} with approach: ${approach}`);
	}

	getBestApproach(taskType: string, context?: any): ILearningRecommendation {
		const relevantRecords = this.learningData.filter(record => 
			record.taskType === taskType && 
			record.timestamp > Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
		);

		if (relevantRecords.length === 0) {
			return {
				approach: 'default',
				confidence: 0.5,
				reasoning: 'No historical data available, using default approach',
				alternatives: []
			};
		}

		// Group by approach and calculate success rates
		const approachStats = new Map<string, { successes: number; failures: number; avgPerformance: number }>();
		
		relevantRecords.forEach(record => {
			const stats = approachStats.get(record.approach) || { successes: 0, failures: 0, avgPerformance: 0 };
			
			if (record.outcome === 'success') {
				stats.successes++;
				stats.avgPerformance = (stats.avgPerformance + (record.performance || 1)) / 2;
			} else {
				stats.failures++;
			}
			
			approachStats.set(record.approach, stats);
		});

		// Find the best approach
		let bestApproach = 'default';
		let bestScore = 0;
		const alternatives: string[] = [];

		for (const [approach, stats] of approachStats.entries()) {
			const total = stats.successes + stats.failures;
			const successRate = stats.successes / total;
			const score = successRate * stats.avgPerformance;
			
			if (score > bestScore) {
				if (bestApproach !== 'default') {
					alternatives.push(bestApproach);
				}
				bestApproach = approach;
				bestScore = score;
			} else {
				alternatives.push(approach);
			}
		}

		const confidence = Math.min(0.95, bestScore * (relevantRecords.length / 10));

		return {
			approach: bestApproach,
			confidence,
			reasoning: `Based on ${relevantRecords.length} historical records, this approach has the highest success rate and performance`,
			alternatives: alternatives.slice(0, 3)
		};
	}

	getInsights(): ILearningInsight[] {
		return Array.from(this.insights.values()).sort((a, b) => b.frequency - a.frequency);
	}

	adaptStrategy(agentName: string, performance: number): IStrategyAdaptation {
		const recentRecords = this.learningData
			.filter(record => record.timestamp > Date.now() - (7 * 24 * 60 * 60 * 1000)) // Last 7 days
			.filter(record => record.metadata.agentName === agentName);

		const avgPerformance = recentRecords.length > 0 
			? recentRecords.reduce((sum, record) => sum + (record.performance || 0), 0) / recentRecords.length
			: 0.5;

		let suggestedStrategy = 'maintain_current';
		let confidence = 0.5;
		let reasoning = 'Insufficient data for strategy adaptation';
		let expectedImprovement = 0;

		if (performance < 0.6 && avgPerformance < 0.6) {
			suggestedStrategy = 'increase_analysis_depth';
			confidence = 0.8;
			reasoning = 'Performance is below threshold, recommend deeper analysis before action';
			expectedImprovement = 0.3;
		} else if (performance > 0.9 && avgPerformance > 0.8) {
			suggestedStrategy = 'optimize_for_speed';
			confidence = 0.7;
			reasoning = 'High performance allows for speed optimization';
			expectedImprovement = 0.2;
		} else if (recentRecords.filter(r => r.outcome === 'failure').length > recentRecords.length * 0.3) {
			suggestedStrategy = 'increase_validation';
			confidence = 0.9;
			reasoning = 'High failure rate suggests need for better validation';
			expectedImprovement = 0.4;
		}

		return {
			currentStrategy: 'default',
			suggestedStrategy,
			confidence,
			reasoning,
			expectedImprovement
		};
	}

	private updateInsights(record: ILearningRecord): void {
		// Update insights based on new record
		const key = `${record.taskType}_${record.approach}`;
		const existing = this.insights.get(key);

		if (existing) {
			existing.frequency++;
			if (record.outcome === 'success' && record.performance && record.performance > 0.8) {
				existing.impact = 'high';
				existing.recommendation = `Continue using ${record.approach} approach - showing high success rate`;
			}
		} else {
			this.insights.set(key, {
				type: record.outcome === 'success' ? 'best_practice' : 'anti_pattern',
				description: `${record.approach} approach for ${record.taskType}`,
				frequency: 1,
				impact: record.performance && record.performance > 0.8 ? 'high' : 'medium',
				recommendation: record.outcome === 'success' 
					? `Consider using ${record.approach} for ${record.taskType} tasks`
					: `Avoid using ${record.approach} for ${record.taskType} tasks`
			});
		}

		// Prune old insights
		if (this.insights.size > 1000) {
			const entries = Array.from(this.insights.entries());
			entries.sort((a, b) => a[1].frequency - b[1].frequency);
			
			// Remove lowest frequency insights
			for (let i = 0; i < 200; i++) {
				this.insights.delete(entries[i][0]);
			}
		}
	}

	private async loadLearningData(): Promise<void> {
		try {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceUri) return;

			const learningFile = URI.joinPath(workspaceUri, '.vscode', 'ai-learning-data.json');
			const exists = await this.fileService.exists(learningFile);
			
			if (exists) {
				const content = await this.fileService.readFile(learningFile);
				const data = JSON.parse(content.value.toString());
				
				this.learningData.push(...(data.records || []));
				
				// Rebuild insights
				for (const record of this.learningData) {
					this.updateInsights(record);
				}
			}
		} catch (error) {
			this.logService.warn('[LearningService] Failed to load learning data:', error);
		}
	}

	private async persistLearningData(): Promise<void> {
		try {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceUri) return;

			// Keep only recent records to prevent file from growing too large
			const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
			const recentRecords = this.learningData.filter(record => record.timestamp > cutoffTime);

			const learningFile = URI.joinPath(workspaceUri, '.vscode', 'ai-learning-data.json');
			const data = {
				records: recentRecords,
				insights: Array.from(this.insights.entries()),
				lastUpdated: Date.now()
			};

			await this.fileService.writeFile(learningFile, VSBuffer.fromString(JSON.stringify(data, null, 2)));
		} catch (error) {
			this.logService.warn('[LearningService] Failed to persist learning data:', error);
		}
	}
}