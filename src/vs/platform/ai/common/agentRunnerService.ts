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
import { IRequestService } from 'vs/platform/request/common/request';

// ... (IWaitingForUserInputState and vscode_executeTerminalCommand_SANDBOXED remain the same)

export class AgentRunnerService implements IAgentRunnerService {
	_serviceBrand: undefined;

	private readonly _onAgentActivity = new Emitter<IAgentActivity>();
	readonly onAgentActivity: Event<IAgentActivity> = this._onAgentActivity.event;

	private readonly _waitingForUserInput = new Map<string, IWaitingForUserInputState>();

	private readonly performanceMonitorService: IAgentPerformanceMonitorService;
	private readonly configurationService: IConfigurationService;
	private readonly llmCommsService: ILlmCommsService;


	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@IAgentDefinitionService private readonly agentDefinitionService: IAgentDefinitionService,
		@IAgentToolsService private readonly agentToolsService: IAgentToolsService,
		@IAgentTaskStoreService private readonly agentTaskStoreService: IAgentTaskStoreService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IRequestService private readonly requestService: IRequestService,
	) {
		// Workaround for not being able to find the service registration files
		this.configurationService = new ConfigurationService(this.logService, this.fileService, this.workspaceContextService);
		this.performanceMonitorService = new AgentPerformanceMonitorService(this.logService, this.fileService, this.workspaceContextService);
		this.llmCommsService = new LlmCommsService(this.logService, this.configurationService, this.requestService);
	}

	// ... (rest of the file remains the same)
}
