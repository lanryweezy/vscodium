/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

interface IDebugArgs {
	error_message: string;
	file_path?: string;
	stack_trace?: string;
	context?: any;
	debug_level: 'basic' | 'detailed' | 'comprehensive';
}

interface IDebugResult {
	diagnosis: string;
	suggested_fixes: IDebugFix[];
	confidence: number;
	root_cause: string;
	prevention_tips: string[];
}

interface IDebugFix {
	description: string;
	code_changes: ICodeChange[];
	priority: 'low' | 'medium' | 'high' | 'critical';
	estimated_effort: string;
}

interface ICodeChange {
	file_path: string;
	line_number?: number;
	old_code?: string;
	new_code: string;
	explanation: string;
}

export class IntelligentDebugTool implements IAgentTool {
	readonly name = 'debug.intelligent';
	readonly description = 'Analyzes errors and provides intelligent debugging suggestions with automated fixes.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			error_message: {
				type: 'string',
				description: 'The error message or exception details',
				required: true
			},
			file_path: {
				type: 'string',
				description: 'Path to the file where the error occurred'
			},
			stack_trace: {
				type: 'string',
				description: 'Full stack trace if available'
			},
			context: {
				type: 'object',
				description: 'Additional context about the error (variables, state, etc.)'
			},
			debug_level: {
				type: 'string',
				description: 'Level of debugging analysis to perform',
				enum: ['basic', 'detailed', 'comprehensive'],
				default: 'detailed'
			}
		},
		required: ['error_message']
	};

	async execute(args: IDebugArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		try {
			this.logService.info(`[IntelligentDebugTool] Analyzing error: ${args.error_message}`);

			const debugResult = await this.analyzeError(args, context);
			
			// Apply automatic fixes if confidence is high
			if (debugResult.confidence > 0.8 && debugResult.suggested_fixes.length > 0) {
				const criticalFixes = debugResult.suggested_fixes.filter(fix => fix.priority === 'critical');
				if (criticalFixes.length > 0) {
					await this.applyFixes(criticalFixes, context);
				}
			}

			return {
				result: debugResult
			};

		} catch (error) {
			this.logService.error('[IntelligentDebugTool] Debug analysis failed:', error);
			return {
				result: null,
				isError: true
			};
		}
	}

	private async analyzeError(args: IDebugArgs, context: IAgentToolExecuteArg): Promise<IDebugResult> {
		const errorPatterns = this.getKnownErrorPatterns();
		let diagnosis = 'Unknown error';
		let confidence = 0.1;
		let rootCause = 'Unable to determine root cause';
		const suggestedFixes: IDebugFix[] = [];
		const preventionTips: string[] = [];

		// Enhanced pattern matching with fuzzy matching
		let bestMatch: any = null;
		let bestScore = 0;

		for (const pattern of errorPatterns) {
			const score = this.calculateErrorSimilarity(args.error_message, pattern);
			if (score > bestScore && score > 0.3) {
				bestMatch = pattern;
				bestScore = score;
			}
		}

		if (bestMatch) {
			diagnosis = bestMatch.diagnosis;
			confidence = bestScore;
			rootCause = bestMatch.rootCause;
			suggestedFixes.push(...bestMatch.fixes);
			preventionTips.push(...bestMatch.preventionTips);
		}

		// Enhanced analysis for specific files
		if (args.file_path && context.projectRoot) {
			const fileAnalysis = await this.analyzeErrorInFile(args, context);
			if (fileAnalysis) {
				confidence = Math.max(confidence, fileAnalysis.confidence);
				suggestedFixes.push(...fileAnalysis.fixes);
			}
		}

		// Stack trace analysis
		if (args.stack_trace) {
			const stackAnalysis = this.analyzeStackTrace(args.stack_trace);
			suggestedFixes.push(...stackAnalysis.fixes);
			confidence = Math.max(confidence, stackAnalysis.confidence);
		}

		// Add contextual analysis if file is provided
		if (args.file_path && context.projectRoot) {
			const contextualAnalysis = await this.performContextualAnalysis(args, context);
			if (contextualAnalysis.confidence > confidence) {
				confidence = contextualAnalysis.confidence;
				suggestedFixes.unshift(...contextualAnalysis.fixes);
			}
		}

		return {
			diagnosis,
			suggested_fixes: suggestedFixes,
			confidence: Math.min(confidence, 0.95), // Cap confidence to remain realistic
			root_cause: rootCause,
			prevention_tips: preventionTips
		};
	}

	private calculateErrorSimilarity(errorMessage: string, pattern: any): number {
		// Simple similarity calculation using common words and patterns
		const errorWords = errorMessage.toLowerCase().split(/\s+/);
		const patternWords = pattern.keywords || [];
		
		let matches = 0;
		for (const word of errorWords) {
			if (patternWords.some((keyword: string) => word.includes(keyword.toLowerCase()))) {
				matches++;
			}
		}
		
		return matches / Math.max(errorWords.length, patternWords.length);
	}

	private async performContextualAnalysis(args: IDebugArgs, context: IAgentToolExecuteArg): Promise<{confidence: number, fixes: IDebugFix[]}> {
		try {
			const filePath = URI.joinPath(context.projectRoot!, args.file_path!);
			const fileContent = await this.fileService.readFile(filePath);
			const content = fileContent.value.toString();
			
			// Analyze file for common issues
			const fixes: IDebugFix[] = [];
			let confidence = 0.5;

			// Check for missing imports
			if (args.error_message.includes('is not defined') || args.error_message.includes('Cannot find name')) {
				const missingSymbol = this.extractMissingSymbol(args.error_message);
				if (missingSymbol) {
					const importSuggestion = this.suggestImport(missingSymbol, content);
					if (importSuggestion) {
						fixes.push({
							description: `Add missing import for ${missingSymbol}`,
							code_changes: [{
								file_path: args.file_path!,
								line_number: 1,
								new_code: importSuggestion,
								explanation: `Import statement for ${missingSymbol}`
							}],
							priority: 'high',
							estimated_effort: '1 minute'
						});
						confidence = 0.8;
					}
				}
			}

			return { confidence, fixes };
		} catch (error) {
			return { confidence: 0, fixes: [] };
		}
	}

	private extractMissingSymbol(errorMessage: string): string | null {
		const patterns = [
			/'([^']+)' is not defined/,
			/Cannot find name '([^']+)'/,
			/ReferenceError: ([^\s]+) is not defined/
		];
		
		for (const pattern of patterns) {
			const match = errorMessage.match(pattern);
			if (match) {
				return match[1];
			}
		}
		return null;
	}

	private suggestImport(symbol: string, fileContent: string): string | null {
		// Common import patterns for popular libraries
		const importSuggestions: Record<string, string> = {
			'React': "import React from 'react';",
			'useState': "import { useState } from 'react';",
			'useEffect': "import { useEffect } from 'react';",
			'fs': "import * as fs from 'fs';",
			'path': "import * as path from 'path';",
			'express': "import express from 'express';",
			'axios': "import axios from 'axios';"
		};

		return importSuggestions[symbol] || null;
	}

	private getKnownErrorPatterns() {
		return [
			{
				regex: /Cannot read property '(\w+)' of undefined/,
				diagnosis: 'Null pointer exception - attempting to access property of undefined object',
				confidence: 0.9,
				rootCause: 'Object is undefined when property access is attempted',
				fixes: [{
					description: 'Add null/undefined checks before property access',
					code_changes: [{
						file_path: '',
						new_code: 'if (obj && obj.property) { /* use obj.property */ }',
						explanation: 'Add defensive programming checks'
					}],
					priority: 'high' as const,
					estimated_effort: '5 minutes'
				}],
				preventionTips: [
					'Always validate objects before accessing properties',
					'Use optional chaining (?.) operator',
					'Initialize objects with default values'
				]
			},
			{
				regex: /Module not found/,
				diagnosis: 'Missing dependency or incorrect import path',
				confidence: 0.95,
				rootCause: 'Required module is not installed or path is incorrect',
				fixes: [{
					description: 'Install missing dependency or fix import path',
					code_changes: [{
						file_path: '',
						new_code: 'npm install <missing-package>',
						explanation: 'Install the missing dependency'
					}],
					priority: 'critical' as const,
					estimated_effort: '2 minutes'
				}],
				preventionTips: [
					'Verify all dependencies are listed in package.json',
					'Use absolute imports when possible',
					'Check for typos in import statements'
				]
			},
			{
				regex: /TypeError: .+ is not a function/,
				diagnosis: 'Attempting to call a non-function value',
				confidence: 0.85,
				rootCause: 'Variable does not contain a function or method does not exist',
				fixes: [{
					description: 'Verify function exists and is properly imported',
					code_changes: [{
						file_path: '',
						new_code: 'if (typeof func === "function") { func(); }',
						explanation: 'Add type checking before function calls'
					}],
					priority: 'high' as const,
					estimated_effort: '10 minutes'
				}],
				preventionTips: [
					'Use TypeScript for better type checking',
					'Validate function existence before calling',
					'Check API documentation for correct method names'
				]
			}
		];
	}

	private async analyzeErrorInFile(args: IDebugArgs, context: IAgentToolExecuteArg): Promise<{ confidence: number; fixes: IDebugFix[] } | null> {
		if (!args.file_path || !context.projectRoot) return null;

		try {
			const filePath = URI.joinPath(context.projectRoot, args.file_path);
			const content = await this.fileService.readFile(filePath);
			const code = content.value.toString();

			// Analyze the code for potential issues
			const fixes: IDebugFix[] = [];
			let confidence = 0.5;

			// Look for common patterns that might cause the error
			if (args.error_message.includes('undefined')) {
				const undefinedChecks = this.findMissingUndefinedChecks(code);
				if (undefinedChecks.length > 0) {
					fixes.push({
						description: 'Add undefined checks to prevent null pointer exceptions',
						code_changes: undefinedChecks,
						priority: 'high',
						estimated_effort: '15 minutes'
					});
					confidence = 0.8;
				}
			}

			return { confidence, fixes };

		} catch (error) {
			this.logService.warn('[IntelligentDebugTool] File analysis failed:', error);
			return null;
		}
	}

	private analyzeStackTrace(stackTrace: string): { confidence: number; fixes: IDebugFix[] } {
		const fixes: IDebugFix[] = [];
		let confidence = 0.3;

		// Extract file paths and line numbers from stack trace
		const stackLines = stackTrace.split('\n');
		const relevantLines = stackLines.filter(line => 
			line.includes('.ts:') || line.includes('.js:') || line.includes('.py:')
		);

		if (relevantLines.length > 0) {
			confidence = 0.6;
			fixes.push({
				description: 'Investigate the error at the identified stack trace locations',
				code_changes: relevantLines.map(line => ({
					file_path: this.extractFilePathFromStackLine(line),
					new_code: '// Add error handling here',
					explanation: `Check this location: ${line.trim()}`
				})),
				priority: 'medium',
				estimated_effort: '20 minutes'
			});
		}

		return { confidence, fixes };
	}

	private findMissingUndefinedChecks(code: string): ICodeChange[] {
		const changes: ICodeChange[] = [];
		const lines = code.split('\n');

		lines.forEach((line, index) => {
			// Look for property access without null checks
			const propertyAccess = line.match(/(\w+)\.(\w+)/g);
			if (propertyAccess) {
				for (const access of propertyAccess) {
					const [obj, prop] = access.split('.');
					if (!line.includes(`${obj} &&`) && !line.includes(`${obj}?.`)) {
						changes.push({
							file_path: '',
							line_number: index + 1,
							old_code: line.trim(),
							new_code: line.replace(access, `${obj}?.${prop}`),
							explanation: `Add optional chaining to prevent undefined access`
						});
					}
				}
			}
		});

		return changes.slice(0, 5); // Limit to 5 suggestions
	}

	private extractFilePathFromStackLine(stackLine: string): string {
		const match = stackLine.match(/at .+\((.+):(\d+):(\d+)\)/);
		return match ? match[1] : '';
	}

	private async applyFixes(fixes: IDebugFix[], context: IAgentToolExecuteArg): Promise<void> {
		for (const fix of fixes) {
			try {
				for (const change of fix.code_changes) {
					if (change.file_path && context.projectRoot) {
						const filePath = URI.joinPath(context.projectRoot, change.file_path);
						
						if (change.old_code && change.new_code) {
							// Apply the code change
							const content = await this.fileService.readFile(filePath);
							const updatedCode = content.value.toString().replace(change.old_code, change.new_code);
							await this.fileService.writeFile(filePath, VSBuffer.fromString(updatedCode));
							
							this.logService.info(`[IntelligentDebugTool] Applied fix to ${change.file_path}: ${change.explanation}`);
						}
					}
				}
			} catch (error) {
				this.logService.error(`[IntelligentDebugTool] Failed to apply fix:`, error);
			}
		}
	}
}