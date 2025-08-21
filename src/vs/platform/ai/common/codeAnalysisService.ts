/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICodeAnalysisService, ICodeAnalysis, ICodeSuggestion, ICodePattern, ICodeIssue } from 'vs/platform/ai/common/aiTypes';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const ICodeAnalysisServiceToken = createDecorator<ICodeAnalysisService>('codeAnalysisService');

export class CodeAnalysisService implements ICodeAnalysisService {
	_serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	async analyzeCode(filePath: URI): Promise<ICodeAnalysis> {
		try {
			const content = await this.fileService.readFile(filePath);
			const code = content.value.toString();
			const extension = filePath.path.split('.').pop()?.toLowerCase();

			const analysis: ICodeAnalysis = {
				complexity: this.calculateComplexity(code, extension),
				maintainability: this.calculateMaintainability(code, extension),
				testCoverage: await this.estimateTestCoverage(filePath),
				issues: this.detectIssues(code, extension),
				dependencies: this.extractDependencies(code, extension),
				exports: this.extractExports(code, extension)
			};

			this.logService.info(`[CodeAnalysisService] Analyzed ${filePath.path}: complexity=${analysis.complexity}, maintainability=${analysis.maintainability}`);
			return analysis;

		} catch (error) {
			this.logService.error(`[CodeAnalysisService] Failed to analyze ${filePath.path}:`, error);
			throw error;
		}
	}

	async suggestImprovements(filePath: URI): Promise<ICodeSuggestion[]> {
		const analysis = await this.analyzeCode(filePath);
		const suggestions: ICodeSuggestion[] = [];

		// High complexity suggestions
		if (analysis.complexity > 10) {
			suggestions.push({
				type: 'refactor',
				description: 'Consider breaking down complex functions into smaller, more manageable pieces',
				confidence: 0.8,
				impact: 'high'
			});
		}

		// Low maintainability suggestions
		if (analysis.maintainability < 0.6) {
			suggestions.push({
				type: 'enhance',
				description: 'Add documentation and improve code readability',
				confidence: 0.7,
				impact: 'medium'
			});
		}

		// Test coverage suggestions
		if (analysis.testCoverage < 0.7) {
			suggestions.push({
				type: 'enhance',
				description: 'Increase test coverage by adding unit tests',
				confidence: 0.9,
				impact: 'high'
			});
		}

		// Issue-based suggestions
		for (const issue of analysis.issues) {
			if (issue.severity >= 8) {
				suggestions.push({
					type: 'fix',
					description: `Fix critical issue: ${issue.message}`,
					confidence: 0.9,
					impact: 'high'
				});
			}
		}

		return suggestions;
	}

	async detectPatterns(workspaceUri: URI): Promise<ICodePattern[]> {
		const patterns: ICodePattern[] = [];
		
		try {
			// This would ideally traverse the workspace and detect common patterns
			// For now, we'll implement basic pattern detection
			patterns.push({
				name: 'Service Pattern',
				description: 'Classes that implement service interfaces',
				occurrences: 0,
				files: []
			});

			patterns.push({
				name: 'Factory Pattern',
				description: 'Factory methods and classes',
				occurrences: 0,
				files: []
			});

			patterns.push({
				name: 'Observer Pattern',
				description: 'Event-driven architecture components',
				occurrences: 0,
				files: []
			});

			return patterns;

		} catch (error) {
			this.logService.error('[CodeAnalysisService] Failed to detect patterns:', error);
			return patterns;
		}
	}

	private calculateComplexity(code: string, extension?: string): number {
		// Cyclomatic complexity calculation
		let complexity = 1; // Base complexity

		// Count decision points
		const decisionPatterns = [
			/\bif\b/g, /\belse\b/g, /\bwhile\b/g, /\bfor\b/g,
			/\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\btry\b/g,
			/\?\s*:/g, // ternary operators
			/&&/g, /\|\|/g // logical operators
		];

		for (const pattern of decisionPatterns) {
			const matches = code.match(pattern);
			if (matches) {
				complexity += matches.length;
			}
		}

		return Math.min(complexity, 50); // Cap at 50
	}

	private calculateMaintainability(code: string, extension?: string): number {
		let score = 1.0;

		// Penalize for long functions
		const functionMatches = code.match(/function\s+\w+|=>\s*{|{\s*$/gm);
		const avgFunctionLength = code.split('\n').length / (functionMatches?.length || 1);
		if (avgFunctionLength > 50) {
			score -= 0.2;
		}

		// Reward for comments
		const commentLines = code.match(/\/\/|\/\*|\*/g);
		const commentRatio = (commentLines?.length || 0) / code.split('\n').length;
		score += commentRatio * 0.3;

		// Penalize for deeply nested code
		const indentationLevels = code.split('\n').map(line => {
			const match = line.match(/^(\s*)/);
			return match ? match[1].length : 0;
		});
		const maxIndentation = Math.max(...indentationLevels);
		if (maxIndentation > 20) {
			score -= 0.1;
		}

		return Math.max(0, Math.min(1, score));
	}

	private async estimateTestCoverage(filePath: URI): Promise<number> {
		try {
			// Look for corresponding test files
			const pathStr = filePath.path;
			const testPaths = [
				pathStr.replace(/\.(ts|js)$/, '.test.$1'),
				pathStr.replace(/\.(ts|js)$/, '.spec.$1'),
				pathStr.replace(/\/([^/]+)\.(ts|js)$/, '/tests/$1.test.$2'),
				pathStr.replace(/\/src\//, '/test/').replace(/\.(ts|js)$/, '.test.$1')
			];

			for (const testPath of testPaths) {
				const testUri = URI.file(testPath);
				const exists = await this.fileService.exists(testUri);
				if (exists) {
					const testContent = await this.fileService.readFile(testUri);
					const testCode = testContent.value.toString();
					
					// Estimate coverage based on test file size relative to source
					const sourceContent = await this.fileService.readFile(filePath);
					const sourceLines = sourceContent.value.toString().split('\n').length;
					const testLines = testCode.split('\n').length;
					
					return Math.min(1.0, testLines / sourceLines);
				}
			}

			return 0; // No tests found
		} catch {
			return 0;
		}
	}

	private detectIssues(code: string, extension?: string): ICodeIssue[] {
		const issues: ICodeIssue[] = [];
		const lines = code.split('\n');

		lines.forEach((line, index) => {
			// Detect potential issues
			if (line.includes('console.log') && extension === 'ts') {
				issues.push({
					type: 'warning',
					message: 'Consider using proper logging instead of console.log',
					line: index + 1,
					column: line.indexOf('console.log'),
					severity: 4
				});
			}

			if (line.includes('any') && extension === 'ts') {
				issues.push({
					type: 'suggestion',
					message: 'Consider using more specific types instead of any',
					line: index + 1,
					column: line.indexOf('any'),
					severity: 3
				});
			}

			if (line.length > 120) {
				issues.push({
					type: 'warning',
					message: 'Line is too long, consider breaking it up',
					line: index + 1,
					column: 120,
					severity: 2
				});
			}

			if (line.includes('TODO') || line.includes('FIXME')) {
				issues.push({
					type: 'suggestion',
					message: 'TODO/FIXME comment found',
					line: index + 1,
					column: line.search(/TODO|FIXME/),
					severity: 1
				});
			}
		});

		return issues;
	}

	private extractDependencies(code: string, extension?: string): string[] {
		const dependencies: string[] = [];

		// Extract import statements
		const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
		let match;
		while ((match = importRegex.exec(code)) !== null) {
			dependencies.push(match[1]);
		}

		// Extract require statements
		const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
		while ((match = requireRegex.exec(code)) !== null) {
			dependencies.push(match[1]);
		}

		return [...new Set(dependencies)]; // Remove duplicates
	}

	private extractExports(code: string, extension?: string): string[] {
		const exports: string[] = [];

		// Extract export statements
		const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
		let match;
		while ((match = exportRegex.exec(code)) !== null) {
			exports.push(match[1]);
		}

		return exports;
	}

	private async loadPersistedContext(): Promise<void> {
		try {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceUri) return;

			const contextFile = URI.joinPath(workspaceUri, '.vscode', 'ai-context-store.json');
			const exists = await this.fileService.exists(contextFile);
			
			if (exists) {
				const content = await this.fileService.readFile(contextFile);
				const data = JSON.parse(content.value.toString());
				
				for (const entry of data.entries || []) {
					this.contextStore.set(entry.key, entry);
				}
			}
		} catch (error) {
			this.logService.warn('[ContextManager] Failed to load persisted context:', error);
		}
	}

	private async persistContext(): Promise<void> {
		try {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceUri) return;

			const contextFile = URI.joinPath(workspaceUri, '.vscode', 'ai-context-store.json');
			const data = {
				entries: Array.from(this.contextStore.values()),
				lastUpdated: Date.now()
			};

			await this.fileService.writeFile(contextFile, VSBuffer.fromString(JSON.stringify(data, null, 2)));
		} catch (error) {
			this.logService.warn('[ContextManager] Failed to persist context:', error);
		}
	}
}