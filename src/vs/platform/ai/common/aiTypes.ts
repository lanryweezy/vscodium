/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';

export interface IAgentDefinition {
	name: string;
	description: string;
	role: string;
	permissions: {
		code_edit: boolean;
		terminal_access: boolean;
		file_system_access: boolean;
		network_access: boolean;
		workspace_modification: boolean;
	};
	tools: string[];
	can_call: string[];
	model?: string;
	provider?: string;
	capabilities: string[];
	memory_enabled: boolean;
	learning_enabled: boolean;
	initial_prompt_template: string;
}

export interface IAgentRequest {
	message: string;
	[key: string]: any;
}

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'delegated' | 'waiting' | 'interrupted';

export interface IAgentTask {
	id: string;
	agentName: string;
	request: IAgentRequest;
	status: AgentTaskStatus;
	history: any[];
	startTime?: number;
	parentTaskId?: string;
	delegatedToTaskIds?: string[];
	output?: any;
}

export interface LlmActionResponse {
	tool?: string;
	delegate?: string;
	result?: string;
	args: any;
	thought?: string;
}

export interface IAgentToolExecuteArg {
	projectRoot?: URI;
	executeTerminalCommand: (command: string, args: string[], cwd: URI) => Promise<{ stdout: string, stderr: string, exitCode: number | undefined }>;
}

export interface IAgentToolExecuteResult {
	result: any;
	isError?: boolean;
}

export interface IAgentTool {
	readonly name: string;
	readonly description: string;
	readonly inputSchema: any;
	execute(args: any, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult | string | number | boolean | undefined | null | void>;
}

export interface IAgentToolsService {
	readonly _serviceBrand: undefined;
	getTool(name: string): IAgentTool | undefined;
	getTools(): IAgentTool[];
}

export interface IAgentRunnerService {
	readonly _serviceBrand: undefined;
	readonly onAgentActivity: Event<IAgentActivity>;
	runAgent(agentName: string, request: IAgentRequest, parentTaskId?: string): Promise<string>;
	resolveUserInput(taskId: string, userInput: any): Promise<void>;
}

export interface IAgentActivity {
	type: 'tool' | 'delegate' | 'result' | 'thought' | 'waitingForUserInput' | 'taskCompleted' | 'taskFailed' | 'taskStatusChanged' | 'codeGenerated' | 'testPassed' | 'errorFixed';
	taskId: string;
	message: string;
	confidence?: number;
	context?: any;
	metadata?: {
		performance: number;
		tokensUsed: number;
		executionTime: number;
	};
	[key: string]: any;
}

// Enhanced interfaces for better AI capabilities
export interface ILlmCommsService {
	readonly _serviceBrand: undefined;
	sendMessage(taskId: string, request: LlmRequest): Promise<LlmResponse>;
	getAvailableProviders(): string[];
	setProviderConfig(provider: string, config: any): void;
}

export interface LlmRequest {
	prompt: string;
	agentName?: string;
	context?: any;
	options?: any;
}

export interface LlmResponse {
	content: string;
	metadata?: {
		tokensUsed?: number;
		model?: string;
		provider?: string;
	};
}

export interface IContextManager {
	readonly _serviceBrand: undefined;
	addContext(key: string, value: any): void;
	getContext(key: string): any;
	getRelevantContext(query: string): any[];
	clearContext(): void;
}

export interface ICodeAnalysisService {
	readonly _serviceBrand: undefined;
	analyzeCode(filePath: URI): Promise<ICodeAnalysis>;
	suggestImprovements(filePath: URI): Promise<ICodeSuggestion[]>;
	detectPatterns(workspaceUri: URI): Promise<ICodePattern[]>;
}

export interface ICodeAnalysis {
	complexity: number;
	maintainability: number;
	testCoverage: number;
	issues: ICodeIssue[];
	dependencies: string[];
	exports: string[];
}

export interface ICodeIssue {
	type: 'warning' | 'error' | 'suggestion';
	message: string;
	line: number;
	column: number;
	severity: number;
}

export interface ICodeSuggestion {
	type: 'refactor' | 'optimize' | 'fix' | 'enhance';
	description: string;
	confidence: number;
	impact: 'low' | 'medium' | 'high';
	code?: string;
}

export interface ICodePattern {
	name: string;
	description: string;
	occurrences: number;
	files: URI[];
}
