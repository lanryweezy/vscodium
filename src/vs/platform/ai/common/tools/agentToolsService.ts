/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolsService } from 'vs/platform/ai/common/aiTypes';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { SecurityScanFileTool } from 'vs/platform/ai/common/tools/securityScanFileTool';
import { PMUpdateTaskStatusTool } from 'vs/platform/ai/common/tools/pmUpdateTaskStatusTool';
import { DependencyAddTool } from 'vs/platform/ai/common/tools/dependencyAddTool';
import { CodeModifyTool } from 'vs/platform/ai/common/tools/codeModifyTool';
import { QaRunChecksTool } from 'vs/platform/ai/common/tools/qaRunChecksTool';
import { CodeGenerationTool } from 'vs/platform/ai/common/tools/codeGenerationTool';
import { IntelligentDebugTool } from 'vs/platform/ai/common/tools/intelligentDebugTool';
import { PairProgrammingTool } from 'vs/platform/ai/common/tools/pairProgrammingTool';

export class AgentToolsService implements IAgentToolsService {
	_serviceBrand: undefined;

	private readonly _tools: Map<string, IAgentTool> = new Map();

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) {
		// Register enhanced AI tools
		this.registerTool(this.instantiationService.createInstance(SecurityScanFileTool));
		this.registerTool(this.instantiationService.createInstance(PMUpdateTaskStatusTool));
		this.registerTool(this.instantiationService.createInstance(DependencyAddTool));
		this.registerTool(this.instantiationService.createInstance(CodeModifyTool));
		this.registerTool(this.instantiationService.createInstance(QaRunChecksTool));
		
		// Register new advanced tools
		this.registerTool(this.instantiationService.createInstance(CodeGenerationTool));
		this.registerTool(this.instantiationService.createInstance(IntelligentDebugTool));
		this.registerTool(this.instantiationService.createInstance(PairProgrammingTool));
		
		this.logService.info('[AgentToolsService] Registered enhanced AI tools with advanced capabilities');
	}

	private registerTool(tool: IAgentTool): void {
		if (this._tools.has(tool.name)) {
			this.logService.warn(`[AgentToolsService] Tool with name ${tool.name} already registered.`);
			return;
		}
		this._tools.set(tool.name, tool);
	}

	getTool(name: string): IAgentTool | undefined {
		return this._tools.get(name);
	}

	getTools(): IAgentTool[] {
		return Array.from(this._tools.values());
	}
}
