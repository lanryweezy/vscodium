/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { IAgentDefinition, IAgentRequest, IAgentTask, IAgentRunnerService, IAgentTool, IAgentToolsService, LlmActionResponse, AgentTaskStatus, IAgentActivity } from 'vs/platform/ai/common/aiTypes';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IAgentDefinitionService } from 'vs/platform/ai/common/agentDefinitionService';
import { IAgentTaskStoreService } from 'vs/platform/ai/common/agentTaskStoreService';
import { ILlmCommsService, LlmCommsService } from 'vs/platform/ai/common/llmCommsService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { AgentPerformanceMonitorService, IAgentPerformanceMonitorService } from 'vs/platform/ai/common/agentPerformanceMonitorService';
import { IAgentTaskMetrics } from 'vs/platform/ai/common/agentMetrics';
import { IFileService } from 'vs/platform/files/common/files';
import { UserRequestInputTool } from 'vs/platform/ai/common/tools/userRequestInputTool';
import { IConfigurationService, ConfigurationService } from 'vs/platform/ai/common/configurationService';

// ... (IWaitingForUserInputState and vscode_executeTerminalCommand_SANDBOXED remain the same)

export class AgentRunnerService implements IAgentRunnerService {
	// ... (service brand, emitters, maps, and services remain the same)

	constructor(
		// ... (constructor logic remains the same)
	) {
		// ... (constructor logic remains the same)
	}

	private async _executeAgentTask(taskId: string, agent: IAgentDefinition, request: IAgentRequest): Promise<any> {
		// ... (initial setup and metrics counters remain the same)

		try {
			// ... (while loop and prompt construction remain the same)

				// ... (LLM call and response parsing remain the same)

				if (action.tool) {
					// ... (user input tool logic remains the same)

					const tool = this.agentToolsService.getTool(action.tool);
					if (tool) {
						this.logService.info(`[AgentRunnerService] Task ${taskId} is using tool ${tool.name}`);
						toolCalls++;
						const toolResult = await tool.execute(action.args, {
							projectRoot,
							executeTerminalCommand: (command, args, cwd) => new Promise((resolve, reject) => vscode_executeTerminalCommand_SANDBOXED(command, args, cwd, (output) => this.logService.info(output), (error) => error ? reject(error) : resolve({ stdout: 'mock stdout', stderr: '', exitCode: 0 } as any)))
						});
						prompt += `\n\nI have used the tool '${tool.name}' with arguments ${JSON.stringify(action.args)}. The result was: ${JSON.stringify(toolResult)}`;

						// ** NEW: Fire event for task status updates **
						if (tool.name === 'pm.updateTaskStatus' && toolResult.isError !== true) {
							this._onAgentActivity.fire({
								type: 'taskStatusChanged',
								taskId: action.args.task_id,
								status: action.args.status,
								message: `Status of task ${action.args.task_id} updated to ${action.args.status}`
							});
						}
					} else {
						prompt += `\n\nI tried to use a tool named '${action.tool}' but it is not available.`;
						errorCount++;
					}
				} else if (action.delegate) {
					// ... (delegation logic remains the same)
				} else if (action.result) {
					// ... (result handling remains the same)
				}
			// ... (end of while loop)
		} finally {
			// ... (metrics logic remains the same)
		}
	}

	// ... (runAgent and resolveUserInput methods remain the same)
}
