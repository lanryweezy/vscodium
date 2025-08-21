/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

interface IRequirementAnalysisArgs {
	input_text: string;
	analysis_type: 'functional' | 'non_functional' | 'comprehensive' | 'user_stories' | 'acceptance_criteria';
	project_context?: string;
	stakeholder_perspective?: 'user' | 'business' | 'technical' | 'all';
	output_format: 'structured' | 'user_stories' | 'specifications' | 'checklist';
	include_priorities: boolean;
}

interface IRequirementAnalysisResult {
	functional_requirements: IRequirement[];
	non_functional_requirements: IRequirement[];
	user_stories: IUserStoryRequirement[];
	acceptance_criteria: string[];
	business_rules: string[];
	constraints: string[];
	assumptions: string[];
	priorities: IPriorityMatrix;
	recommendations: string[];
}

interface IRequirement {
	id: string;
	title: string;
	description: string;
	category: string;
	priority: 'critical' | 'high' | 'medium' | 'low';
	complexity: 'simple' | 'moderate' | 'complex';
	acceptance_criteria: string[];
	dependencies: string[];
	estimated_effort: string;
}

interface IUserStoryRequirement {
	id: string;
	as_a: string;
	i_want: string;
	so_that: string;
	acceptance_criteria: string[];
	priority: 'critical' | 'high' | 'medium' | 'low';
	story_points: number;
	epic: string;
}

interface IPriorityMatrix {
	critical: string[];
	high: string[];
	medium: string[];
	low: string[];
}

export class RequirementAnalysisTool implements IAgentTool {
	readonly name = 'requirement.analysis';
	readonly description = 'Analyzes text input to extract and structure functional requirements, non-functional requirements, user stories, and acceptance criteria.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			input_text: {
				type: 'string',
				description: 'Raw text containing requirements, user needs, or project description',
				required: true
			},
			analysis_type: {
				type: 'string',
				description: 'Type of requirement analysis to perform',
				enum: ['functional', 'non_functional', 'comprehensive', 'user_stories', 'acceptance_criteria'],
				default: 'comprehensive'
			},
			project_context: {
				type: 'string',
				description: 'Additional context about the project domain or industry'
			},
			stakeholder_perspective: {
				type: 'string',
				description: 'Perspective to analyze requirements from',
				enum: ['user', 'business', 'technical', 'all'],
				default: 'all'
			},
			output_format: {
				type: 'string',
				description: 'Format for the structured output',
				enum: ['structured', 'user_stories', 'specifications', 'checklist'],
				default: 'structured'
			},
			include_priorities: {
				type: 'boolean',
				description: 'Whether to include priority analysis',
				default: true
			}
		},
		required: ['input_text']
	};

	async execute(args: IRequirementAnalysisArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			this.logService.info(`[RequirementAnalysisTool] Analyzing requirements with ${args.analysis_type} analysis`);

			const analysisResult = await this.analyzeRequirements(args, context);
			
			// Save analysis to file
			if (context.projectRoot) {
				await this.saveAnalysisResults(analysisResult, args, context);
			}

			return {
				result: analysisResult
			};

		} catch (error) {
			this.logService.error('[RequirementAnalysisTool] Requirement analysis failed:', error);
			return {
				result: null,
				isError: true
			};
		}
	}

	private async analyzeRequirements(args: IRequirementAnalysisArgs, context: IAgentToolExecuteArg): Promise<IRequirementAnalysisResult> {
		const inputText = args.input_text.toLowerCase();
		
		// Extract different types of requirements
		const functionalRequirements = this.extractFunctionalRequirements(args.input_text);
		const nonFunctionalRequirements = this.extractNonFunctionalRequirements(args.input_text);
		const userStories = this.generateUserStories(args.input_text, args.project_context);
		const acceptanceCriteria = this.generateAcceptanceCriteria(args.input_text);
		const businessRules = this.extractBusinessRules(args.input_text);
		const constraints = this.extractConstraints(args.input_text);
		const assumptions = this.extractAssumptions(args.input_text);
		
		// Generate priority matrix
		const priorities = args.include_priorities ? 
			this.generatePriorityMatrix(functionalRequirements, nonFunctionalRequirements) :
			{ critical: [], high: [], medium: [], low: [] };

		// Generate recommendations
		const recommendations = this.generateAnalysisRecommendations(args, functionalRequirements, nonFunctionalRequirements);

		return {
			functional_requirements: functionalRequirements,
			non_functional_requirements: nonFunctionalRequirements,
			user_stories: userStories,
			acceptance_criteria: acceptanceCriteria,
			business_rules: businessRules,
			constraints: constraints,
			assumptions: assumptions,
			priorities: priorities,
			recommendations: recommendations
		};
	}

	private extractFunctionalRequirements(inputText: string): IRequirement[] {
		const requirements: IRequirement[] = [];
		const sentences = inputText.split(/[.!?]+/);
		
		let reqId = 1;
		for (const sentence of sentences) {
			if (this.isFunctionalRequirement(sentence)) {
				requirements.push({
					id: `FR-${reqId.toString().padStart(3, '0')}`,
					title: this.generateRequirementTitle(sentence),
					description: sentence.trim(),
					category: this.categorizeRequirement(sentence),
					priority: this.assessPriority(sentence),
					complexity: this.assessComplexity(sentence),
					acceptance_criteria: this.generateAcceptanceCriteriaForRequirement(sentence),
					dependencies: [],
					estimated_effort: this.estimateEffort(sentence)
				});
				reqId++;
			}
		}

		return requirements;
	}

	private extractNonFunctionalRequirements(inputText: string): IRequirement[] {
		const requirements: IRequirement[] = [];
		const nfrKeywords = ['performance', 'security', 'scalability', 'usability', 'reliability', 'availability'];
		
		let reqId = 1;
		for (const keyword of nfrKeywords) {
			if (inputText.toLowerCase().includes(keyword)) {
				requirements.push({
					id: `NFR-${reqId.toString().padStart(3, '0')}`,
					title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Requirements`,
					description: `System must meet ${keyword} requirements as specified`,
					category: keyword,
					priority: 'high',
					complexity: 'moderate',
					acceptance_criteria: this.generateNFRCriteria(keyword),
					dependencies: [],
					estimated_effort: '2-3 days'
				});
				reqId++;
			}
		}

		return requirements;
	}

	private generateUserStories(inputText: string, projectContext?: string): IUserStoryRequirement[] {
		const stories: IUserStoryRequirement[] = [];
		const features = this.extractFeatures(inputText);
		
		let storyId = 1;
		for (const feature of features) {
			stories.push({
				id: `US-${storyId.toString().padStart(3, '0')}`,
				as_a: this.inferUserRole(feature, projectContext),
				i_want: feature,
				so_that: this.inferUserBenefit(feature),
				acceptance_criteria: this.generateStoryAcceptanceCriteria(feature),
				priority: this.assessFeaturePriority(feature),
				story_points: this.estimateStoryPoints(feature),
				epic: this.assignToEpic(feature)
			});
			storyId++;
		}

		return stories;
	}

	private isFunctionalRequirement(sentence: string): boolean {
		const functionalKeywords = ['must', 'should', 'shall', 'will', 'can', 'allow', 'enable', 'provide'];
		return functionalKeywords.some(keyword => sentence.toLowerCase().includes(keyword));
	}

	private generateRequirementTitle(sentence: string): string {
		const words = sentence.trim().split(' ').slice(0, 6);
		return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '');
	}

	private categorizeRequirement(sentence: string): string {
		const categories = {
			'user_interface': ['ui', 'interface', 'display', 'show', 'view'],
			'data_management': ['data', 'store', 'save', 'database', 'record'],
			'authentication': ['login', 'auth', 'user', 'account', 'password'],
			'integration': ['api', 'integrate', 'connect', 'external', 'service'],
			'business_logic': ['calculate', 'process', 'validate', 'business', 'rule']
		};

		const sentenceLower = sentence.toLowerCase();
		for (const [category, keywords] of Object.entries(categories)) {
			if (keywords.some(keyword => sentenceLower.includes(keyword))) {
				return category;
			}
		}

		return 'general';
	}

	private assessPriority(sentence: string): 'critical' | 'high' | 'medium' | 'low' {
		const sentenceLower = sentence.toLowerCase();
		
		if (sentenceLower.includes('critical') || sentenceLower.includes('must')) return 'critical';
		if (sentenceLower.includes('important') || sentenceLower.includes('should')) return 'high';
		if (sentenceLower.includes('could') || sentenceLower.includes('nice')) return 'medium';
		
		return 'medium';
	}

	private assessComplexity(sentence: string): 'simple' | 'moderate' | 'complex' {
		const sentenceLower = sentence.toLowerCase();
		const complexKeywords = ['integrate', 'complex', 'advanced', 'multiple', 'distributed'];
		
		if (complexKeywords.some(keyword => sentenceLower.includes(keyword))) return 'complex';
		if (sentence.length > 100) return 'moderate';
		
		return 'simple';
	}

	private generateAcceptanceCriteriaForRequirement(sentence: string): string[] {
		return [
			'Requirement is fully implemented',
			'Implementation passes all tests',
			'Performance meets specified criteria',
			'Security requirements are satisfied'
		];
	}

	private generateNFRCriteria(keyword: string): string[] {
		const criteria = {
			'performance': ['Response time < 2 seconds', 'Throughput > 1000 requests/minute', 'CPU usage < 80%'],
			'security': ['Authentication required', 'Data encrypted in transit and at rest', 'Input validation implemented'],
			'scalability': ['Supports horizontal scaling', 'Handles 10x current load', 'Auto-scaling configured'],
			'usability': ['User-friendly interface', 'Accessibility compliant', 'Mobile responsive'],
			'reliability': ['99.9% uptime', 'Graceful error handling', 'Automatic recovery'],
			'availability': ['24/7 operation', 'Planned maintenance windows', 'Disaster recovery plan']
		};

		return criteria[keyword] || ['Meets industry standards', 'Validated through testing'];
	}

	private extractFeatures(inputText: string): string[] {
		// Simple feature extraction - would be enhanced with NLP
		const sentences = inputText.split(/[.!?]+/);
		const features = [];
		
		for (const sentence of sentences) {
			if (sentence.length > 10 && sentence.length < 200) {
				features.push(sentence.trim());
			}
		}
		
		return features.slice(0, 10);
	}

	private inferUserRole(feature: string, projectContext?: string): string {
		const featureLower = feature.toLowerCase();
		
		if (featureLower.includes('admin')) return 'system administrator';
		if (featureLower.includes('manager')) return 'manager';
		if (featureLower.includes('developer')) return 'developer';
		
		return projectContext ? `${projectContext} user` : 'user';
	}

	private inferUserBenefit(feature: string): string {
		return `I can accomplish my goals efficiently and effectively`;
	}

	private generateStoryAcceptanceCriteria(feature: string): string[] {
		return [
			'Feature is accessible and functional',
			'User interface is intuitive and responsive',
			'All edge cases are handled properly',
			'Feature integrates properly with existing system'
		];
	}

	private assessFeaturePriority(feature: string): 'critical' | 'high' | 'medium' | 'low' {
		const featureLower = feature.toLowerCase();
		
		if (featureLower.includes('login') || featureLower.includes('security')) return 'critical';
		if (featureLower.includes('core') || featureLower.includes('main')) return 'high';
		if (featureLower.includes('nice') || featureLower.includes('enhancement')) return 'low';
		
		return 'medium';
	}

	private estimateStoryPoints(feature: string): number {
		const complexity = this.assessComplexity(feature);
		const pointMap = { simple: 3, moderate: 5, complex: 8 };
		return pointMap[complexity];
	}

	private assignToEpic(feature: string): string {
		const featureLower = feature.toLowerCase();
		
		if (featureLower.includes('auth') || featureLower.includes('login')) return 'Authentication Epic';
		if (featureLower.includes('ui') || featureLower.includes('interface')) return 'User Interface Epic';
		if (featureLower.includes('api') || featureLower.includes('service')) return 'API Epic';
		if (featureLower.includes('data') || featureLower.includes('database')) return 'Data Management Epic';
		
		return 'Core Features Epic';
	}

	private generateAcceptanceCriteria(inputText: string): string[] {
		return [
			'All specified functionality is implemented',
			'System performs within acceptable parameters',
			'User interface is intuitive and accessible',
			'Data integrity is maintained',
			'Security requirements are met',
			'System is properly tested and documented'
		];
	}

	private extractBusinessRules(inputText: string): string[] {
		const rules = [];
		const sentences = inputText.split(/[.!?]+/);
		
		for (const sentence of sentences) {
			if (sentence.toLowerCase().includes('rule') || 
				sentence.toLowerCase().includes('policy') ||
				sentence.toLowerCase().includes('must not') ||
				sentence.toLowerCase().includes('only if')) {
				rules.push(sentence.trim());
			}
		}
		
		return rules;
	}

	private extractConstraints(inputText: string): string[] {
		const constraints = [];
		const constraintKeywords = ['budget', 'timeline', 'technology', 'resource', 'compliance', 'regulation'];
		const sentences = inputText.split(/[.!?]+/);
		
		for (const sentence of sentences) {
			if (constraintKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
				constraints.push(sentence.trim());
			}
		}
		
		return constraints;
	}

	private extractAssumptions(inputText: string): string[] {
		return [
			'Users have basic technical literacy',
			'Internet connectivity is available',
			'Standard browser compatibility is sufficient',
			'Current infrastructure can support the system',
			'Required integrations are available and accessible'
		];
	}

	private generatePriorityMatrix(
		functionalRequirements: IRequirement[], 
		nonFunctionalRequirements: IRequirement[]
	): IPriorityMatrix {
		const allRequirements = [...functionalRequirements, ...nonFunctionalRequirements];
		
		const matrix: IPriorityMatrix = {
			critical: [],
			high: [],
			medium: [],
			low: []
		};

		for (const req of allRequirements) {
			matrix[req.priority].push(req.title);
		}

		return matrix;
	}

	private generateAnalysisRecommendations(
		args: IRequirementAnalysisArgs,
		functionalReqs: IRequirement[],
		nonFunctionalReqs: IRequirement[]
	): string[] {
		const recommendations = [
			'Validate requirements with stakeholders before implementation',
			'Create prototypes for complex or unclear requirements',
			'Implement critical requirements first',
			'Plan for iterative development and feedback cycles'
		];

		if (functionalReqs.length > 20) {
			recommendations.push('Consider breaking down into smaller, manageable releases');
		}

		if (nonFunctionalReqs.length > 10) {
			recommendations.push('Prioritize non-functional requirements early in development');
		}

		return recommendations;
	}

	private estimateEffort(sentence: string): string {
		const complexity = this.assessComplexity(sentence);
		const effortMap = {
			simple: '1-2 days',
			moderate: '3-5 days', 
			complex: '1-2 weeks'
		};
		return effortMap[complexity];
	}

	private async saveAnalysisResults(
		result: IRequirementAnalysisResult, 
		args: IRequirementAnalysisArgs, 
		context: IAgentToolExecuteArg
	): Promise<void> {
		const docsDir = URI.joinPath(context.projectRoot!, 'docs', 'requirements');
		await this.fileService.createFolder(docsDir);

		// Save main analysis
		const analysisPath = URI.joinPath(docsDir, 'requirement_analysis.md');
		const analysisContent = this.formatAnalysisAsMarkdown(result, args);
		await this.fileService.writeFile(analysisPath, VSBuffer.fromString(analysisContent));

		// Save JSON version
		const jsonPath = URI.joinPath(docsDir, 'requirement_analysis.json');
		await this.fileService.writeFile(jsonPath, VSBuffer.fromString(JSON.stringify(result, null, 2)));
	}

	private formatAnalysisAsMarkdown(result: IRequirementAnalysisResult, args: IRequirementAnalysisArgs): string {
		return `# Requirement Analysis Report

## Functional Requirements
${result.functional_requirements.map(req => `
### ${req.title} (${req.id})
**Priority**: ${req.priority} | **Complexity**: ${req.complexity}
**Description**: ${req.description}
**Estimated Effort**: ${req.estimated_effort}

**Acceptance Criteria**:
${req.acceptance_criteria.map(criteria => `- ${criteria}`).join('\n')}
`).join('\n')}

## Non-Functional Requirements
${result.non_functional_requirements.map(req => `
### ${req.title} (${req.id})
**Category**: ${req.category} | **Priority**: ${req.priority}
**Description**: ${req.description}

**Acceptance Criteria**:
${req.acceptance_criteria.map(criteria => `- ${criteria}`).join('\n')}
`).join('\n')}

## User Stories
${result.user_stories.map(story => `
### ${story.id}: ${story.i_want}
**As a** ${story.as_a}
**I want** ${story.i_want}
**So that** ${story.so_that}

**Priority**: ${story.priority} | **Story Points**: ${story.story_points} | **Epic**: ${story.epic}

**Acceptance Criteria**:
${story.acceptance_criteria.map(criteria => `- ${criteria}`).join('\n')}
`).join('\n')}

## Priority Matrix
### Critical
${result.priorities.critical.map(item => `- ${item}`).join('\n')}

### High
${result.priorities.high.map(item => `- ${item}`).join('\n')}

### Medium
${result.priorities.medium.map(item => `- ${item}`).join('\n')}

### Low
${result.priorities.low.map(item => `- ${item}`).join('\n')}

## Business Rules
${result.business_rules.map(rule => `- ${rule}`).join('\n')}

## Constraints
${result.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Assumptions
${result.assumptions.map(assumption => `- ${assumption}`).join('\n')}

## Recommendations
${result.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by RequirementAnalysisTool on ${new Date().toISOString()}*`;
	}
}