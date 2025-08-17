/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from 'vs/platform/log/common/log';
import { ILlmCommsService, LlmRequest, LlmResponse } from 'vs/platform/ai/common/aiTypes';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/ai/common/configurationService';
import { IRequestService } from 'vs/platform/request/common/request';
import { VSBuffer } from 'vs/base/common/buffer';

export const OllamaLLMCommsService = createDecorator<ILlmCommsService>('llmCommsService');

export class LlmCommsService implements ILlmCommsService {
	_serviceBrand: undefined;

	private readonly endpoint = 'http://localhost:11434/api/generate';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRequestService private readonly requestService: IRequestService,
	) { }

	async sendMessage(taskId: string, request: LlmRequest): Promise<LlmResponse> {
		const agentName = request.agentName || 'default';
		const model = this.configurationService.getAgentModel(agentName);
		this.logService.info(`[LlmCommsService] Task ${taskId} sending message to model ${model} for agent ${agentName}`);

		try {
			const reqBody = JSON.stringify({
				model: model,
				prompt: request.prompt,
				stream: false,
				options: request.options
			});

			const response = await this.requestService.request({
				type: 'POST',
				url: this.endpoint,
				data: VSBuffer.fromString(reqBody),
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.res.statusCode !== 200) {
				const errorBody = (await response.stream.read()).toString();
				this.logService.error(`[LlmCommsService] Task ${taskId} received error from LLM service: ${response.res.statusCode}`, errorBody);
				throw new Error(`LLM service returned error: ${response.res.statusCode}`);
			}

			const bodyStr = (await response.stream.read()).toString();
			const jsonResponse = JSON.parse(bodyStr);

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
