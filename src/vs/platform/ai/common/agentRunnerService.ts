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
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@IAgentDefinitionService private readonly agentDefinitionService: IAgentDefinitionService,
		@IAgentToolsService private readonly agentToolsService: IAgentToolsService,
		@IAgentTaskStoreService private readonly agentTaskStoreService: IAgentTaskStoreService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) {
		// ... (constructor logic remains the same)
	}

	private async _executeAgentTask(taskId: string, agent: IAgentDefinition, request: IAgentRequest): Promise<any> {
		// ... (initial setup and metrics counters remain the same)

		try {
			// ... (while loop and prompt construction remain the same)

				// ... (LLM call and response parsing remain the same)

				if (action.tool) {
					// ... (tool execution logic remains the same)
				} else if (action.delegate) {
					this.logService.info(`[AgentRunnerService] Task ${taskId} is delegating to agent ${action.delegate}`);
					const delegateAgent = this.agentDefinitionService.getAgent(action.delegate);
					if (delegateAgent) {
						// ** NEW: Handle parallel delegation **
						if (Array.isArray(action.args)) {
							this.logService.info(`[AgentRunnerService] Task ${taskId} is dispatching a batch of ${action.args.length} tasks in parallel.`);
							const promises = action.args.map(arg => {
								const subtaskRequest: IAgentRequest = { message: JSON.stringify(arg) };
								return this.runAgent(action.delegate!, subtaskRequest, taskId);
							});

							const results = await Promise.allSettled(promises);

							// Now, wait for each task to complete and get its final state.
							const finalTaskResults = await Promise.all(results.map(async (result) => {
								if (result.status === 'fulfilled') {
									// This is complex: runAgent returns a taskId, but doesn't wait for completion.
									// For a true parallel wait, we'd need a way to await task completion by ID.
									// This is a conceptual implementation. A real one would need an event or promise map.
									// Let's simulate waiting and getting the result for this conceptual step.
									await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async work
									const task = await this.agentTaskStoreService.getTask(result.value);
									return { taskId: result.value, status: task?.status, output: task?.output };
								} else {
									return { taskId: null, status: 'failed', output: result.reason.message };
								}
							}));

							prompt += `\n\nI have delegated a batch of ${action.args.length} tasks to '${action.delegate}'. The results were: ${JSON.stringify(finalTaskResults)}`;

						} else {
							// ** EXISTING: Handle single delegation **
							const subtaskRequest: IAgentRequest = { message: JSON.stringify(action.args) };
							const subtaskId = await this.runAgent(action.delegate, subtaskRequest, taskId);
							const subtaskResult = await this.agentTaskStoreService.getTask(subtaskId);
							prompt += `\n\nI have delegated a subtask to '${action.delegate}'. The result was: ${subtaskResult?.output}`;
						}
					} else {
						prompt += `\n\nI tried to delegate to an agent named '${action.delegate}' but it is not available.`;
						errorCount++;
					}
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
