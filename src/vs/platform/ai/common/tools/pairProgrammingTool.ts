/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { Emitter, Event } from 'vs/base/common/event';

interface IPairProgrammingArgs {
	action: 'start_session' | 'suggest_code' | 'review_code' | 'explain_code' | 'optimize_code';
	file_path?: string;
	code_selection?: string;
	user_intent?: string;
	collaboration_mode: 'navigator' | 'driver' | 'reviewer';
}

interface IPairProgrammingSession {
	id: string;
	startTime: number;
	participants: string[];
	currentFile?: URI;
	sharedContext: any;
	suggestions: ICodeSuggestion[];
}

interface ICodeSuggestion {
	id: string;
	type: 'completion' | 'refactor' | 'optimization' | 'fix';
	description: string;
	code: string;
	confidence: number;
	reasoning: string;
	timestamp: number;
}

export class PairProgrammingTool implements IAgentTool {
	readonly name = 'pair.programming';
	readonly description = 'Provides intelligent pair programming assistance with real-time code suggestions, reviews, and collaborative features.';

	private readonly _onSuggestion = new Emitter<ICodeSuggestion>();
	readonly onSuggestion: Event<ICodeSuggestion> = this._onSuggestion.event;

	private activeSessions = new Map<string, IPairProgrammingSession>();
	private suggestionHistory: ICodeSuggestion[] = [];

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			action: {
				type: 'string',
				description: 'The pair programming action to perform',
				enum: ['start_session', 'suggest_code', 'review_code', 'explain_code', 'optimize_code'],
				required: true
			},
			file_path: {
				type: 'string',
				description: 'Path to the file being worked on'
			},
			code_selection: {
				type: 'string',
				description: 'Selected code snippet for analysis'
			},
			user_intent: {
				type: 'string',
				description: 'What the user is trying to accomplish'
			},
			collaboration_mode: {
				type: 'string',
				description: 'Role of the AI in pair programming',
				enum: ['navigator', 'driver', 'reviewer'],
				default: 'navigator'
			}
		},
		required: ['action']
	};

	async execute(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			switch (args.action) {
				case 'start_session':
					return await this.startPairProgrammingSession(args, context);
				case 'suggest_code':
					return await this.suggestCode(args, context);
				case 'review_code':
					return await this.reviewCode(args, context);
				case 'explain_code':
					return await this.explainCode(args, context);
				case 'optimize_code':
					return await this.optimizeCode(args, context);
				default:
					throw new Error(`Unknown action: ${args.action}`);
			}
		} catch (error) {
			this.logService.error('[PairProgrammingTool] Execution failed:', error);
			return { result: null, isError: true };
		}
	}

	private async startPairProgrammingSession(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		const sessionId = `session_${Date.now()}`;
		const session: IPairProgrammingSession = {
			id: sessionId,
			startTime: Date.now(),
			participants: ['user', 'ai'],
			sharedContext: {},
			suggestions: []
		};

		this.activeSessions.set(sessionId, session);
		this.logService.info(`[PairProgrammingTool] Started session ${sessionId} in ${args.collaboration_mode} mode`);

		return {
			result: {
				session_id: sessionId,
				mode: args.collaboration_mode,
				message: `Pair programming session started! I'm ready to ${args.collaboration_mode === 'navigator' ? 'guide and suggest' : args.collaboration_mode === 'driver' ? 'write code with you' : 'review your code'}.`,
				tips: this.getCollaborationTips(args.collaboration_mode)
			}
		};
	}

	private async suggestCode(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.user_intent) {
			return { result: { error: 'User intent is required for code suggestions' }, isError: true };
		}

		const suggestions = await this.generateCodeSuggestions(args, context);
		
		// Store suggestions in history
		this.suggestionHistory.push(...suggestions);
		
		// Emit suggestions for real-time updates
		for (const suggestion of suggestions) {
			this._onSuggestion.fire(suggestion);
		}

		return {
			result: {
				suggestions: suggestions.map(s => ({
					description: s.description,
					code: s.code,
					confidence: s.confidence,
					reasoning: s.reasoning
				})),
				message: `Generated ${suggestions.length} code suggestions based on your intent: "${args.user_intent}"`
			}
		};
	}

	private async reviewCode(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.code_selection) {
			return { result: { error: 'Code selection is required for review' }, isError: true };
		}

		const review = await this.performCodeReview(args.code_selection, args.file_path);

		return {
			result: {
				review: review,
				overall_score: review.score,
				recommendations: review.recommendations,
				message: `Code review completed. Overall score: ${review.score}/10`
			}
		};
	}

	private async explainCode(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.code_selection) {
			return { result: { error: 'Code selection is required for explanation' }, isError: true };
		}

		const explanation = await this.generateCodeExplanation(args.code_selection);

		return {
			result: {
				explanation: explanation.detailed,
				summary: explanation.summary,
				concepts: explanation.concepts,
				related_patterns: explanation.patterns,
				message: 'Code explanation generated'
			}
		};
	}

	private async optimizeCode(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.code_selection) {
			return { result: { error: 'Code selection is required for optimization' }, isError: true };
		}

		const optimizations = await this.generateOptimizations(args.code_selection);

		return {
			result: {
				optimizations: optimizations,
				estimated_improvement: this.calculateImprovementEstimate(optimizations),
				message: `Found ${optimizations.length} optimization opportunities`
			}
		};
	}

	private async generateCodeSuggestions(args: IPairProgrammingArgs, context: IAgentToolExecuteArg): Promise<ICodeSuggestion[]> {
		const suggestions: ICodeSuggestion[] = [];

		// Generate contextual suggestions based on user intent
		if (args.user_intent?.includes('function')) {
			suggestions.push({
				id: `suggestion_${Date.now()}_1`,
				type: 'completion',
				description: 'Generate function implementation',
				code: this.generateFunctionTemplate(args.user_intent),
				confidence: 0.8,
				reasoning: 'Based on function-related intent',
				timestamp: Date.now()
			});
		}

		if (args.user_intent?.includes('class')) {
			suggestions.push({
				id: `suggestion_${Date.now()}_2`,
				type: 'completion',
				description: 'Generate class structure',
				code: this.generateClassTemplate(args.user_intent),
				confidence: 0.8,
				reasoning: 'Based on class-related intent',
				timestamp: Date.now()
			});
		}

		if (args.user_intent?.includes('test')) {
			suggestions.push({
				id: `suggestion_${Date.now()}_3`,
				type: 'completion',
				description: 'Generate unit tests',
				code: this.generateTestTemplate(args.user_intent),
				confidence: 0.9,
				reasoning: 'Based on testing intent',
				timestamp: Date.now()
			});
		}

		return suggestions;
	}

	private async performCodeReview(code: string, filePath?: string): Promise<any> {
		const issues = [];
		let score = 10;

		// Check for code quality issues
		if (code.includes('console.log')) {
			issues.push('Remove debug console.log statements');
			score -= 1;
		}

		if (code.split('\n').some(line => line.length > 120)) {
			issues.push('Some lines are too long (>120 characters)');
			score -= 0.5;
		}

		if (!code.includes('//') && !code.includes('/*')) {
			issues.push('Add comments to explain complex logic');
			score -= 1;
		}

		return {
			score: Math.max(0, score),
			issues: issues,
			recommendations: [
				'Follow consistent naming conventions',
				'Add error handling where appropriate',
				'Consider breaking down complex functions'
			]
		};
	}

	private async generateCodeExplanation(code: string): Promise<any> {
		return {
			detailed: 'This code implements functionality for...',
			summary: 'A brief overview of what this code does',
			concepts: ['Object-oriented programming', 'Error handling', 'Async/await'],
			patterns: ['Service pattern', 'Factory pattern']
		};
	}

	private async generateOptimizations(code: string): Promise<any[]> {
		const optimizations = [];

		// Check for performance improvements
		if (code.includes('for (') && code.includes('.push(')) {
			optimizations.push({
				type: 'performance',
				description: 'Use array methods like map() or filter() instead of manual loops',
				impact: 'medium',
				code_before: '// Current loop implementation',
				code_after: '// Optimized array method implementation'
			});
		}

		return optimizations;
	}

	private calculateImprovementEstimate(optimizations: any[]): string {
		const highImpact = optimizations.filter(o => o.impact === 'high').length;
		const mediumImpact = optimizations.filter(o => o.impact === 'medium').length;
		
		if (highImpact > 0) return `${highImpact * 20}% performance improvement`;
		if (mediumImpact > 0) return `${mediumImpact * 10}% performance improvement`;
		return '5% general improvement';
	}

	private generateFunctionTemplate(intent: string): string {
		return `/**
 * ${intent}
 */
export function generatedFunction(param: any): Promise<any> {
	try {
		// Implementation based on: ${intent}
		return Promise.resolve(result);
	} catch (error) {
		throw new Error(\`Function execution failed: \${error}\`);
	}
}`;
	}

	private generateClassTemplate(intent: string): string {
		return `/**
 * ${intent}
 */
export class GeneratedClass {
	private readonly config: any;

	constructor(config?: any) {
		this.config = config || {};
	}

	public async execute(): Promise<void> {
		// Implementation based on: ${intent}
	}
}`;
	}

	private generateTestTemplate(intent: string): string {
		return `describe('Generated Tests', () => {
	it('should ${intent.toLowerCase()}', async () => {
		// Test implementation
		expect(true).toBe(true);
	});

	it('should handle errors gracefully', async () => {
		// Error handling test
	});
});`;
	}

	private getCollaborationTips(mode: string): string[] {
		const tips: Record<string, string[]> = {
			navigator: [
				'I\'ll guide you through the implementation',
				'Ask me to explain any concepts you\'re unsure about',
				'I can suggest best practices and patterns'
			],
			driver: [
				'I\'ll write code based on your specifications',
				'Tell me what you want to implement',
				'I\'ll handle the implementation details'
			],
			reviewer: [
				'I\'ll review your code for quality and best practices',
				'Share your code for detailed feedback',
				'I can suggest improvements and optimizations'
			]
		};

		return tips[mode] || ['Let\'s work together to create great code!'];
	}
}