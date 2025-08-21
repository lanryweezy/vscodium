/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentDefinition, IAgentRequest, IAgentRunnerService } from 'vs/platform/ai/common/aiTypes';
import { IEnhancedAgentRegistry } from 'vs/platform/ai/common/enhancedAgentRegistry';
import { ILogService } from 'vs/platform/log/common/log';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

export interface IAgentOrchestrationRequest {
	taskDescription: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	maxAgents?: number;
	requiresCollaboration?: boolean;
	context?: any;
}

export interface IOrchestrationResult {
	primaryAgent: string;
	collaboratingAgents: string[];
	executionPlan: IExecutionStep[];
	estimatedDuration: number;
	confidence: number;
}

export interface IExecutionStep {
	agentName: string;
	action: string;
	dependencies: string[];
	estimatedTime: number;
	parallel: boolean;
}

export class AgentOrchestrator extends Disposable {
	private readonly _onOrchestrationStarted = new Emitter<IOrchestrationResult>();
	readonly onOrchestrationStarted: Event<IOrchestrationResult> = this._onOrchestrationStarted.event;

	private readonly _onStepCompleted = new Emitter<{step: IExecutionStep, result: any}>();
	readonly onStepCompleted: Event<{step: IExecutionStep, result: any}> = this._onStepCompleted.event;

	private readonly activeOrchestrations = new Map<string, IOrchestrationResult>();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IEnhancedAgentRegistry private readonly agentRegistry: IEnhancedAgentRegistry,
		@IAgentRunnerService private readonly agentRunner: IAgentRunnerService
	) {
		super();
	}

	/**
	 * Orchestrate multiple agents to complete complex tasks
	 */
	async orchestrateTask(request: IAgentOrchestrationRequest): Promise<string> {
		this.logService.info(`[AgentOrchestrator] Starting orchestration for: ${request.taskDescription}`);

		// Get agent recommendations
		const recommendations = this.agentRegistry.recommendAgentForTask(request.taskDescription, request.context);
		if (recommendations.length === 0) {
			throw new Error('No suitable agents found for the task');
		}

		// Create execution plan
		const orchestrationPlan = this.createExecutionPlan(request, recommendations);
		const orchestrationId = `orch_${Date.now()}`;
		this.activeOrchestrations.set(orchestrationId, orchestrationPlan);

		this._onOrchestrationStarted.fire(orchestrationPlan);

		// Execute the plan
		const result = await this.executePlan(orchestrationPlan, request);
		
		this.activeOrchestrations.delete(orchestrationId);
		return result;
	}

	private createExecutionPlan(
		request: IAgentOrchestrationRequest, 
		recommendations: any[]
	): IOrchestrationResult {
		const primaryAgent = recommendations[0].agentName;
		const collaboratingAgents = recommendations.slice(1, request.maxAgents || 3).map(r => r.agentName);

		// Determine execution steps based on task complexity
		const executionPlan = this.planExecutionSteps(request, primaryAgent, collaboratingAgents);

		return {
			primaryAgent,
			collaboratingAgents,
			executionPlan,
			estimatedDuration: executionPlan.reduce((sum, step) => sum + step.estimatedTime, 0),
			confidence: recommendations[0].confidence
		};
	}

	private planExecutionSteps(
		request: IAgentOrchestrationRequest,
		primaryAgent: string,
		collaboratingAgents: string[]
	): IExecutionStep[] {
		const steps: IExecutionStep[] = [];
		const taskLower = request.taskDescription.toLowerCase();

		// Analysis phase (parallel when possible)
		if (taskLower.includes('analyze') || taskLower.includes('review')) {
			steps.push({
				agentName: primaryAgent,
				action: 'analyze_requirements',
				dependencies: [],
				estimatedTime: 30000, // 30 seconds
				parallel: false
			});

			// Add parallel analysis from specialists
			if (collaboratingAgents.length > 0) {
				for (const agent of collaboratingAgents) {
					steps.push({
						agentName: agent,
						action: 'specialist_analysis',
						dependencies: ['analyze_requirements'],
						estimatedTime: 20000,
						parallel: true
					});
				}
			}
		}

		// Implementation phase
		if (taskLower.includes('implement') || taskLower.includes('create') || taskLower.includes('build')) {
			steps.push({
				agentName: primaryAgent,
				action: 'implement_solution',
				dependencies: steps.length > 0 ? ['analyze_requirements'] : [],
				estimatedTime: 60000, // 1 minute
				parallel: false
			});
		}

		// Testing phase
		if (taskLower.includes('test') || request.priority === 'critical') {
			const testerAgent = collaboratingAgents.find(agent => agent.includes('Tester') || agent.includes('QA'));
			if (testerAgent) {
				steps.push({
					agentName: testerAgent,
					action: 'comprehensive_testing',
					dependencies: ['implement_solution'],
					estimatedTime: 45000,
					parallel: false
				});
			}
		}

		// Review phase (parallel reviews)
		if (request.priority === 'high' || request.priority === 'critical') {
			const reviewAgents = collaboratingAgents.filter(agent => 
				agent.includes('Security') || agent.includes('Performance') || agent.includes('TechLead')
			);
			
			for (const reviewer of reviewAgents) {
				steps.push({
					agentName: reviewer,
					action: 'expert_review',
					dependencies: steps.length > 0 ? [steps[steps.length - 1].action] : [],
					estimatedTime: 30000,
					parallel: true
				});
			}
		}

		return steps;
	}

	private async executePlan(plan: IOrchestrationResult, request: IAgentOrchestrationRequest): Promise<string> {
		const results: Map<string, any> = new Map();
		const completedSteps = new Set<string>();

		// Execute steps in dependency order
		for (const step of plan.executionPlan) {
			// Wait for dependencies
			if (step.dependencies.length > 0) {
				const dependenciesMet = step.dependencies.every(dep => completedSteps.has(dep));
				if (!dependenciesMet) {
					// Wait for dependencies (simplified for this implementation)
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			try {
				// Create agent request with context
				const agentRequest: IAgentRequest = {
					message: this.createStepMessage(step, request, results),
					step_context: {
						action: step.action,
						orchestration_id: Date.now().toString(),
						previous_results: Array.from(results.entries())
					}
				};

				// Execute agent
				const stepResult = await this.agentRunner.runAgent(step.agentName, agentRequest);
				results.set(step.action, stepResult);
				completedSteps.add(step.action);

				this._onStepCompleted.fire({ step, result: stepResult });
				this.logService.info(`[AgentOrchestrator] Completed step: ${step.action} by ${step.agentName}`);

			} catch (error) {
				this.logService.error(`[AgentOrchestrator] Step failed: ${step.action}`, error);
				
				// Try to continue with degraded functionality
				results.set(step.action, { error: error.message, partial: true });
				completedSteps.add(step.action);
			}
		}

		// Compile final result
		return this.compileFinalResult(plan, results, request);
	}

	private createStepMessage(step: IExecutionStep, request: IAgentOrchestrationRequest, results: Map<string, any>): string {
		let message = `Execute ${step.action} for the following task:\n\n${request.taskDescription}\n\n`;
		
		if (results.size > 0) {
			message += 'Previous step results:\n';
			for (const [action, result] of results) {
				message += `- ${action}: ${typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)}...\n`;
			}
		}

		message += `\nStep context: ${step.action}\nEstimated time: ${step.estimatedTime}ms\n`;
		
		return message;
	}

	private compileFinalResult(plan: IOrchestrationResult, results: Map<string, any>, request: IAgentOrchestrationRequest): string {
		const summary = {
			orchestration_summary: {
				primary_agent: plan.primaryAgent,
				collaborating_agents: plan.collaboratingAgents,
				total_steps: plan.executionPlan.length,
				successful_steps: Array.from(results.keys()).filter(key => !results.get(key)?.error).length,
				total_duration: Date.now() - (plan.estimatedDuration || 0)
			},
			task_description: request.taskDescription,
			results: Object.fromEntries(results),
			recommendations: this.generateRecommendations(results),
			next_steps: this.suggestNextSteps(results, request)
		};

		return JSON.stringify(summary, null, 2);
	}

	private generateRecommendations(results: Map<string, any>): string[] {
		const recommendations = [];
		
		// Analyze results for patterns
		const hasErrors = Array.from(results.values()).some(result => result?.error);
		if (hasErrors) {
			recommendations.push('Review and address any errors found during execution');
		}

		const hasPartialResults = Array.from(results.values()).some(result => result?.partial);
		if (hasPartialResults) {
			recommendations.push('Some steps completed with partial results - consider re-running for complete analysis');
		}

		recommendations.push('Monitor performance metrics and adjust agent selection based on results');
		
		return recommendations;
	}

	private suggestNextSteps(results: Map<string, any>, request: IAgentOrchestrationRequest): string[] {
		const nextSteps = [];
		
		if (request.priority === 'critical') {
			nextSteps.push('Implement continuous monitoring for critical components');
		}
		
		nextSteps.push('Update documentation with orchestration results');
		nextSteps.push('Schedule follow-up review in 1 week');
		
		return nextSteps;
	}
}