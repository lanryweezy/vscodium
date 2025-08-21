/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

interface ITaskPlanningArgs {
	project_description: string;
	project_scope: 'small' | 'medium' | 'large' | 'enterprise';
	timeline_weeks?: number;
	team_size?: number;
	technology_preferences?: string[];
	methodology: 'agile' | 'waterfall' | 'hybrid';
	include_risk_analysis: boolean;
	output_format: 'json' | 'markdown' | 'gantt';
}

interface ITaskPlan {
	project_overview: IProjectOverview;
	work_breakdown: IWorkBreakdown;
	timeline: IProjectTimeline;
	resource_allocation: IResourceAllocation;
	risk_analysis: IRiskAnalysis;
	recommendations: string[];
}

interface IProjectOverview {
	name: string;
	description: string;
	objectives: string[];
	success_criteria: string[];
	stakeholders: string[];
}

interface IWorkBreakdown {
	epics: IEpic[];
	total_story_points: number;
	estimated_hours: number;
}

interface IEpic {
	id: string;
	name: string;
	description: string;
	priority: 'critical' | 'high' | 'medium' | 'low';
	features: IFeature[];
	estimated_weeks: number;
	dependencies: string[];
}

interface IFeature {
	id: string;
	name: string;
	description: string;
	user_stories: IUserStory[];
	acceptance_criteria: string[];
	estimated_points: number;
}

interface IUserStory {
	id: string;
	story: string;
	acceptance_criteria: string[];
	tasks: ITask[];
	estimated_hours: number;
}

interface ITask {
	id: string;
	description: string;
	type: 'development' | 'testing' | 'documentation' | 'deployment' | 'review';
	estimated_hours: number;
	required_skills: string[];
	dependencies: string[];
}

interface IProjectTimeline {
	total_duration_weeks: number;
	phases: IPhase[];
	milestones: IMilestone[];
	critical_path: string[];
}

interface IPhase {
	name: string;
	duration_weeks: number;
	deliverables: string[];
	success_criteria: string[];
}

interface IMilestone {
	name: string;
	week: number;
	deliverables: string[];
	acceptance_criteria: string[];
}

interface IResourceAllocation {
	required_roles: IRole[];
	skill_requirements: string[];
	capacity_planning: ICapacityPlan[];
}

interface IRole {
	title: string;
	count: number;
	skills: string[];
	allocation_percentage: number;
}

interface ICapacityPlan {
	week: number;
	total_capacity_hours: number;
	allocated_hours: number;
	utilization_percentage: number;
}

interface IRiskAnalysis {
	risks: IRisk[];
	mitigation_strategies: string[];
	contingency_plans: string[];
}

interface IRisk {
	description: string;
	probability: 'low' | 'medium' | 'high';
	impact: 'low' | 'medium' | 'high';
	mitigation: string;
}

export class TaskPlanningTool implements IAgentTool {
	readonly name = 'task.planning';
	readonly description = 'Creates comprehensive task plans, work breakdown structures, and project timelines with intelligent resource allocation.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			project_description: {
				type: 'string',
				description: 'Detailed description of the project',
				required: true
			},
			project_scope: {
				type: 'string',
				description: 'Size and complexity of the project',
				enum: ['small', 'medium', 'large', 'enterprise'],
				required: true
			},
			timeline_weeks: {
				type: 'number',
				description: 'Desired timeline in weeks',
				default: 12
			},
			team_size: {
				type: 'number',
				description: 'Available team size',
				default: 5
			},
			technology_preferences: {
				type: 'array',
				description: 'Preferred technologies and frameworks',
				items: { type: 'string' }
			},
			methodology: {
				type: 'string',
				description: 'Development methodology to use',
				enum: ['agile', 'waterfall', 'hybrid'],
				default: 'agile'
			},
			include_risk_analysis: {
				type: 'boolean',
				description: 'Whether to include comprehensive risk analysis',
				default: true
			},
			output_format: {
				type: 'string',
				description: 'Output format for the task plan',
				enum: ['json', 'markdown', 'gantt'],
				default: 'markdown'
			}
		},
		required: ['project_description', 'project_scope']
	};

	async execute(args: ITaskPlanningArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			this.logService.info(`[TaskPlanningTool] Creating task plan for ${args.project_scope} project`);

			const taskPlan = await this.generateTaskPlan(args, context);
			
			// Save task plan to files
			if (context.projectRoot) {
				await this.saveTaskPlan(taskPlan, args, context);
			}

			return {
				result: taskPlan
			};

		} catch (error) {
			this.logService.error('[TaskPlanningTool] Task planning failed:', error);
			return {
				result: null,
				isError: true
			};
		}
	}

	private async generateTaskPlan(args: ITaskPlanningArgs, context: IAgentToolExecuteArg): Promise<ITaskPlan> {
		// Generate project overview
		const projectOverview = this.generateProjectOverview(args);
		
		// Create work breakdown structure
		const workBreakdown = this.generateWorkBreakdown(args);
		
		// Generate timeline
		const timeline = this.generateTimeline(args, workBreakdown);
		
		// Plan resource allocation
		const resourceAllocation = this.generateResourceAllocation(args, workBreakdown);
		
		// Perform risk analysis
		const riskAnalysis = args.include_risk_analysis ? 
			this.generateRiskAnalysis(args, workBreakdown) : 
			{ risks: [], mitigation_strategies: [], contingency_plans: [] };
		
		// Generate recommendations
		const recommendations = this.generateProjectRecommendations(args, workBreakdown, timeline);

		return {
			project_overview: projectOverview,
			work_breakdown: workBreakdown,
			timeline: timeline,
			resource_allocation: resourceAllocation,
			risk_analysis: riskAnalysis,
			recommendations: recommendations
		};
	}

	private generateProjectOverview(args: ITaskPlanningArgs): IProjectOverview {
		return {
			name: this.extractProjectName(args.project_description),
			description: args.project_description,
			objectives: this.extractObjectives(args.project_description),
			success_criteria: this.generateSuccessCriteria(args),
			stakeholders: ['Product Owner', 'Development Team', 'QA Team', 'DevOps Team', 'End Users']
		};
	}

	private generateWorkBreakdown(args: ITaskPlanningArgs): IWorkBreakdown {
		const epics = this.generateEpics(args);
		const totalStoryPoints = epics.reduce((sum, epic) => 
			sum + epic.features.reduce((featureSum, feature) => featureSum + feature.estimated_points, 0), 0
		);
		const estimatedHours = totalStoryPoints * 8; // 8 hours per story point

		return {
			epics: epics,
			total_story_points: totalStoryPoints,
			estimated_hours: estimatedHours
		};
	}

	private generateEpics(args: ITaskPlanningArgs): IEpic[] {
		// Generate epics based on project scope and description
		const baseEpics = [
			{
				id: 'epic-001',
				name: 'Project Setup and Foundation',
				description: 'Set up project infrastructure, development environment, and core architecture',
				priority: 'critical' as const,
				features: this.generateSetupFeatures(),
				estimated_weeks: this.getEpicEstimate(args.project_scope, 'setup'),
				dependencies: []
			},
			{
				id: 'epic-002', 
				name: 'Core Feature Development',
				description: 'Implement main business logic and core features',
				priority: 'high' as const,
				features: this.generateCoreFeatures(args),
				estimated_weeks: this.getEpicEstimate(args.project_scope, 'core'),
				dependencies: ['epic-001']
			},
			{
				id: 'epic-003',
				name: 'Integration and Testing',
				description: 'Integrate components and implement comprehensive testing',
				priority: 'high' as const,
				features: this.generateTestingFeatures(),
				estimated_weeks: this.getEpicEstimate(args.project_scope, 'testing'),
				dependencies: ['epic-002']
			},
			{
				id: 'epic-004',
				name: 'Deployment and Operations',
				description: 'Deploy system and set up monitoring and operations',
				priority: 'medium' as const,
				features: this.generateDeploymentFeatures(),
				estimated_weeks: this.getEpicEstimate(args.project_scope, 'deployment'),
				dependencies: ['epic-003']
			}
		];

		return baseEpics;
	}

	private generateSetupFeatures(): IFeature[] {
		return [
			{
				id: 'feature-setup-001',
				name: 'Development Environment Setup',
				description: 'Configure development tools, dependencies, and environment',
				user_stories: [
					{
						id: 'story-001',
						story: 'As a developer, I want a configured development environment so that I can start coding immediately',
						acceptance_criteria: ['Development tools installed', 'Dependencies configured', 'Environment variables set'],
						tasks: [
							{ id: 'task-001', description: 'Set up version control repository', type: 'development', estimated_hours: 2, required_skills: ['Git'], dependencies: [] },
							{ id: 'task-002', description: 'Configure build system and dependencies', type: 'development', estimated_hours: 4, required_skills: ['Build tools'], dependencies: ['task-001'] }
						],
						estimated_hours: 6
					}
				],
				acceptance_criteria: ['Environment setup completed', 'All dependencies installed', 'Build process working'],
				estimated_points: 3
			}
		];
	}

	private generateCoreFeatures(args: ITaskPlanningArgs): IFeature[] {
		// Generate features based on project description
		return [
			{
				id: 'feature-core-001',
				name: 'Core Business Logic',
				description: 'Implement main business functionality',
				user_stories: [],
				acceptance_criteria: ['Business logic implemented', 'Core features working', 'Basic testing completed'],
				estimated_points: this.getFeatureEstimate(args.project_scope, 'core')
			}
		];
	}

	private generateTestingFeatures(): IFeature[] {
		return [
			{
				id: 'feature-test-001',
				name: 'Comprehensive Testing',
				description: 'Implement unit, integration, and end-to-end testing',
				user_stories: [],
				acceptance_criteria: ['Test coverage >90%', 'All tests passing', 'Performance tests included'],
				estimated_points: 8
			}
		];
	}

	private generateDeploymentFeatures(): IFeature[] {
		return [
			{
				id: 'feature-deploy-001',
				name: 'Production Deployment',
				description: 'Deploy to production with monitoring and operations',
				user_stories: [],
				acceptance_criteria: ['Production deployment working', 'Monitoring configured', 'Operations runbooks created'],
				estimated_points: 5
			}
		];
	}

	private getEpicEstimate(scope: string, epicType: string): number {
		const estimates = {
			small: { setup: 1, core: 2, testing: 1, deployment: 1 },
			medium: { setup: 2, core: 4, testing: 2, deployment: 1 },
			large: { setup: 3, core: 8, testing: 3, deployment: 2 },
			enterprise: { setup: 4, core: 12, testing: 4, deployment: 3 }
		};
		
		return estimates[scope]?.[epicType] || 2;
	}

	private getFeatureEstimate(scope: string, featureType: string): number {
		const estimates = {
			small: 5,
			medium: 13,
			large: 21,
			enterprise: 34
		};
		
		return estimates[scope] || 13;
	}

	private generateTimeline(args: ITaskPlanningArgs, workBreakdown: IWorkBreakdown): IProjectTimeline {
		const totalWeeks = args.timeline_weeks || 
			workBreakdown.epics.reduce((sum, epic) => sum + epic.estimated_weeks, 0);

		return {
			total_duration_weeks: totalWeeks,
			phases: this.generatePhases(args, totalWeeks),
			milestones: this.generateMilestones(totalWeeks),
			critical_path: ['epic-001', 'epic-002', 'epic-003', 'epic-004']
		};
	}

	private generatePhases(args: ITaskPlanningArgs, totalWeeks: number): IPhase[] {
		return [
			{
				name: 'Planning & Setup',
				duration_weeks: Math.ceil(totalWeeks * 0.2),
				deliverables: ['Project plan', 'Architecture design', 'Development environment'],
				success_criteria: ['All planning completed', 'Team onboarded', 'Environment ready']
			},
			{
				name: 'Development',
				duration_weeks: Math.ceil(totalWeeks * 0.6),
				deliverables: ['Core features', 'API implementation', 'Database schema'],
				success_criteria: ['Features implemented', 'Tests passing', 'Code reviewed']
			},
			{
				name: 'Testing & Deployment',
				duration_weeks: Math.ceil(totalWeeks * 0.2),
				deliverables: ['Test suite', 'Production deployment', 'Documentation'],
				success_criteria: ['All tests passing', 'Production ready', 'Documentation complete']
			}
		];
	}

	private generateMilestones(totalWeeks: number): IMilestone[] {
		return [
			{
				name: 'Project Kickoff',
				week: 1,
				deliverables: ['Project charter', 'Team assignments'],
				acceptance_criteria: ['Stakeholder approval', 'Team commitment']
			},
			{
				name: 'Architecture Complete',
				week: Math.ceil(totalWeeks * 0.2),
				deliverables: ['System design', 'Technical specifications'],
				acceptance_criteria: ['Architecture approved', 'Technical review passed']
			},
			{
				name: 'MVP Complete',
				week: Math.ceil(totalWeeks * 0.7),
				deliverables: ['Minimum viable product', 'Core testing'],
				acceptance_criteria: ['MVP functional', 'Basic tests passing']
			},
			{
				name: 'Production Ready',
				week: totalWeeks,
				deliverables: ['Production deployment', 'Full documentation'],
				acceptance_criteria: ['Production stable', 'Documentation complete']
			}
		];
	}

	private generateResourceAllocation(args: ITaskPlanningArgs, workBreakdown: IWorkBreakdown): IResourceAllocation {
		const teamSize = args.team_size || 5;
		
		return {
			required_roles: [
				{ title: 'Tech Lead', count: 1, skills: ['Architecture', 'Leadership'], allocation_percentage: 100 },
				{ title: 'Senior Developer', count: Math.ceil(teamSize * 0.4), skills: ['Full-stack development'], allocation_percentage: 100 },
				{ title: 'Developer', count: Math.ceil(teamSize * 0.4), skills: ['Frontend/Backend development'], allocation_percentage: 100 },
				{ title: 'QA Engineer', count: 1, skills: ['Testing', 'Automation'], allocation_percentage: 80 },
				{ title: 'DevOps Engineer', count: 1, skills: ['CI/CD', 'Infrastructure'], allocation_percentage: 60 }
			],
			skill_requirements: this.extractSkillRequirements(args),
			capacity_planning: this.generateCapacityPlan(teamSize, args.timeline_weeks || 12)
		};
	}

	private generateRiskAnalysis(args: ITaskPlanningArgs, workBreakdown: IWorkBreakdown): IRiskAnalysis {
		return {
			risks: [
				{ description: 'Technical complexity higher than estimated', probability: 'medium', impact: 'high', mitigation: 'Add technical spikes and prototyping' },
				{ description: 'Resource availability constraints', probability: 'medium', impact: 'medium', mitigation: 'Cross-train team members and plan for contingencies' },
				{ description: 'Integration challenges with external systems', probability: 'low', impact: 'high', mitigation: 'Early integration testing and API mocking' },
				{ description: 'Performance requirements not met', probability: 'low', impact: 'medium', mitigation: 'Performance testing throughout development' }
			],
			mitigation_strategies: [
				'Implement iterative development with regular feedback',
				'Use proven technologies and patterns',
				'Maintain comprehensive test coverage',
				'Plan for scalability from the beginning'
			],
			contingency_plans: [
				'Reduce scope if timeline pressures increase',
				'Add additional resources for critical path items',
				'Implement MVP first, then enhance with additional features',
				'Use external expertise for specialized requirements'
			]
		};
	}

	private generateProjectRecommendations(args: ITaskPlanningArgs, workBreakdown: IWorkBreakdown, timeline: IProjectTimeline): string[] {
		const recommendations = [
			'Start with a solid technical foundation and architecture',
			'Implement continuous integration and deployment early',
			'Maintain regular stakeholder communication and feedback loops',
			'Plan for scalability and performance from the beginning'
		];

		if (args.project_scope === 'large' || args.project_scope === 'enterprise') {
			recommendations.push('Consider microservices architecture for better scalability');
			recommendations.push('Implement comprehensive monitoring and observability');
		}

		if (args.methodology === 'agile') {
			recommendations.push('Plan for 2-week sprints with regular retrospectives');
			recommendations.push('Maintain a well-groomed product backlog');
		}

		return recommendations;
	}

	private async saveTaskPlan(taskPlan: ITaskPlan, args: ITaskPlanningArgs, context: IAgentToolExecuteArg): Promise<void> {
		const docsDir = URI.joinPath(context.projectRoot!, 'docs', 'planning');
		await this.fileService.createFolder(docsDir);

		// Save main task plan
		const planPath = URI.joinPath(docsDir, 'task_plan.md');
		const planContent = this.formatTaskPlanAsMarkdown(taskPlan, args);
		await this.fileService.writeFile(planPath, VSBuffer.fromString(planContent));

		// Save JSON version for programmatic access
		const jsonPath = URI.joinPath(docsDir, 'task_plan.json');
		await this.fileService.writeFile(jsonPath, VSBuffer.fromString(JSON.stringify(taskPlan, null, 2)));
	}

	private formatTaskPlanAsMarkdown(taskPlan: ITaskPlan, args: ITaskPlanningArgs): string {
		return `# ${taskPlan.project_overview.name} - Task Plan

## Project Overview
${taskPlan.project_overview.description}

### Objectives
${taskPlan.project_overview.objectives.map(obj => `- ${obj}`).join('\n')}

### Success Criteria
${taskPlan.project_overview.success_criteria.map(criteria => `- ${criteria}`).join('\n')}

## Work Breakdown Structure

${taskPlan.work_breakdown.epics.map(epic => `
### Epic: ${epic.name}
**Priority**: ${epic.priority}
**Estimated Duration**: ${epic.estimated_weeks} weeks
**Description**: ${epic.description}

#### Features:
${epic.features.map(feature => `- **${feature.name}** (${feature.estimated_points} points): ${feature.description}`).join('\n')}
`).join('\n')}

## Timeline
**Total Duration**: ${taskPlan.timeline.total_duration_weeks} weeks

### Phases
${taskPlan.timeline.phases.map(phase => `
#### ${phase.name} (${phase.duration_weeks} weeks)
**Deliverables**: ${phase.deliverables.join(', ')}
**Success Criteria**: ${phase.success_criteria.join(', ')}
`).join('\n')}

### Milestones
${taskPlan.timeline.milestones.map(milestone => `- **Week ${milestone.week}**: ${milestone.name}`).join('\n')}

## Resource Allocation
${taskPlan.resource_allocation.required_roles.map(role => `- **${role.title}**: ${role.count} person(s) at ${role.allocation_percentage}% allocation`).join('\n')}

## Risk Analysis
${taskPlan.risk_analysis.risks.map(risk => `
### ${risk.description}
**Probability**: ${risk.probability} | **Impact**: ${risk.impact}
**Mitigation**: ${risk.mitigation}
`).join('\n')}

## Recommendations
${taskPlan.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by TaskPlanningTool on ${new Date().toISOString()}*`;
	}

	private extractProjectName(description: string): string {
		// Simple extraction - would be enhanced with NLP
		const words = description.split(' ').slice(0, 3);
		return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
	}

	private extractObjectives(description: string): string[] {
		// Simple objective extraction
		return [
			'Deliver a functional and reliable system',
			'Meet all specified requirements and constraints',
			'Ensure high code quality and maintainability',
			'Deploy successfully to production environment'
		];
	}

	private generateSuccessCriteria(args: ITaskPlanningArgs): string[] {
		return [
			'All functional requirements implemented and tested',
			'Performance requirements met under expected load',
			'Security requirements validated',
			'Documentation complete and up-to-date',
			'Production deployment successful and stable'
		];
	}

	private extractSkillRequirements(args: ITaskPlanningArgs): string[] {
		const skills = ['Software Development', 'Testing', 'DevOps'];
		
		if (args.technology_preferences) {
			skills.push(...args.technology_preferences);
		}
		
		return skills;
	}

	private generateCapacityPlan(teamSize: number, weeks: number): ICapacityPlan[] {
		const plans = [];
		const hoursPerWeek = teamSize * 40; // 40 hours per person per week
		
		for (let week = 1; week <= weeks; week++) {
			plans.push({
				week: week,
				total_capacity_hours: hoursPerWeek,
				allocated_hours: Math.round(hoursPerWeek * 0.85), // 85% utilization
				utilization_percentage: 85
			});
		}
		
		return plans;
	}
}