/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

interface ICompletionArgs {
	file_path: string;
	cursor_position: { line: number; character: number };
	context_lines?: number;
	completion_type: 'code' | 'comment' | 'documentation' | 'test' | 'import';
	language: string;
	user_intent?: string;
}

interface ICompletionResult {
	completions: ICodeCompletion[];
	context_analysis: IContextAnalysis;
	confidence: number;
}

interface ICodeCompletion {
	text: string;
	type: 'snippet' | 'function' | 'class' | 'variable' | 'import' | 'comment';
	confidence: number;
	explanation: string;
	insertText: string;
	additionalEdits?: IAdditionalEdit[];
}

interface IAdditionalEdit {
	range: { start: number; end: number };
	newText: string;
	description: string;
}

interface IContextAnalysis {
	currentScope: string;
	availableVariables: string[];
	importedModules: string[];
	functionSignature?: string;
	classContext?: string;
	nearbyPatterns: string[];
}

export class IntelligentCompletionTool implements IAgentTool {
	readonly name = 'completion.intelligent';
	readonly description = 'Provides intelligent code completions with context awareness, pattern recognition, and best practice suggestions.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			file_path: {
				type: 'string',
				description: 'Path to the file where completion is needed',
				required: true
			},
			cursor_position: {
				type: 'object',
				properties: {
					line: { type: 'number' },
					character: { type: 'number' }
				},
				description: 'Current cursor position in the file',
				required: true
			},
			context_lines: {
				type: 'number',
				description: 'Number of context lines to analyze around cursor',
				default: 10
			},
			completion_type: {
				type: 'string',
				description: 'Type of completion needed',
				enum: ['code', 'comment', 'documentation', 'test', 'import'],
				required: true
			},
			language: {
				type: 'string',
				description: 'Programming language of the file',
				required: true
			},
			user_intent: {
				type: 'string',
				description: 'Optional description of what the user is trying to accomplish'
			}
		},
		required: ['file_path', 'cursor_position', 'completion_type', 'language']
	};

	async execute(args: ICompletionArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			this.logService.info(`[IntelligentCompletionTool] Generating ${args.completion_type} completion for ${args.file_path}`);

			const filePath = URI.joinPath(context.projectRoot!, args.file_path);
			const fileContent = await this.fileService.readFile(filePath);
			const code = fileContent.value.toString();
			const lines = code.split('\n');

			// Analyze context around cursor
			const contextAnalysis = await this.analyzeContext(lines, args.cursor_position, args.language);
			
			// Generate intelligent completions
			const completions = await this.generateCompletions(args, contextAnalysis, lines);

			const result: ICompletionResult = {
				completions,
				context_analysis: contextAnalysis,
				confidence: this.calculateOverallConfidence(completions)
			};

			return { result };

		} catch (error) {
			this.logService.error('[IntelligentCompletionTool] Completion generation failed:', error);
			return { result: null, isError: true };
		}
	}

	private async analyzeContext(lines: string[], position: { line: number; character: number }, language: string): Promise<IContextAnalysis> {
		const currentLine = lines[position.line] || '';
		const beforeCursor = currentLine.substring(0, position.character);
		const afterCursor = currentLine.substring(position.character);

		// Analyze scope and context
		const analysis: IContextAnalysis = {
			currentScope: this.determineCurrentScope(lines, position.line),
			availableVariables: this.extractAvailableVariables(lines, position.line),
			importedModules: this.extractImports(lines),
			nearbyPatterns: this.detectNearbyPatterns(lines, position.line)
		};

		// Analyze function context
		const functionMatch = this.findContainingFunction(lines, position.line);
		if (functionMatch) {
			analysis.functionSignature = functionMatch;
		}

		// Analyze class context
		const classMatch = this.findContainingClass(lines, position.line);
		if (classMatch) {
			analysis.classContext = classMatch;
		}

		return analysis;
	}

	private async generateCompletions(args: ICompletionArgs, context: IContextAnalysis, lines: string[]): Promise<ICodeCompletion[]> {
		const completions: ICodeCompletion[] = [];

		switch (args.completion_type) {
			case 'code':
				completions.push(...await this.generateCodeCompletions(args, context, lines));
				break;
			case 'comment':
				completions.push(...await this.generateCommentCompletions(args, context, lines));
				break;
			case 'documentation':
				completions.push(...await this.generateDocumentationCompletions(args, context, lines));
				break;
			case 'test':
				completions.push(...await this.generateTestCompletions(args, context, lines));
				break;
			case 'import':
				completions.push(...await this.generateImportCompletions(args, context, lines));
				break;
		}

		// Sort by confidence
		return completions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
	}

	private async generateCodeCompletions(args: ICompletionArgs, context: IContextAnalysis, lines: string[]): Promise<ICodeCompletion[]> {
		const completions: ICodeCompletion[] = [];
		const currentLine = lines[args.cursor_position.line] || '';

		// Function completion
		if (currentLine.includes('function ') || currentLine.includes('const ') && currentLine.includes('=')) {
			completions.push({
				text: 'Complete function implementation',
				type: 'function',
				confidence: 0.8,
				explanation: 'Generate function body with error handling and return statement',
				insertText: this.generateFunctionBody(context, args.language),
				additionalEdits: []
			});
		}

		// Variable assignment
		if (currentLine.includes('const ') || currentLine.includes('let ') || currentLine.includes('var ')) {
			completions.push({
				text: 'Smart variable initialization',
				type: 'variable',
				confidence: 0.7,
				explanation: 'Initialize variable with appropriate default value',
				insertText: this.generateVariableInitialization(context, args.language),
				additionalEdits: []
			});
		}

		// Class method completion
		if (context.classContext && (currentLine.includes('public ') || currentLine.includes('private ') || currentLine.includes('async '))) {
			completions.push({
				text: 'Complete class method',
				type: 'function',
				confidence: 0.85,
				explanation: 'Generate method implementation following class patterns',
				insertText: this.generateMethodBody(context, args.language),
				additionalEdits: []
			});
		}

		// Error handling completion
		if (currentLine.includes('try') || currentLine.includes('catch')) {
			completions.push({
				text: 'Complete error handling',
				type: 'snippet',
				confidence: 0.9,
				explanation: 'Add comprehensive error handling with logging',
				insertText: this.generateErrorHandling(args.language),
				additionalEdits: []
			});
		}

		return completions;
	}

	private async generateCommentCompletions(args: ICompletionArgs, context: IContextAnalysis, lines: string[]): Promise<ICodeCompletion[]> {
		const completions: ICodeCompletion[] = [];

		if (context.functionSignature) {
			completions.push({
				text: 'Generate JSDoc comment',
				type: 'comment',
				confidence: 0.9,
				explanation: 'Create comprehensive JSDoc documentation',
				insertText: this.generateJSDocComment(context.functionSignature),
				additionalEdits: []
			});
		}

		return completions;
	}

	private async generateDocumentationCompletions(args: ICompletionArgs, context: IContextAnalysis, lines: string[]): Promise<ICodeCompletion[]> {
		return [{
			text: 'Generate comprehensive documentation',
			type: 'comment',
			confidence: 0.8,
			explanation: 'Create detailed documentation for the current code section',
			insertText: '// TODO: Add comprehensive documentation',
			additionalEdits: []
		}];
	}

	private async generateTestCompletions(args: ICompletionArgs, context: IContextAnalysis, lines: string[]): Promise<ICodeCompletion[]> {
		return [{
			text: 'Generate unit tests',
			type: 'snippet',
			confidence: 0.85,
			explanation: 'Create comprehensive unit tests for the current function/class',
			insertText: this.generateTestSuite(context, args.language),
			additionalEdits: []
		}];
	}

	private async generateImportCompletions(args: ICompletionArgs, context: IContextAnalysis, lines: string[]): Promise<ICodeCompletion[]> {
		const completions: ICodeCompletion[] = [];

		// Suggest common imports based on context
		const commonImports = this.getCommonImports(args.language, context);
		
		for (const imp of commonImports) {
			completions.push({
				text: `Import ${imp.module}`,
				type: 'import',
				confidence: imp.confidence,
				explanation: imp.explanation,
				insertText: imp.importStatement,
				additionalEdits: []
			});
		}

		return completions;
	}

	// Helper methods for code generation
	private generateFunctionBody(context: IContextAnalysis, language: string): string {
		switch (language) {
			case 'typescript':
			case 'javascript':
				return `{\n\ttry {\n\t\t// Implementation\n\t\treturn result;\n\t} catch (error) {\n\t\tthrow new Error(\`Operation failed: \${error}\`);\n\t}\n}`;
			case 'python':
				return `:\n\ttry:\n\t\t# Implementation\n\t\treturn result\n\texcept Exception as e:\n\t\traise Exception(f"Operation failed: {e}")`;
			default:
				return '{\n\t// Implementation\n}';
		}
	}

	private generateVariableInitialization(context: IContextAnalysis, language: string): string {
		return language === 'typescript' ? ' = null;' : ' = None' + (language === 'python' ? '' : ';');
	}

	private generateMethodBody(context: IContextAnalysis, language: string): string {
		return this.generateFunctionBody(context, language);
	}

	private generateErrorHandling(language: string): string {
		switch (language) {
			case 'typescript':
			case 'javascript':
				return ` {\n\t\t// Implementation\n\t} catch (error) {\n\t\tconsole.error('Error:', error);\n\t\tthrow error;\n\t}`;
			case 'python':
				return `:\n\t\t# Implementation\n\texcept Exception as e:\n\t\tlogging.error(f"Error: {e}")\n\t\traise`;
			default:
				return ' {\n\t\t// Error handling\n\t}';
		}
	}

	private generateJSDocComment(functionSignature: string): string {
		return `/**\n * Description of the function\n * @param {type} param - Parameter description\n * @returns {type} Return value description\n * @throws {Error} When operation fails\n */\n`;
	}

	private generateTestSuite(context: IContextAnalysis, language: string): string {
		switch (language) {
			case 'typescript':
			case 'javascript':
				return `describe('${context.currentScope}', () => {\n\tit('should work correctly', () => {\n\t\t// Test implementation\n\t\texpect(true).toBe(true);\n\t});\n});`;
			case 'python':
				return `def test_${context.currentScope.toLowerCase()}():\n\t"""Test the ${context.currentScope} functionality."""\n\tassert True  # Test implementation`;
			default:
				return '// Test implementation';
		}
	}

	private getCommonImports(language: string, context: IContextAnalysis): Array<{ module: string; confidence: number; explanation: string; importStatement: string }> {
		const imports: Array<{ module: string; confidence: number; explanation: string; importStatement: string }> = [];

		if (language === 'typescript' || language === 'javascript') {
			if (!context.importedModules.includes('react') && context.nearbyPatterns.some(p => p.includes('component'))) {
				imports.push({
					module: 'react',
					confidence: 0.8,
					explanation: 'React import detected based on component patterns',
					importStatement: "import React from 'react';"
				});
			}

			if (!context.importedModules.includes('lodash') && context.nearbyPatterns.some(p => p.includes('array') || p.includes('object'))) {
				imports.push({
					module: 'lodash',
					confidence: 0.6,
					explanation: 'Lodash utilities for array/object manipulation',
					importStatement: "import _ from 'lodash';"
				});
			}
		}

		return imports;
	}

	// Context analysis helper methods
	private determineCurrentScope(lines: string[], lineNumber: number): string {
		for (let i = lineNumber; i >= 0; i--) {
			const line = lines[i];
			
			// Check for function
			const funcMatch = line.match(/(?:function\s+|const\s+|let\s+)(\w+)/);
			if (funcMatch) return funcMatch[1];
			
			// Check for class
			const classMatch = line.match(/class\s+(\w+)/);
			if (classMatch) return classMatch[1];
		}
		
		return 'global';
	}

	private extractAvailableVariables(lines: string[], lineNumber: number): string[] {
		const variables: string[] = [];
		
		for (let i = 0; i <= lineNumber; i++) {
			const line = lines[i];
			
			// Extract variable declarations
			const varMatches = line.matchAll(/(?:const|let|var)\s+(\w+)/g);
			for (const match of varMatches) {
				variables.push(match[1]);
			}
			
			// Extract function parameters
			const paramMatches = line.matchAll(/function\s+\w+\s*\(([^)]*)\)/g);
			for (const match of paramMatches) {
				const params = match[1].split(',').map(p => p.trim().split(':')[0].trim());
				variables.push(...params.filter(p => p.length > 0));
			}
		}
		
		return [...new Set(variables)];
	}

	private extractImports(lines: string[]): string[] {
		const imports: string[] = [];
		
		for (const line of lines) {
			const importMatch = line.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/);
			if (importMatch) {
				imports.push(importMatch[1]);
			}
		}
		
		return imports;
	}

	private detectNearbyPatterns(lines: string[], lineNumber: number): string[] {
		const patterns: string[] = [];
		const contextWindow = 5;
		
		const start = Math.max(0, lineNumber - contextWindow);
		const end = Math.min(lines.length, lineNumber + contextWindow);
		
		for (let i = start; i < end; i++) {
			const line = lines[i];
			
			if (line.includes('useState') || line.includes('useEffect')) {
				patterns.push('react_hooks');
			}
			if (line.includes('async') || line.includes('await')) {
				patterns.push('async_programming');
			}
			if (line.includes('class ') || line.includes('extends ')) {
				patterns.push('object_oriented');
			}
			if (line.includes('interface ') || line.includes('type ')) {
				patterns.push('type_definitions');
			}
		}
		
		return [...new Set(patterns)];
	}

	private findContainingFunction(lines: string[], lineNumber: number): string | undefined {
		for (let i = lineNumber; i >= 0; i--) {
			const line = lines[i];
			const funcMatch = line.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*:\s*(?:async\s+)?function)/);
			if (funcMatch) {
				return funcMatch[1] || funcMatch[2] || funcMatch[3];
			}
		}
		return undefined;
	}

	private findContainingClass(lines: string[], lineNumber: number): string | undefined {
		for (let i = lineNumber; i >= 0; i--) {
			const line = lines[i];
			const classMatch = line.match(/class\s+(\w+)/);
			if (classMatch) {
				return classMatch[1];
			}
		}
		return undefined;
	}

	private calculateOverallConfidence(completions: ICodeCompletion[]): number {
		if (completions.length === 0) return 0;
		
		const avgConfidence = completions.reduce((sum, comp) => sum + comp.confidence, 0) / completions.length;
		return Math.min(0.95, avgConfidence);
	}
}