/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

interface IDesignSpecArgs {
	spec_type: 'system_design' | 'technical_spec' | 'api_spec' | 'database_spec' | 'ui_spec' | 'test_spec';
	project_name: string;
	requirements: string;
	stakeholders?: string[];
	constraints?: string[];
	technology_stack?: string[];
	output_format: 'markdown' | 'json' | 'yaml' | 'html';
	include_diagrams: boolean;
	detail_level: 'high_level' | 'detailed' | 'comprehensive';
}

interface ISpecificationResult {
	specification_document: string;
	diagrams?: string[];
	implementation_guide: string;
	acceptance_criteria: string[];
	risk_assessment: string[];
	recommendations: string[];
}

export class DesignSpecificationTool implements IAgentTool {
	readonly name = 'design.specification';
	readonly description = 'Creates comprehensive design specifications, technical documents, and implementation guides for software projects.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			spec_type: {
				type: 'string',
				description: 'Type of specification to create',
				enum: ['system_design', 'technical_spec', 'api_spec', 'database_spec', 'ui_spec', 'test_spec'],
				required: true
			},
			project_name: {
				type: 'string',
				description: 'Name of the project or system',
				required: true
			},
			requirements: {
				type: 'string',
				description: 'Detailed requirements and objectives',
				required: true
			},
			stakeholders: {
				type: 'array',
				description: 'List of project stakeholders',
				items: { type: 'string' }
			},
			constraints: {
				type: 'array',
				description: 'Technical and business constraints',
				items: { type: 'string' }
			},
			technology_stack: {
				type: 'array',
				description: 'Preferred or required technologies',
				items: { type: 'string' }
			},
			output_format: {
				type: 'string',
				description: 'Output format for the specification',
				enum: ['markdown', 'json', 'yaml', 'html'],
				default: 'markdown'
			},
			include_diagrams: {
				type: 'boolean',
				description: 'Whether to include architectural diagrams',
				default: true
			},
			detail_level: {
				type: 'string',
				description: 'Level of detail for the specification',
				enum: ['high_level', 'detailed', 'comprehensive'],
				default: 'detailed'
			}
		},
		required: ['spec_type', 'project_name', 'requirements']
	};

	async execute(args: IDesignSpecArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			this.logService.info(`[DesignSpecificationTool] Creating ${args.spec_type} for ${args.project_name}`);

			const specification = await this.generateSpecification(args, context);
			
			// Save specification to file
			if (context.projectRoot) {
				const specFileName = this.generateFileName(args);
				const specPath = URI.joinPath(context.projectRoot, 'docs', 'specifications', specFileName);
				
				// Ensure directory exists
				await this.fileService.createFolder(URI.joinPath(context.projectRoot, 'docs', 'specifications'));
				
				// Write specification
				await this.fileService.writeFile(specPath, VSBuffer.fromString(specification.specification_document));
				
				// Write implementation guide
				const guidePath = URI.joinPath(context.projectRoot, 'docs', 'specifications', `${args.project_name}_implementation_guide.md`);
				await this.fileService.writeFile(guidePath, VSBuffer.fromString(specification.implementation_guide));
			}

			return {
				result: specification
			};

		} catch (error) {
			this.logService.error('[DesignSpecificationTool] Specification creation failed:', error);
			return {
				result: null,
				isError: true
			};
		}
	}

	private async generateSpecification(args: IDesignSpecArgs, context: IAgentToolExecuteArg): Promise<ISpecificationResult> {
		const template = this.getSpecificationTemplate(args.spec_type);
		const content = this.populateTemplate(template, args);
		
		const result: ISpecificationResult = {
			specification_document: content,
			implementation_guide: this.generateImplementationGuide(args),
			acceptance_criteria: this.generateAcceptanceCriteria(args),
			risk_assessment: this.generateRiskAssessment(args),
			recommendations: this.generateRecommendations(args)
		};

		if (args.include_diagrams) {
			result.diagrams = this.generateDiagramDescriptions(args);
		}

		return result;
	}

	private getSpecificationTemplate(specType: string): string {
		const templates = {
			system_design: `# {{PROJECT_NAME}} - System Design Specification

## 1. Executive Summary
{{EXECUTIVE_SUMMARY}}

## 2. System Overview
### 2.1 Purpose and Scope
{{PURPOSE_AND_SCOPE}}

### 2.2 System Context
{{SYSTEM_CONTEXT}}

### 2.3 Key Features
{{KEY_FEATURES}}

## 3. Architecture Design
### 3.1 High-Level Architecture
{{HIGH_LEVEL_ARCHITECTURE}}

### 3.2 Component Architecture
{{COMPONENT_ARCHITECTURE}}

### 3.3 Data Architecture
{{DATA_ARCHITECTURE}}

### 3.4 Integration Architecture
{{INTEGRATION_ARCHITECTURE}}

## 4. Non-Functional Requirements
### 4.1 Performance Requirements
{{PERFORMANCE_REQUIREMENTS}}

### 4.2 Security Requirements
{{SECURITY_REQUIREMENTS}}

### 4.3 Scalability Requirements
{{SCALABILITY_REQUIREMENTS}}

## 5. Technology Stack
{{TECHNOLOGY_STACK}}

## 6. Implementation Plan
{{IMPLEMENTATION_PLAN}}

## 7. Risk Assessment
{{RISK_ASSESSMENT}}

## 8. Appendices
{{APPENDICES}}`,

			technical_spec: `# {{PROJECT_NAME}} - Technical Specification

## 1. Introduction
{{INTRODUCTION}}

## 2. System Requirements
{{SYSTEM_REQUIREMENTS}}

## 3. Technical Architecture
{{TECHNICAL_ARCHITECTURE}}

## 4. Component Specifications
{{COMPONENT_SPECIFICATIONS}}

## 5. Data Specifications
{{DATA_SPECIFICATIONS}}

## 6. Interface Specifications
{{INTERFACE_SPECIFICATIONS}}

## 7. Security Specifications
{{SECURITY_SPECIFICATIONS}}

## 8. Performance Specifications
{{PERFORMANCE_SPECIFICATIONS}}

## 9. Testing Specifications
{{TESTING_SPECIFICATIONS}}

## 10. Deployment Specifications
{{DEPLOYMENT_SPECIFICATIONS}}`,

			api_spec: `# {{PROJECT_NAME}} - API Specification

## 1. API Overview
{{API_OVERVIEW}}

## 2. Authentication
{{AUTHENTICATION}}

## 3. Endpoints
{{ENDPOINTS}}

## 4. Data Models
{{DATA_MODELS}}

## 5. Error Handling
{{ERROR_HANDLING}}

## 6. Rate Limiting
{{RATE_LIMITING}}

## 7. Versioning
{{VERSIONING}}

## 8. Examples
{{EXAMPLES}}`
		};

		return templates[specType] || templates.technical_spec;
	}

	private populateTemplate(template: string, args: IDesignSpecArgs): string {
		let content = template;
		
		// Replace placeholders with actual content
		content = content.replace(/\{\{PROJECT_NAME\}\}/g, args.project_name);
		content = content.replace(/\{\{REQUIREMENTS\}\}/g, args.requirements);
		
		// Generate content based on specification type
		content = this.generateSectionContent(content, args);
		
		return content;
	}

	private generateSectionContent(template: string, args: IDesignSpecArgs): string {
		// This would be enhanced with actual AI-generated content
		// For now, providing structured placeholders
		
		const sectionContent = {
			'EXECUTIVE_SUMMARY': this.generateExecutiveSummary(args),
			'PURPOSE_AND_SCOPE': this.generatePurposeAndScope(args),
			'SYSTEM_CONTEXT': this.generateSystemContext(args),
			'KEY_FEATURES': this.generateKeyFeatures(args),
			'HIGH_LEVEL_ARCHITECTURE': this.generateHighLevelArchitecture(args),
			'TECHNOLOGY_STACK': this.generateTechnologyStack(args),
			'IMPLEMENTATION_PLAN': this.generateImplementationPlan(args),
			'RISK_ASSESSMENT': this.generateRiskAssessmentContent(args)
		};

		let content = template;
		for (const [placeholder, value] of Object.entries(sectionContent)) {
			content = content.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), value);
		}

		return content;
	}

	private generateExecutiveSummary(args: IDesignSpecArgs): string {
		return `This document provides a comprehensive ${args.spec_type.replace('_', ' ')} for ${args.project_name}. The system is designed to ${args.requirements.substring(0, 200)}... with focus on scalability, security, and maintainability.`;
	}

	private generatePurposeAndScope(args: IDesignSpecArgs): string {
		return `**Purpose**: ${args.requirements}\n\n**Scope**: This specification covers the complete system design including architecture, implementation details, and deployment requirements.\n\n**Stakeholders**: ${args.stakeholders?.join(', ') || 'Development team, Product management, Operations'}`;
	}

	private generateSystemContext(args: IDesignSpecArgs): string {
		return `The system operates within the following context:\n- Technology constraints: ${args.constraints?.join(', ') || 'Standard enterprise constraints'}\n- Integration requirements: External APIs, databases, third-party services\n- Deployment environment: ${args.technology_stack?.includes('cloud') ? 'Cloud-native' : 'On-premise/hybrid'}`;
	}

	private generateKeyFeatures(args: IDesignSpecArgs): string {
		// Extract key features from requirements
		const features = this.extractFeaturesFromRequirements(args.requirements);
		return features.map(feature => `- ${feature}`).join('\n');
	}

	private generateHighLevelArchitecture(args: IDesignSpecArgs): string {
		return `The system follows a ${this.inferArchitecturePattern(args)} architecture pattern with the following key components:\n\n- **Presentation Layer**: User interface and API endpoints\n- **Business Logic Layer**: Core business logic and processing\n- **Data Access Layer**: Database and external service integration\n- **Infrastructure Layer**: Deployment, monitoring, and operations`;
	}

	private generateTechnologyStack(args: IDesignSpecArgs): string {
		if (args.technology_stack && args.technology_stack.length > 0) {
			return args.technology_stack.map(tech => `- ${tech}`).join('\n');
		}
		
		return `**Recommended Technology Stack:**\n- Backend: Node.js/Python/Java (based on requirements)\n- Database: PostgreSQL/MongoDB (based on data patterns)\n- Caching: Redis\n- Message Queue: Kafka/RabbitMQ\n- Deployment: Docker + Kubernetes\n- Monitoring: Prometheus + Grafana`;
	}

	private generateImplementationPlan(args: IDesignSpecArgs): string {
		return `**Phase 1**: Core system development (4-6 weeks)\n**Phase 2**: Integration and testing (2-3 weeks)\n**Phase 3**: Deployment and monitoring (1-2 weeks)\n**Phase 4**: Optimization and scaling (ongoing)`;
	}

	private generateRiskAssessmentContent(args: IDesignSpecArgs): string {
		return `**Technical Risks:**\n- Complexity of integration requirements\n- Performance and scalability challenges\n- Technology adoption and learning curve\n\n**Mitigation Strategies:**\n- Prototype critical components early\n- Implement comprehensive testing strategy\n- Plan for iterative development and feedback`;
	}

	private generateImplementationGuide(args: IDesignSpecArgs): string {
		return `# ${args.project_name} - Implementation Guide

## Development Setup
1. Clone repository and install dependencies
2. Configure development environment
3. Set up local database and services
4. Run initial tests to verify setup

## Implementation Order
1. Set up project structure and configuration
2. Implement core data models and database schema
3. Create API endpoints and business logic
4. Implement user interface components
5. Add authentication and security features
6. Implement testing and quality assurance
7. Set up deployment and monitoring

## Quality Gates
- Code review for all changes
- Automated testing with >90% coverage
- Security scanning and vulnerability assessment
- Performance testing and optimization
- Documentation updates and reviews

## Deployment Process
1. Build and package application
2. Run comprehensive test suite
3. Deploy to staging environment
4. Perform user acceptance testing
5. Deploy to production with monitoring
6. Monitor metrics and performance`;
	}

	private generateAcceptanceCriteria(args: IDesignSpecArgs): string[] {
		return [
			'All functional requirements implemented and tested',
			'Performance requirements met under expected load',
			'Security requirements validated through testing',
			'Documentation complete and up-to-date',
			'Deployment process automated and verified',
			'Monitoring and alerting configured and tested'
		];
	}

	private generateRiskAssessment(args: IDesignSpecArgs): string[] {
		return [
			'Technical complexity may exceed initial estimates',
			'Integration challenges with external systems',
			'Performance bottlenecks under high load',
			'Security vulnerabilities in implementation',
			'Resource constraints and timeline pressures',
			'Technology changes during development'
		];
	}

	private generateRecommendations(args: IDesignSpecArgs): string[] {
		return [
			'Implement iterative development with regular stakeholder feedback',
			'Use proven design patterns and established frameworks',
			'Prioritize security and performance from the beginning',
			'Implement comprehensive monitoring and logging',
			'Plan for scalability and future growth',
			'Maintain comprehensive documentation throughout development'
		];
	}

	private generateDiagramDescriptions(args: IDesignSpecArgs): string[] {
		return [
			'High-level system architecture diagram',
			'Component interaction diagram',
			'Data flow diagram',
			'Deployment architecture diagram',
			'Security architecture diagram'
		];
	}

	private extractFeaturesFromRequirements(requirements: string): string[] {
		// Simple feature extraction - would be enhanced with NLP
		const features = [];
		const sentences = requirements.split(/[.!?]+/);
		
		for (const sentence of sentences) {
			if (sentence.includes('should') || sentence.includes('must') || sentence.includes('will')) {
				features.push(sentence.trim());
			}
		}
		
		return features.slice(0, 10); // Limit to top 10 features
	}

	private inferArchitecturePattern(args: IDesignSpecArgs): string {
		const requirements = args.requirements.toLowerCase();
		
		if (requirements.includes('microservice')) return 'microservices';
		if (requirements.includes('serverless')) return 'serverless';
		if (requirements.includes('event')) return 'event-driven';
		if (requirements.includes('api')) return 'API-first';
		
		return 'layered';
	}

	private generateFileName(args: IDesignSpecArgs): string {
		const timestamp = new Date().toISOString().split('T')[0];
		const extension = args.output_format === 'markdown' ? 'md' : args.output_format;
		return `${args.project_name}_${args.spec_type}_${timestamp}.${extension}`;
	}
}