/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';

export interface IAgentDefinition {
	name: string;
	description: string;
	role: string;
	permissions: {
		code_edit: boolean;
		terminal_access: boolean;
	};
	tools: string[];
	can_call: string[];
	model?: string;
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
	type: 'tool' | 'delegate' | 'result' | 'thought' | 'waitingForUserInput' | 'taskCompleted' | 'taskFailed' | 'taskStatusChanged';
	taskId: string;
	message: string;
	[key: string]: any;
}
