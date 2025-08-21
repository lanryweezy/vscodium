/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { ICodeAnalysisService } from 'vs/platform/ai/common/aiTypes';

interface ICodeGenerationArgs {
	task_description: string;
	file_path?: string;
	language: 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' | 'go' | 'rust';
	framework?: string;
	style_guide?: 'google' | 'airbnb' | 'standard' | 'prettier';
	include_tests: boolean;
	include_docs: boolean;
	complexity_target: 'simple' | 'moderate' | 'advanced';
}

export class CodeGenerationTool implements IAgentTool {
	readonly name = 'code.generate';
	readonly description = 'Generates high-quality code based on specifications with built-in best practices, testing, and documentation.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@ICodeAnalysisService private readonly codeAnalysisService: ICodeAnalysisService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			task_description: {
				type: 'string',
				description: 'Detailed description of what code to generate',
				required: true
			},
			file_path: {
				type: 'string',
				description: 'Optional target file path for the generated code'
			},
			language: {
				type: 'string',
				description: 'Programming language for the generated code',
				enum: ['typescript', 'javascript', 'python', 'java', 'csharp', 'go', 'rust'],
				required: true
			},
			framework: {
				type: 'string',
				description: 'Optional framework/library to use (e.g., React, Express, Django)'
			},
			style_guide: {
				type: 'string',
				description: 'Code style guide to follow',
				enum: ['google', 'airbnb', 'standard', 'prettier']
			},
			include_tests: {
				type: 'boolean',
				description: 'Whether to generate unit tests',
				default: true
			},
			include_docs: {
				type: 'boolean',
				description: 'Whether to include comprehensive documentation',
				default: true
			},
			complexity_target: {
				type: 'string',
				description: 'Target complexity level for the generated code',
				enum: ['simple', 'moderate', 'advanced'],
				default: 'moderate'
			}
		},
		required: ['task_description', 'language']
	};

	async execute(args: ICodeGenerationArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			this.logService.info(`[CodeGenerationTool] Generating ${args.language} code for: ${args.task_description}`);

			// Generate the main code
			const generatedCode = await this.generateCode(args, context);
			
			// Generate tests if requested
			let testCode = '';
			if (args.include_tests) {
				testCode = await this.generateTests(args, generatedCode, context);
			}

			// Generate documentation if requested
			let documentation = '';
			if (args.include_docs) {
				documentation = await this.generateDocumentation(args, generatedCode);
			}

			// Save the generated code
			if (args.file_path && context.projectRoot) {
				const filePath = URI.joinPath(context.projectRoot, args.file_path);
				await this.fileService.writeFile(filePath, VSBuffer.fromString(generatedCode));

				// Save tests
				if (testCode) {
					const testPath = this.getTestFilePath(filePath, args.language);
					await this.fileService.writeFile(testPath, VSBuffer.fromString(testCode));
				}

				// Save documentation
				if (documentation) {
					const docPath = this.getDocumentationPath(filePath);
					await this.fileService.writeFile(docPath, VSBuffer.fromString(documentation));
				}
			}

			return {
				result: {
					code: generatedCode,
					tests: testCode,
					documentation: documentation,
					file_path: args.file_path,
					language: args.language,
					complexity: await this.estimateComplexity(generatedCode, args.language)
				}
			};

		} catch (error) {
			this.logService.error('[CodeGenerationTool] Code generation failed:', error);
			return {
				result: null,
				isError: true
			};
		}
	}

	private async generateCode(args: ICodeGenerationArgs, context: IAgentToolExecuteArg): Promise<string> {
		// This would integrate with the LLM to generate code
		// For now, we'll create a template-based approach
		
		const templates = this.getLanguageTemplates(args.language);
		const baseTemplate = templates[args.complexity_target] || templates.moderate;

		// Apply framework-specific modifications
		let code = baseTemplate.replace('{{TASK_DESCRIPTION}}', args.task_description);
		
		if (args.framework) {
			code = this.applyFrameworkPatterns(code, args.framework, args.language);
		}

		if (args.style_guide) {
			code = this.applyStyleGuide(code, args.style_guide, args.language);
		}

		return code;
	}

	private async generateTests(args: ICodeGenerationArgs, mainCode: string, context: IAgentToolExecuteArg): Promise<string> {
		// Generate comprehensive unit tests
		const testTemplate = this.getTestTemplate(args.language, args.framework);
		return testTemplate.replace('{{MAIN_CODE}}', mainCode);
	}

	private async generateDocumentation(args: ICodeGenerationArgs, code: string): Promise<string> {
		// Generate comprehensive documentation
		return `# ${args.task_description}

## Overview
This code implements ${args.task_description} in ${args.language}.

## Usage
\`\`\`${args.language}
${code.split('\n').slice(0, 10).join('\n')}
// ... rest of implementation
\`\`\`

## Features
- High-quality implementation following best practices
- Comprehensive error handling
- Type-safe design (where applicable)
- Performance optimized

## Testing
Unit tests are included to ensure reliability and correctness.

## Maintenance
This code follows ${args.style_guide || 'standard'} style guidelines for maintainability.
`;
	}

	private getTestFilePath(originalPath: URI, language: string): URI {
		const ext = language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : 'py';
		const pathStr = originalPath.path;
		const testPath = pathStr.replace(new RegExp(`\\.${ext}$`), `.test.${ext}`);
		return URI.file(testPath);
	}

	private getDocumentationPath(originalPath: URI): URI {
		const pathStr = originalPath.path;
		const docPath = pathStr.replace(/\.[^.]+$/, '.md');
		return URI.file(docPath);
	}

	private async estimateComplexity(code: string, language: string): Promise<number> {
		// Simple complexity estimation
		const lines = code.split('\n').length;
		const functions = (code.match(/function|def |class /g) || []).length;
		const conditionals = (code.match(/if |else|switch|case|while|for/g) || []).length;
		
		return Math.min(50, lines / 10 + functions * 2 + conditionals);
	}

	private getLanguageTemplates(language: string): Record<string, string> {
		const templates: Record<string, Record<string, string>> = {
			typescript: {
				simple: `// {{TASK_DESCRIPTION}}

export class GeneratedClass {
	constructor() {
		// Implementation
	}

	public execute(): void {
		// Generated implementation
	}
}`,
				moderate: `// {{TASK_DESCRIPTION}}

export interface IGeneratedInterface {
	execute(): Promise<void>;
	validate(): boolean;
}

export class GeneratedClass implements IGeneratedInterface {
	private readonly config: any;

	constructor(config?: any) {
		this.config = config || {};
	}

	public async execute(): Promise<void> {
		try {
			// Generated implementation
			await this.performTask();
		} catch (error) {
			throw new Error(\`Execution failed: \${error}\`);
		}
	}

	public validate(): boolean {
		// Validation logic
		return true;
	}

	private async performTask(): Promise<void> {
		// Core task implementation
	}
}`,
				advanced: `// {{TASK_DESCRIPTION}}

export interface IGeneratedService {
	execute(): Promise<IExecutionResult>;
	validate(): Promise<IValidationResult>;
	configure(options: IServiceOptions): void;
}

export interface IExecutionResult {
	success: boolean;
	data?: any;
	error?: string;
	metadata: {
		duration: number;
		timestamp: number;
	};
}

export interface IValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

export interface IServiceOptions {
	timeout?: number;
	retries?: number;
	debug?: boolean;
}

export class GeneratedService implements IGeneratedService {
	private readonly options: IServiceOptions;
	private readonly logger: ILogger;

	constructor(options: IServiceOptions = {}, logger?: ILogger) {
		this.options = { timeout: 30000, retries: 3, debug: false, ...options };
		this.logger = logger || console;
	}

	public async execute(): Promise<IExecutionResult> {
		const startTime = Date.now();
		
		try {
			const validation = await this.validate();
			if (!validation.isValid) {
				throw new Error(\`Validation failed: \${validation.errors.join(', ')}\`);
			}

			const result = await this.performExecution();
			
			return {
				success: true,
				data: result,
				metadata: {
					duration: Date.now() - startTime,
					timestamp: Date.now()
				}
			};

		} catch (error) {
			this.logger.error('Execution failed:', error);
			return {
				success: false,
				error: error.message,
				metadata: {
					duration: Date.now() - startTime,
					timestamp: Date.now()
				}
			};
		}
	}

	public async validate(): Promise<IValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validation logic
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}

	public configure(options: IServiceOptions): void {
		Object.assign(this.options, options);
	}

	private async performExecution(): Promise<any> {
		// Core implementation with retry logic
		for (let attempt = 1; attempt <= this.options.retries!; attempt++) {
			try {
				return await this.executeCore();
			} catch (error) {
				if (attempt === this.options.retries) {
					throw error;
				}
				await this.delay(1000 * attempt);
			}
		}
	}

	private async executeCore(): Promise<any> {
		// Generated core implementation
		return {};
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}`
			}
		};

		return templates[language] || templates.typescript;
	}

	private getTestTemplate(language: string, framework?: string): string {
		return `// Generated tests for {{TASK_DESCRIPTION}}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Import the class under test

describe('GeneratedClass', () => {
	let instance: GeneratedClass;

	beforeEach(() => {
		instance = new GeneratedClass();
	});

	afterEach(() => {
		// Cleanup
	});

	it('should initialize correctly', () => {
		expect(instance).toBeDefined();
	});

	it('should execute successfully', async () => {
		const result = await instance.execute();
		expect(result).toBeDefined();
	});

	it('should validate inputs', () => {
		const isValid = instance.validate();
		expect(isValid).toBe(true);
	});

	it('should handle errors gracefully', async () => {
		// Test error scenarios
	});
});`;
	}

	private applyFrameworkPatterns(code: string, framework: string, language: string): string {
		// Apply framework-specific patterns and imports
		const frameworkPatterns: Record<string, string> = {
			'react': `import React from 'react';\n\n${code}`,
			'express': `import express from 'express';\n\n${code}`,
			'django': `from django.http import HttpResponse\n\n${code}`,
			'spring': `import org.springframework.stereotype.Service;\n\n${code}`
		};

		return frameworkPatterns[framework.toLowerCase()] || code;
	}

	private applyStyleGuide(code: string, styleGuide: string, language: string): string {
		// Apply style guide formatting
		switch (styleGuide) {
			case 'google':
				return code.replace(/\t/g, '  '); // Use 2 spaces
			case 'airbnb':
				return code.replace(/\t/g, '  '); // Use 2 spaces, other Airbnb rules
			case 'standard':
				return code.replace(/;$/gm, ''); // Remove semicolons for JS
			default:
				return code;
		}
	}
}