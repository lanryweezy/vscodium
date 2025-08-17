/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Panel } from 'vs/workbench/browser/parts/panel/panel';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAgentRunnerService, IAgentActivity } from 'vs/platform/ai/common/aiTypes';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';

interface ITask {
	id: string;
	title: string;
	description: string;
	status: string;
}

export class AIAssistantPanel extends Panel {
    public static readonly ID = 'workbench.panel.aiAssistant';

    private waitingForInputTaskId: string | null = null;
    private inputElement!: HTMLTextAreaElement;
    private historyElement!: HTMLDivElement;
    private taskListViewElement!: HTMLDivElement;

    constructor(
        @ITelemetryService telemetryService: ITelemetryService,
        @IThemeService themeService: IThemeService,
        @IStorageService storageService: IStorageService,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @IAgentRunnerService private readonly agentRunnerService: IAgentRunnerService,
        @ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
    ) {
        super(AIAssistantPanel.ID, telemetryService, themeService, storageService);
        this._register(this.agentRunnerService.onAgentActivity(e => this.handleAgentActivity(e)));
    }

    protected override renderBody(parent: HTMLElement): void {
        super.renderBody(parent);
        const overallContainer = document.createElement('div');
        overallContainer.style.display = 'flex';
        overallContainer.style.height = '100%';
        overallContainer.style.width = '100%';
        parent.appendChild(overallContainer);

        // Main chat/log container
        const chatContainer = document.createElement('div');
        chatContainer.style.flex = '2';
        chatContainer.style.display = 'flex';
        chatContainer.style.flexDirection = 'column';
        chatContainer.style.padding = '10px';
        overallContainer.appendChild(chatContainer);

        this.historyElement = document.createElement('div');
        this.historyElement.id = 'ai-assistant-history';
        this.historyElement.style.flex = '1';
        this.historyElement.style.overflowY = 'auto';
        chatContainer.appendChild(this.historyElement);

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
        chatContainer.appendChild(this.inputElement);

        // Task List View container
        this.taskListViewElement = document.createElement('div');
        this.taskListViewElement.id = 'ai-task-list-view';
        this.taskListViewElement.style.flex = '1';
        this.taskListViewElement.style.borderLeft = '1px solid grey';
        this.taskListViewElement.style.padding = '10px';
        this.taskListViewElement.style.overflowY = 'auto';
        overallContainer.appendChild(this.taskListViewElement);

		this.loadAndRenderTasks();
    }

	private async loadAndRenderTasks(): Promise<void> {
		// ... (implementation remains the same)
	}

    private handleUserSend(): void {
        // ... (implementation remains the same)
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
        } else if (event.type === 'taskStatusChanged') {
			this.updateTaskStatusInView(event.taskId, event.status);
		}
    }

    private appendMessage(sender: string, message: string): void {
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `<strong>${sender}:</strong><br>${message.replace(/\n/g, '<br>')}`;
        messageElement.style.marginBottom = '10px';
        this.historyElement.appendChild(messageElement);
        this.historyElement.scrollTop = this.historyElement.scrollHeight;
    }

	private updateTaskStatusInView(taskId: string, newStatus: string): void {
		const taskElement = this.taskListViewElement.querySelector(`[data-task-id="${taskId}"]`) as HTMLDivElement;
		if (taskElement) {
			const statusElement = taskElement.querySelector('strong');
			if (statusElement) {
				statusElement.textContent = `[${newStatus.toUpperCase()}]`;
			}
		} else {
			// If the task isn't in the view, it might be a sub-task created after the initial render.
			// A simple solution is to just re-render the whole list.
			this.logService.info(`[AIAssistantPanel] Task ${taskId} not found in view, reloading task list.`);
			this.loadAndRenderTasks();
		}
	}

    layoutBody(height: number, width: number): void {
        // layout logic
    }
}
