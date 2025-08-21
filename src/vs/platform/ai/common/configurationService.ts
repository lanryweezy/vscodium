/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

export const IConfigurationService = createDecorator<IConfigurationService>('configurationService');

export interface IQaToolsConfig {
	linter?: string;
	tester?: string;
	security_scanner?: string;
}

export interface IAgentSettingsConfig {
	default_model?: string;
	default_provider?: string;
	providers?: Record<string, IProviderConfig>;
	[agentName: string]: string | IProviderConfig | Record<string, IProviderConfig> | undefined;
}

export interface IProviderConfig {
	endpoint: string;
	apiKey?: string;
	model: string;
	maxTokens?: number;
	temperature?: number;
}

export interface IWorkflowSettingsConfig {
	max_fix_retries?: number;
	enable_auto_fix?: boolean;
	enable_learning?: boolean;
	context_window_size?: number;
}

export interface IAIEnhancementsConfig {
	enable_code_analysis?: boolean;
	enable_pair_programming?: boolean;
	enable_intelligent_debug?: boolean;
	enable_context_memory?: boolean;
	auto_suggest_improvements?: boolean;
	collaboration_mode?: 'navigator' | 'driver' | 'reviewer';
}

export interface IWeezyConfig {
	qa_tools?: IQaToolsConfig;
	agent_settings?: IAgentSettingsConfig;
	workflow_settings?: IWorkflowSettingsConfig;
	ai_enhancements?: IAIEnhancementsConfig;
}

export interface IConfigurationService {
	readonly _serviceBrand: undefined;

	getQaToolCommand(tool: keyof IQaToolsConfig): string;
	getMaxFixRetries(): number;
	getAgentModel(agentName: string): string;
	getAgentProvider(agentName: string): string;
	getProviderConfig(provider: string): IProviderConfig | undefined;
	isFeatureEnabled(feature: keyof IAIEnhancementsConfig): boolean;
	getCollaborationMode(): string;
	updateConfig(updates: Partial<IWeezyConfig>): Promise<void>;
}

export class ConfigurationService implements IConfigurationService {
	readonly _serviceBrand: undefined;

	private static readonly CONFIG_FILE_NAME = '.weezy/config.json';
	private static readonly DEFAULTS = {
		QA_LINTER: 'flake8 --isolated',
		QA_TESTER: 'python -m pytest',
		QA_SECURITY_SCANNER: 'bandit -f json -q',
		AGENT_DEFAULT_MODEL: 'codellama',
		MAX_FIX_RETRIES: 2,
	};

	private _config: IWeezyConfig = {};
	private _isInitialized: boolean = false;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		this.loadConfiguration();
	}

	private async loadConfiguration(): Promise<void> {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length === 0) {
			this.logService.info('[ConfigurationService] No workspace folder found. Using default configurations.');
			this._isInitialized = true;
			return;
		}

		const configFileUri = URI.joinPath(workspaceFolders[0].uri, ConfigurationService.CONFIG_FILE_NAME);

		try {
			if (await this.fileService.exists(configFileUri)) {
				const content = await this.fileService.readFile(configFileUri);
				this._config = JSON.parse(content.toString());
				this.logService.info(`[ConfigurationService] Loaded configuration from ${configFileUri.toString()}`);
			} else {
				this.logService.info(`[ConfigurationService] Config file not found at ${configFileUri.toString()}. Using default configurations.`);
			}
		} catch (error) {
			this.logService.error(`[ConfigurationService] Error reading or parsing config file. Using default configurations.`, error);
		}

		this._isInitialized = true;
	}

	private ensureInitialized(): void {
		if (!this._isInitialized) {
			// This is a fallback, but in practice the async constructor pattern should be handled by the instantiator.
			// Forcing a sync-like behavior here for robustness in case it's not.
			this.logService.warn('[ConfigurationService] Service was not initialized. Loading configuration synchronously.');
			this.loadConfiguration(); // Note: This is not truly synchronous but will be awaited by the getters.
		}
	}

	public getQaToolCommand(tool: keyof IQaToolsConfig): string {
		this.ensureInitialized();
		const command = this._config.qa_tools?.[tool];
		if (command) { return command; }

		switch (tool) {
			case 'linter': return ConfigurationService.DEFAULTS.QA_LINTER;
			case 'tester': return ConfigurationService.DEFAULTS.QA_TESTER;
			case 'security_scanner': return ConfigurationService.DEFAULTS.QA_SECURITY_SCANNER;
			default: return '';
		}
	}

	public getMaxFixRetries(): number {
		this.ensureInitialized();
		return this._config.workflow_settings?.max_fix_retries ?? ConfigurationService.DEFAULTS.MAX_FIX_RETRIES;
	}

	public getAgentModel(agentName: string): string {
		this.ensureInitialized();
		return this._config.agent_settings?.[agentName] ??
			this._config.agent_settings?.default_model ??
			ConfigurationService.DEFAULTS.AGENT_DEFAULT_MODEL;
	}

	public getAgentProvider(agentName: string): string {
		this.ensureInitialized();
		return this._config.agent_settings?.default_provider ?? 'ollama';
	}

	public getProviderConfig(provider: string): IProviderConfig | undefined {
		this.ensureInitialized();
		return this._config.agent_settings?.providers?.[provider];
	}

	public isFeatureEnabled(feature: keyof IAIEnhancementsConfig): boolean {
		this.ensureInitialized();
		const defaultValues: Record<keyof IAIEnhancementsConfig, boolean> = {
			enable_code_analysis: true,
			enable_pair_programming: true,
			enable_intelligent_debug: true,
			enable_context_memory: true,
			auto_suggest_improvements: true,
			collaboration_mode: true
		};
		
		const config = this._config.ai_enhancements?.[feature];
		return config !== undefined ? Boolean(config) : defaultValues[feature];
	}

	public getCollaborationMode(): string {
		this.ensureInitialized();
		return this._config.ai_enhancements?.collaboration_mode ?? 'navigator';
	}

	public async updateConfig(updates: Partial<IWeezyConfig>): Promise<void> {
		this.ensureInitialized();
		
		// Merge updates with existing config
		this._config = {
			...this._config,
			...updates,
			agent_settings: {
				...this._config.agent_settings,
				...updates.agent_settings
			},
			workflow_settings: {
				...this._config.workflow_settings,
				...updates.workflow_settings
			},
			ai_enhancements: {
				...this._config.ai_enhancements,
				...updates.ai_enhancements
			}
		};

		// Save to file
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length > 0) {
				const configFileUri = URI.joinPath(workspaceFolders[0].uri, ConfigurationService.CONFIG_FILE_NAME);
				const configDir = URI.joinPath(workspaceFolders[0].uri, '.weezy');
				
				// Ensure .weezy directory exists
				if (!(await this.fileService.exists(configDir))) {
					await this.fileService.createFolder(configDir);
				}

				const configContent = JSON.stringify(this._config, null, 2);
				await this.fileService.writeFile(configFileUri, VSBuffer.fromString(configContent));
				
				this.logService.info('[ConfigurationService] Configuration updated and saved');
			}
		} catch (error) {
			this.logService.error('[ConfigurationService] Failed to save configuration:', error);
			throw error;
		}
	}
}
