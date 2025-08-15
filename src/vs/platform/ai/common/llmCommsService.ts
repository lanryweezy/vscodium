/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from 'vs/platform/log/common/log';
import { ILlmCommsService, LlmRequest, LlmResponse } from 'vs/platform/ai/common/aiTypes';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/ai/common/configurationService';

export const OllamaLLMCommsService = createDecorator<ILlmCommsService>('llmCommsService');

export class LlmCommsService implements ILlmCommsService {
	_serviceBrand: undefined;

	private readonly endpoint = 'http://localhost:11434/api/generate';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) { }

	async sendMessage(taskId: string, request: LlmRequest): Promise<LlmResponse> {
		// The agentName needs to be passed in the request to get the specific model.
		// This is a conceptual change; AgentRunnerService will need to be updated to pass this.
		const agentName = request.agentName || 'default';
		const model = this.configurationService.getAgentModel(agentName);

		this.logService.info(`[LlmCommsService] Task ${taskId} sending message to model ${model} for agent ${agentName}`);

		try {
			const response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: model,
					prompt: request.prompt,
					stream: false,
					options: request.options,
				}),
			});

			if (!response.ok) {
				const errorBody = await response.text();
				this.logService.error(`[LlmCommsService] Task ${taskId} received error from LLM service: ${response.status} ${response.statusText}`, errorBody);
				throw new Error(`LLM service returned error: ${response.status} ${response.statusText}`);
			}

			const jsonResponse = await response.json();

			if (jsonResponse.error) {
				this.logService.error(`[LlmCommsService] Task ${taskId} received error from LLM service: ${jsonResponse.error}`);
				throw new Error(`LLM service returned error: ${jsonResponse.error}`);
			}

			return { content: jsonResponse.response };

		} catch (e: any) {
			this.logService.error(`[LlmCommsService] Task ${taskId} failed to communicate with LLM service:`, e);
			throw e;
		}
	}
}
