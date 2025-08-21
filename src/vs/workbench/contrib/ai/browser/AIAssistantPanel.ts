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
    private collaborationModeElement!: HTMLSelectElement;
    private providerSelectElement!: HTMLSelectElement;
    private suggestionsPanelElement!: HTMLDivElement;
    private contextViewElement!: HTMLDivElement;
    private metricsElement!: HTMLDivElement;
    private currentCollaborationMode: string = 'navigator';
    private activeSuggestions: any[] = [];

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
        
        // Create modern layout with tabs and panels
        const overallContainer = document.createElement('div');
        overallContainer.style.display = 'flex';
        overallContainer.style.flexDirection = 'column';
        overallContainer.style.height = '100%';
        overallContainer.style.fontFamily = 'var(--vscode-font-family)';

        // Create header with controls
        const headerContainer = this.createHeaderControls();
        overallContainer.appendChild(headerContainer);

        // Create main content area with tabs
        const contentContainer = document.createElement('div');
        contentContainer.style.display = 'flex';
        contentContainer.style.height = 'calc(100% - 60px)';
        contentContainer.style.overflow = 'hidden';
        
        // Create tabbed interface
        const tabsContainer = this.createTabsInterface();
        contentContainer.appendChild(tabsContainer);
        
        overallContainer.appendChild(contentContainer);
        parent.appendChild(overallContainer);
    }

    private createHeaderControls(): HTMLElement {
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.padding = '8px 12px';
        header.style.borderBottom = '1px solid var(--vscode-panel-border)';
        header.style.backgroundColor = 'var(--vscode-panel-background)';

        // AI Provider selector
        const providerLabel = document.createElement('label');
        providerLabel.textContent = 'Provider: ';
        providerLabel.style.marginRight = '8px';
        providerLabel.style.fontSize = '12px';
        
        this.providerSelectElement = document.createElement('select');
        this.providerSelectElement.style.marginRight = '16px';
        this.providerSelectElement.style.padding = '4px 8px';
        this.providerSelectElement.style.borderRadius = '4px';
        this.providerSelectElement.style.border = '1px solid var(--vscode-input-border)';
        
        ['ollama', 'openai', 'claude', 'gemini'].forEach(provider => {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
            this.providerSelectElement.appendChild(option);
        });

        // Collaboration mode selector
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Mode: ';
        modeLabel.style.marginRight = '8px';
        modeLabel.style.fontSize = '12px';
        
        this.collaborationModeElement = document.createElement('select');
        this.collaborationModeElement.style.marginRight = '16px';
        this.collaborationModeElement.style.padding = '4px 8px';
        this.collaborationModeElement.style.borderRadius = '4px';
        this.collaborationModeElement.style.border = '1px solid var(--vscode-input-border)';
        
        ['navigator', 'driver', 'reviewer'].forEach(mode => {
            const option = document.createElement('option');
            option.value = mode;
            option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
            this.collaborationModeElement.appendChild(option);
        });

        this.collaborationModeElement.addEventListener('change', () => {
            this.currentCollaborationMode = this.collaborationModeElement.value;
            this.updateCollaborationMode();
        });

        // Status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.style.marginLeft = 'auto';
        statusIndicator.style.padding = '4px 12px';
        statusIndicator.style.borderRadius = '12px';
        statusIndicator.style.backgroundColor = 'var(--vscode-button-background)';
        statusIndicator.style.color = 'var(--vscode-button-foreground)';
        statusIndicator.style.fontSize = '11px';
        statusIndicator.textContent = '🤖 Enhanced AI Ready';

        header.appendChild(providerLabel);
        header.appendChild(this.providerSelectElement);
        header.appendChild(modeLabel);
        header.appendChild(this.collaborationModeElement);
        header.appendChild(statusIndicator);

        return header;
    }

    private createTabsInterface(): HTMLElement {
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.flexDirection = 'column';
        tabsContainer.style.width = '100%';

        // Tab buttons
        const tabButtons = document.createElement('div');
        tabButtons.style.display = 'flex';
        tabButtons.style.borderBottom = '1px solid var(--vscode-panel-border)';
        tabButtons.style.backgroundColor = 'var(--vscode-editor-background)';

        const tabs = [
            { id: 'chat', label: '💬 Chat', active: true },
            { id: 'suggestions', label: '💡 Suggestions' },
            { id: 'context', label: '🧠 Context' },
            { id: 'metrics', label: '📊 Metrics' }
        ];

        tabs.forEach(tab => {
            const button = document.createElement('button');
            button.textContent = tab.label;
            button.style.padding = '8px 16px';
            button.style.border = 'none';
            button.style.backgroundColor = tab.active ? 'var(--vscode-tab-activeBackground)' : 'transparent';
            button.style.color = 'var(--vscode-foreground)';
            button.style.cursor = 'pointer';
            button.style.fontSize = '13px';
            
            button.addEventListener('click', () => this.switchTab(tab.id));
            tabButtons.appendChild(button);
        });

        // Tab content
        const tabContent = document.createElement('div');
        tabContent.style.flex = '1';
        tabContent.style.overflow = 'hidden';
        tabContent.style.position = 'relative';

        // Chat tab (default)
        const chatTab = this.createChatInterface();
        chatTab.id = 'tab-chat';
        tabContent.appendChild(chatTab);

        // Suggestions tab
        this.suggestionsPanelElement = this.createSuggestionsPanel();
        this.suggestionsPanelElement.id = 'tab-suggestions';
        this.suggestionsPanelElement.style.display = 'none';
        tabContent.appendChild(this.suggestionsPanelElement);

        // Context tab
        this.contextViewElement = this.createContextView();
        this.contextViewElement.id = 'tab-context';
        this.contextViewElement.style.display = 'none';
        tabContent.appendChild(this.contextViewElement);

        // Metrics tab
        this.metricsElement = this.createMetricsView();
        this.metricsElement.id = 'tab-metrics';
        this.metricsElement.style.display = 'none';
        tabContent.appendChild(this.metricsElement);

        tabsContainer.appendChild(tabButtons);
        tabsContainer.appendChild(tabContent);

        return tabsContainer;
    }

    private createChatInterface(): HTMLElement {
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

    private createSuggestionsPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.style.padding = '16px';
        panel.style.height = '100%';
        panel.style.overflow = 'auto';

        const title = document.createElement('h3');
        title.textContent = '💡 AI Code Suggestions';
        title.style.margin = '0 0 16px 0';
        title.style.color = 'var(--vscode-foreground)';
        panel.appendChild(title);

        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'suggestions-container';
        panel.appendChild(suggestionsContainer);

        return panel;
    }

    private createContextView(): HTMLElement {
        const panel = document.createElement('div');
        panel.style.padding = '16px';
        panel.style.height = '100%';
        panel.style.overflow = 'auto';

        const title = document.createElement('h3');
        title.textContent = '🧠 Project Context & Memory';
        title.style.margin = '0 0 16px 0';
        title.style.color = 'var(--vscode-foreground)';
        panel.appendChild(title);

        const contextContainer = document.createElement('div');
        contextContainer.id = 'context-container';
        contextContainer.innerHTML = `
            <div style="margin-bottom: 12px;">
                <strong>Recent Context:</strong>
                <div id="recent-context" style="margin-top: 8px; font-family: monospace; font-size: 12px;"></div>
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Project Patterns:</strong>
                <div id="project-patterns" style="margin-top: 8px; font-size: 12px;"></div>
            </div>
            <div>
                <strong>Learning Insights:</strong>
                <div id="learning-insights" style="margin-top: 8px; font-size: 12px;"></div>
            </div>
        `;
        panel.appendChild(contextContainer);

        return panel;
    }

    private createMetricsView(): HTMLElement {
        const panel = document.createElement('div');
        panel.style.padding = '16px';
        panel.style.height = '100%';
        panel.style.overflow = 'auto';

        const title = document.createElement('h3');
        title.textContent = '📊 AI Performance Metrics';
        title.style.margin = '0 0 16px 0';
        title.style.color = 'var(--vscode-foreground)';
        panel.appendChild(title);

        const metricsContainer = document.createElement('div');
        metricsContainer.id = 'metrics-container';
        metricsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div style="padding: 12px; border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 8px;">Response Time</div>
                    <div id="response-time" style="font-size: 24px; color: var(--vscode-charts-green);">--</div>
                </div>
                <div style="padding: 12px; border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 8px;">Success Rate</div>
                    <div id="success-rate" style="font-size: 24px; color: var(--vscode-charts-blue);">--</div>
                </div>
            </div>
            <div style="margin-bottom: 16px;">
                <strong>Recent Performance:</strong>
                <div id="performance-chart" style="margin-top: 8px; height: 100px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 8px;">
                    Performance chart would go here
                </div>
            </div>
            <div>
                <strong>Token Usage:</strong>
                <div id="token-usage" style="margin-top: 8px; font-family: monospace; font-size: 12px;"></div>
            </div>
        `;
        panel.appendChild(metricsContainer);

        return panel;
    }

    private switchTab(tabId: string): void {
        // Hide all tabs
        const tabs = ['chat', 'suggestions', 'context', 'metrics'];
        tabs.forEach(id => {
            const element = document.getElementById(`tab-${id}`);
            if (element) {
                element.style.display = 'none';
            }
        });

        // Show selected tab
        const selectedTab = document.getElementById(`tab-${tabId}`);
        if (selectedTab) {
            selectedTab.style.display = 'block';
        }

        // Update tab button styles
        const tabButtons = document.querySelectorAll('button');
        tabButtons.forEach(button => {
            button.style.backgroundColor = 'transparent';
        });

        // Highlight active tab (simplified - would need proper button reference)
        this.logService.info(`[AIAssistantPanel] Switched to ${tabId} tab`);
    }

    private updateCollaborationMode(): void {
        // Update the collaboration mode in the AI system
        this.logService.info(`[AIAssistantPanel] Collaboration mode changed to: ${this.currentCollaborationMode}`);
        
        // This would integrate with the configuration service to update the mode
        // For now, just log the change
    }

    layoutBody(height: number, width: number): void {
        // Enhanced layout logic for the new interface
    }
}
