/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IAgentDefinition } from 'vs/platform/ai/common/aiTypes';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { Emitter, Event } from 'vs/base/common/event';

export const IEnhancedAgentRegistry = createDecorator<IEnhancedAgentRegistry>('enhancedAgentRegistry');

export interface IAgentCapability {
	name: string;
	description: string;
	complexity: 'basic' | 'intermediate' | 'advanced' | 'expert';
	domains: string[];
}

export interface IAgentRecommendation {
	agentName: string;
	confidence: number;
	reasoning: string;
	alternatives: string[];
}

export interface IEnhancedAgentRegistry {
	readonly _serviceBrand: undefined;
	readonly onAgentRegistered: Event<IAgentDefinition>;
	readonly onAgentUpdated: Event<IAgentDefinition>;

	getAllAgents(): IAgentDefinition[];
	getAgentsByCapability(capability: string): IAgentDefinition[];
	getAgentsByDomain(domain: string): IAgentDefinition[];
	recommendAgentForTask(taskDescription: string, context?: any): IAgentRecommendation[];
	getAgentCollaborationGraph(): Map<string, string[]>;
	validateAgentConfiguration(agent: IAgentDefinition): boolean;
	getAgentStatistics(): IAgentRegistryStats;
}

export interface IAgentRegistryStats {
	totalAgents: number;
	agentsByProvider: Record<string, number>;
	agentsByCapability: Record<string, number>;
	averageToolsPerAgent: number;
	collaborationConnections: number;
}

export class EnhancedAgentRegistry implements IEnhancedAgentRegistry {
	readonly _serviceBrand: undefined;

	private readonly _onAgentRegistered = new Emitter<IAgentDefinition>();
	readonly onAgentRegistered: Event<IAgentDefinition> = this._onAgentRegistered.event;

	private readonly _onAgentUpdated = new Emitter<IAgentDefinition>();
	readonly onAgentUpdated: Event<IAgentDefinition> = this._onAgentUpdated.event;

	private readonly agents = new Map<string, IAgentDefinition>();
	private readonly capabilityIndex = new Map<string, Set<string>>();
	private readonly domainIndex = new Map<string, Set<string>>();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		this.loadAllAgents();
	}

	private async loadAllAgents(): Promise<void> {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length === 0) {
			this.logService.warn('[EnhancedAgentRegistry] No workspace folder found');
			return;
		}

		const projectRoot = workspaceFolders[0].uri;
		const agentImplDir = URI.joinPath(projectRoot, 'src/vs/platform/ai/common/agentimpl');

		try {
			const agentFiles = await this.fileService.resolve(agentImplDir);
			if (agentFiles.children) {
				for (const file of agentFiles.children) {
					if (file.name.endsWith('.agent.definition.json')) {
						await this.loadAgent(file.resource);
					}
				}
			}
		} catch (error) {
			this.logService.error('[EnhancedAgentRegistry] Failed to load agents:', error);
		}
	}

	private async loadAgent(agentFile: URI): Promise<void> {
		try {
			const content = await this.fileService.readFile(agentFile);
			const agentDefinition: IAgentDefinition = JSON.parse(content.value.toString());
			
			this.registerAgent(agentDefinition);
			this.logService.info(`[EnhancedAgentRegistry] Loaded agent: ${agentDefinition.name}`);
		} catch (error) {
			this.logService.error(`[EnhancedAgentRegistry] Failed to load agent from ${agentFile.toString()}:`, error);
		}
	}

	private registerAgent(agent: IAgentDefinition): void {
		// Validate agent configuration
		if (!this.validateAgentConfiguration(agent)) {
			this.logService.warn(`[EnhancedAgentRegistry] Invalid agent configuration: ${agent.name}`);
			return;
		}

		this.agents.set(agent.name, agent);

		// Index by capabilities
		if (agent.capabilities) {
			for (const capability of agent.capabilities) {
				if (!this.capabilityIndex.has(capability)) {
					this.capabilityIndex.set(capability, new Set());
				}
				this.capabilityIndex.get(capability)!.add(agent.name);
			}
		}

		// Index by domain (inferred from description)
		const domains = this.extractDomainsFromDescription(agent.description);
		for (const domain of domains) {
			if (!this.domainIndex.has(domain)) {
				this.domainIndex.set(domain, new Set());
			}
			this.domainIndex.get(domain)!.add(agent.name);
		}

		this._onAgentRegistered.fire(agent);
	}

	getAllAgents(): IAgentDefinition[] {
		return Array.from(this.agents.values());
	}

	getAgentsByCapability(capability: string): IAgentDefinition[] {
		const agentNames = this.capabilityIndex.get(capability) || new Set();
		return Array.from(agentNames).map(name => this.agents.get(name)!).filter(Boolean);
	}

	getAgentsByDomain(domain: string): IAgentDefinition[] {
		const agentNames = this.domainIndex.get(domain) || new Set();
		return Array.from(agentNames).map(name => this.agents.get(name)!).filter(Boolean);
	}

	recommendAgentForTask(taskDescription: string, context?: any): IAgentRecommendation[] {
		const recommendations: IAgentRecommendation[] = [];
		const taskLower = taskDescription.toLowerCase();

		// Score agents based on task description keywords
		for (const [name, agent] of this.agents) {
			let score = 0;
			const reasoning: string[] = [];

			// Check capabilities match
			if (agent.capabilities) {
				for (const capability of agent.capabilities) {
					if (taskLower.includes(capability.replace(/_/g, ' '))) {
						score += 0.3;
						reasoning.push(`Strong capability match: ${capability}`);
					}
				}
			}

			// Check description keywords
			const descriptionWords = agent.description.toLowerCase().split(/\s+/);
			const taskWords = taskLower.split(/\s+/);
			const commonWords = taskWords.filter(word => descriptionWords.includes(word));
			score += (commonWords.length / taskWords.length) * 0.4;

			// Check tools availability
			if (agent.tools) {
				const relevantTools = this.getRelevantTools(taskDescription);
				const hasRelevantTools = agent.tools.some(tool => relevantTools.includes(tool));
				if (hasRelevantTools) {
					score += 0.2;
					reasoning.push('Has relevant tools for task');
				}
			}

			// Check permissions
			if (this.requiresSpecialPermissions(taskDescription)) {
				const hasPermissions = this.checkPermissions(agent, taskDescription);
				if (hasPermissions) {
					score += 0.1;
					reasoning.push('Has required permissions');
				} else {
					score -= 0.2;
					reasoning.push('Missing required permissions');
				}
			}

			if (score > 0.2) {
				recommendations.push({
					agentName: name,
					confidence: Math.min(score, 0.95),
					reasoning: reasoning.join('; '),
					alternatives: this.getAlternativeAgents(name)
				});
			}
		}

		// Sort by confidence and return top recommendations
		return recommendations
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, 5);
	}

	getAgentCollaborationGraph(): Map<string, string[]> {
		const graph = new Map<string, string[]>();
		
		for (const [name, agent] of this.agents) {
			graph.set(name, agent.can_call || []);
		}

		return graph;
	}

	validateAgentConfiguration(agent: IAgentDefinition): boolean {
		// Basic validation
		if (!agent.name || !agent.description || !agent.role) {
			return false;
		}

		// Check required fields
		if (!agent.permissions || !agent.tools) {
			return false;
		}

		// Validate permissions structure
		const requiredPermissions = ['code_edit', 'terminal_access', 'file_system_access'];
		for (const perm of requiredPermissions) {
			if (!(perm in agent.permissions)) {
				return false;
			}
		}

		return true;
	}

	getAgentStatistics(): IAgentRegistryStats {
		const stats: IAgentRegistryStats = {
			totalAgents: this.agents.size,
			agentsByProvider: {},
			agentsByCapability: {},
			averageToolsPerAgent: 0,
			collaborationConnections: 0
		};

		let totalTools = 0;
		let totalConnections = 0;

		for (const agent of this.agents.values()) {
			// Count by provider
			const provider = agent.provider || 'default';
			stats.agentsByProvider[provider] = (stats.agentsByProvider[provider] || 0) + 1;

			// Count by capabilities
			if (agent.capabilities) {
				for (const capability of agent.capabilities) {
					stats.agentsByCapability[capability] = (stats.agentsByCapability[capability] || 0) + 1;
				}
			}

			// Count tools
			totalTools += agent.tools?.length || 0;

			// Count collaboration connections
			totalConnections += agent.can_call?.length || 0;
		}

		stats.averageToolsPerAgent = totalTools / this.agents.size;
		stats.collaborationConnections = totalConnections;

		return stats;
	}

	private extractDomainsFromDescription(description: string): string[] {
		const domains = [];
		const domainKeywords = {
			'web': ['web', 'frontend', 'backend', 'api', 'http'],
			'mobile': ['mobile', 'ios', 'android', 'app'],
			'data': ['data', 'database', 'sql', 'analytics'],
			'security': ['security', 'vulnerability', 'penetration', 'audit'],
			'cloud': ['cloud', 'aws', 'azure', 'gcp', 'serverless'],
			'devops': ['devops', 'deployment', 'ci/cd', 'infrastructure'],
			'ai': ['ai', 'machine learning', 'neural', 'model'],
			'blockchain': ['blockchain', 'smart contract', 'defi', 'web3']
		};

		const descLower = description.toLowerCase();
		for (const [domain, keywords] of Object.entries(domainKeywords)) {
			if (keywords.some(keyword => descLower.includes(keyword))) {
				domains.push(domain);
			}
		}

		return domains;
	}

	private getRelevantTools(taskDescription: string): string[] {
		const toolMappings: Record<string, string[]> = {
			'debug': ['debug.intelligent'],
			'test': ['qa.runChecks', 'code.generate'],
			'code': ['code.generate', 'code.modify'],
			'security': ['security.scanFile'],
			'deploy': ['dependency.add'],
			'collaborate': ['pair.programming']
		};

		const relevantTools: string[] = [];
		const taskLower = taskDescription.toLowerCase();

		for (const [keyword, tools] of Object.entries(toolMappings)) {
			if (taskLower.includes(keyword)) {
				relevantTools.push(...tools);
			}
		}

		return relevantTools;
	}

	private requiresSpecialPermissions(taskDescription: string): boolean {
		const sensitiveKeywords = ['file', 'terminal', 'network', 'system', 'deploy'];
		return sensitiveKeywords.some(keyword => taskDescription.toLowerCase().includes(keyword));
	}

	private checkPermissions(agent: IAgentDefinition, taskDescription: string): boolean {
		const taskLower = taskDescription.toLowerCase();
		
		if (taskLower.includes('file') && !agent.permissions.file_system_access) return false;
		if (taskLower.includes('terminal') && !agent.permissions.terminal_access) return false;
		if (taskLower.includes('network') && !agent.permissions.network_access) return false;
		
		return true;
	}

	private getAlternativeAgents(agentName: string): string[] {
		const agent = this.agents.get(agentName);
		if (!agent || !agent.capabilities) return [];

		const alternatives = new Set<string>();
		
		// Find agents with overlapping capabilities
		for (const capability of agent.capabilities) {
			const similarAgents = this.capabilityIndex.get(capability) || new Set();
			for (const similarAgent of similarAgents) {
				if (similarAgent !== agentName) {
					alternatives.add(similarAgent);
				}
			}
		}

		return Array.from(alternatives).slice(0, 3);
	}
}