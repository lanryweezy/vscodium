/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IContextManager } from 'vs/platform/ai/common/aiTypes';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IContextManagerService = createDecorator<IContextManager>('contextManager');

interface IContextEntry {
	key: string;
	value: any;
	timestamp: number;
	relevanceScore: number;
	tags: string[];
	type: 'code' | 'conversation' | 'file' | 'project' | 'user_preference' | 'error' | 'solution';
}

export class ContextManager implements IContextManager {
	_serviceBrand: undefined;

	private readonly contextStore = new Map<string, IContextEntry>();
	private readonly maxContextEntries = 10000;
	private readonly contextDecayFactor = 0.95;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		this.loadPersistedContext();
	}

	addContext(key: string, value: any, type: IContextEntry['type'] = 'conversation', tags: string[] = []): void {
		const entry: IContextEntry = {
			key,
			value,
			timestamp: Date.now(),
			relevanceScore: 1.0,
			tags,
			type
		};

		this.contextStore.set(key, entry);
		this.pruneOldContext();
		this.persistContext();
	}

	getContext(key: string): any {
		const entry = this.contextStore.get(key);
		if (entry) {
			// Boost relevance when accessed
			entry.relevanceScore = Math.min(1.0, entry.relevanceScore + 0.1);
			entry.timestamp = Date.now();
			return entry.value;
		}
		return undefined;
	}

	getRelevantContext(query: string, limit: number = 10): any[] {
		const queryTokens = query.toLowerCase().split(/\s+/);
		const scoredEntries: Array<{ entry: IContextEntry; score: number }> = [];

		for (const entry of this.contextStore.values()) {
			let score = entry.relevanceScore;
			
			// Score based on content relevance
			const contentStr = JSON.stringify(entry.value).toLowerCase();
			for (const token of queryTokens) {
				if (contentStr.includes(token)) {
					score += 0.3;
				}
			}

			// Score based on tags
			for (const tag of entry.tags) {
				if (queryTokens.some(token => tag.toLowerCase().includes(token))) {
					score += 0.2;
				}
			}

			// Time decay
			const ageInHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
			score *= Math.exp(-ageInHours / 24); // Decay over 24 hours

			scoredEntries.push({ entry, score });
		}

		return scoredEntries
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(item => ({
				key: item.entry.key,
				value: item.entry.value,
				type: item.entry.type,
				score: item.score
			}));
	}

	clearContext(): void {
		this.contextStore.clear();
		this.persistContext();
	}

	private pruneOldContext(): void {
		if (this.contextStore.size <= this.maxContextEntries) {
			return;
		}

		// Decay all relevance scores
		for (const entry of this.contextStore.values()) {
			entry.relevanceScore *= this.contextDecayFactor;
		}

		// Remove lowest scoring entries
		const entries = Array.from(this.contextStore.entries());
		entries.sort((a, b) => a[1].relevanceScore - b[1].relevanceScore);
		
		const toRemove = entries.slice(0, this.contextStore.size - this.maxContextEntries);
		for (const [key] of toRemove) {
			this.contextStore.delete(key);
		}
	}

	private async loadPersistedContext(): Promise<void> {
		try {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceUri) return;

			const contextFile = URI.joinPath(workspaceUri, '.vscode', 'ai-context.json');
			const exists = await this.fileService.exists(contextFile);
			
			if (exists) {
				const content = await this.fileService.readFile(contextFile);
				const data = JSON.parse(content.value.toString());
				
				for (const entry of data.entries || []) {
					this.contextStore.set(entry.key, entry);
				}
			}
		} catch (error) {
			this.logService.warn('[ContextManager] Failed to load persisted context:', error);
		}
	}

	private async persistContext(): Promise<void> {
		try {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceUri) return;

			const contextFile = URI.joinPath(workspaceUri, '.vscode', 'ai-context.json');
			const data = {
				entries: Array.from(this.contextStore.values()),
				lastUpdated: Date.now()
			};

			await this.fileService.writeFile(contextFile, VSBuffer.fromString(JSON.stringify(data, null, 2)));
		} catch (error) {
			this.logService.warn('[ContextManager] Failed to persist context:', error);
		}
	}
}