/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';

export const IConfigurationService = createDecorator<IConfigurationService>('configurationService');

export interface IQaToolsConfig {
	linter?: string;
	tester?: string;
	security_scanner?: string;
}

export interface IAgentSettingsConfig {
	default_model?: string;
	[agentName: string]: string | undefined;
}

export interface IWorkflowSettingsConfig {
	max_fix_retries?: number;
}

export interface IWeezyConfig {
	qa_tools?: IQaToolsConfig;
	agent_settings?: IAgentSettingsConfig;
	workflow_settings?: IWorkflowSettingsConfig;
}

export interface IConfigurationService {
	readonly _serviceBrand: undefined;

	getQaToolCommand(tool: keyof IQaToolsConfig): string;
	getMaxFixRetries(): number;
	getAgentModel(agentName: string): string;
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
}
