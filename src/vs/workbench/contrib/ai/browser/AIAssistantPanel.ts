/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Panel } from 'vs/workbench/browser/parts/panel/panel';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class AIAssistantPanel extends Panel {
    public static readonly ID = 'workbench.panel.aiAssistant';

    private waitingForInputTaskId: string | null = null;
    private inputElement!: HTMLTextAreaElement;
    private historyElement!: HTMLDivElement;

    constructor(
        @ITelemetryService telemetryService: ITelemetryService,
        @IThemeService themeService: IThemeService,
        @IStorageService storageService: IStorageService,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @IAgentRunnerService private readonly agentRunnerService: IAgentRunnerService,
    ) {
        super(AIAssistantPanel.ID, telemetryService, themeService, storageService);
        this._register(this.agentRunnerService.onAgentActivity(e => this.handleAgentActivity(e)));
    }

    protected override renderBody(parent: HTMLElement): void {
        super.renderBody(parent);

        this.historyElement = document.createElement('div');
        this.historyElement.id = 'ai-assistant-history';
        this.historyElement.style.flex = '1';
        this.historyElement.style.overflowY = 'auto';
        this.inputElement = document.createElement('textarea');
        this.inputElement.id = 'ai-assistant-input';
        this.inputElement.placeholder = 'Type your request...';
        this.inputElement.style.width = '100%';
        this.inputElement.style.height = '100px';
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserSend();
            }
        });
    }

    private handleAgentActivity(event: IAgentActivity): void {
        this.logService.info(`[AIAssistantPanel] Received agent activity: ${event.type}`);
        this.appendMessage(`System (${event.type})`, `Task [${event.taskId}]: ${event.message}`);

        if (event.type === 'waitingForUserInput') {
            this.waitingForInputTaskId = event.taskId;
            this.inputElement.disabled = false;
            this.inputElement.placeholder = event.message || 'Please provide your input...';
            this.inputElement.focus();
        } else if (event.type === 'taskCompleted' || event.type === 'taskFailed') {
            this.inputElement.disabled = false;
            this.inputElement.placeholder = 'Type your request...';
    }

    private appendMessage(sender: string, message: string): void {
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `<strong>${sender}:</strong><br>${message.replace(/\n/g, '<br>')}`;
        messageElement.style.marginBottom = '10px';
        this.historyElement.appendChild(messageElement);
        this.historyElement.scrollTop = this.historyElement.scrollHeight;
    }

    layoutBody(height: number, width: number): void {
        // layout logic
    }
}
