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

export type LLMProvider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'azure-openai';

export interface ILLMProviderConfig {
	endpoint: string;
	apiKey?: string;
	model: string;
	maxTokens?: number;
	temperature?: number;
	timeout?: number;
}

export class LlmCommsService implements ILlmCommsService {
	_serviceBrand: undefined;

	private readonly providers: Map<LLMProvider, ILLMProviderConfig> = new Map();
	private readonly defaultEndpoint = 'http://localhost:11434/api/generate';
	
	// Performance and cost optimization
	private readonly responseCache = new Map<string, { response: string; timestamp: number; ttl: number }>();
	private readonly requestQueue: LlmRequest[] = [];
	private readonly providerMetrics = new Map<string, { cost: number; speed: number; reliability: number }>();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRequestService private readonly requestService: IRequestService,
	) { 
		this.initializeProviders();
		this.initializeOptimizations();
	}

	private initializeProviders(): void {
		// Initialize default providers
		this.providers.set('ollama', {
			endpoint: 'http://localhost:11434/api/generate',
			model: 'llama3.2:latest',
			maxTokens: 4096,
			temperature: 0.7,
			timeout: 30000
		});

		this.providers.set('openai', {
			endpoint: 'https://api.openai.com/v1/chat/completions',
			model: 'gpt-4o',
			maxTokens: 4096,
			temperature: 0.7,
			timeout: 30000
		});

		this.providers.set('claude', {
			endpoint: 'https://api.anthropic.com/v1/messages',
			model: 'claude-3-5-sonnet-20241022',
			maxTokens: 4096,
			temperature: 0.7,
			timeout: 30000
		});

		this.providers.set('gemini', {
			endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
			model: 'gemini-1.5-pro',
			maxTokens: 4096,
			temperature: 0.7,
			timeout: 30000
		});
	}

	private getProvider(agentName: string): LLMProvider {
		const configuredProvider = this.configurationService.getAgentProvider?.(agentName);
		return configuredProvider || 'ollama';
	}

	private async sendToOllama(config: ILLMProviderConfig, request: LlmRequest): Promise<LlmResponse> {
		const reqBody = JSON.stringify({
			model: config.model,
			prompt: request.prompt,
			stream: false,
			options: {
				temperature: config.temperature,
				num_predict: config.maxTokens,
				...request.options
			}
		});

		const response = await this.requestService.request({
			type: 'POST',
			url: config.endpoint,
			data: VSBuffer.fromString(reqBody),
			headers: { 'Content-Type': 'application/json' }
		});

		const bodyStr = (await response.stream.read()).toString();
		const jsonResponse = JSON.parse(bodyStr);
		return { content: jsonResponse.response };
	}

	private async sendToOpenAI(config: ILLMProviderConfig, request: LlmRequest): Promise<LlmResponse> {
		const reqBody = JSON.stringify({
			model: config.model,
			messages: [{ role: 'user', content: request.prompt }],
			max_tokens: config.maxTokens,
			temperature: config.temperature,
			...request.options
		});

		const response = await this.requestService.request({
			type: 'POST',
			url: config.endpoint,
			data: VSBuffer.fromString(reqBody),
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${config.apiKey}`
			}
		});

		const bodyStr = (await response.stream.read()).toString();
		const jsonResponse = JSON.parse(bodyStr);
		return { content: jsonResponse.choices[0].message.content };
	}

	private async sendToClaude(config: ILLMProviderConfig, request: LlmRequest): Promise<LlmResponse> {
		const reqBody = JSON.stringify({
			model: config.model,
			messages: [{ role: 'user', content: request.prompt }],
			max_tokens: config.maxTokens,
			temperature: config.temperature,
			...request.options
		});

		const response = await this.requestService.request({
			type: 'POST',
			url: config.endpoint,
			data: VSBuffer.fromString(reqBody),
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': config.apiKey,
				'anthropic-version': '2023-06-01'
			}
		});

		const bodyStr = (await response.stream.read()).toString();
		const jsonResponse = JSON.parse(bodyStr);
		return { content: jsonResponse.content[0].text };
	}

	async sendMessage(taskId: string, request: LlmRequest): Promise<LlmResponse> {
		const agentName = request.agentName || 'default';
		const provider = this.getProvider(agentName);
		const config = this.providers.get(provider);
		
		if (!config) {
			throw new Error(`Provider ${provider} not configured`);
		}

		this.logService.info(`[LlmCommsService] Task ${taskId} sending message to ${provider} model ${config.model} for agent ${agentName}`);

		try {
			let response: LlmResponse;
			
			switch (provider) {
				case 'ollama':
					response = await this.sendToOllama(config, request);
					break;
				case 'openai':
				case 'azure-openai':
					response = await this.sendToOpenAI(config, request);
					break;
				case 'claude':
					response = await this.sendToClaude(config, request);
					break;
				case 'gemini':
					// Implement Gemini support
					throw new Error('Gemini provider not yet implemented');
				default:
					throw new Error(`Unsupported provider: ${provider}`);
			}

			return response;

		} catch (e: any) {
			this.logService.error(`[LlmCommsService] Task ${taskId} failed to communicate with ${provider} service:`, e);
			throw e;
		}
	}
}
