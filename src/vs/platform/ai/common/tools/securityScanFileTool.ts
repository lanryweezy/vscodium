/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IConfigurationService } from 'vs/platform/ai/common/configurationService';
import { ILogService } from 'vs/platform/log/common/log';

interface ISecurityScanFileArgs {
	file_path: string;
}

interface IBanditIssue {
	filename: string;
	issue_severity: 'LOW' | 'MEDIUM' | 'HIGH';
	issue_confidence: 'LOW' | 'MEDIUM' | 'HIGH';
	issue_text: string;
	line_number: number;
	test_id: string;
}

interface IBanditResults {
	results: IBanditIssue[];
}

export class SecurityScanFileTool implements IAgentTool {
	readonly name = 'security.scanFile';
	readonly description = 'Scans a single Python file for common security vulnerabilities using the configured security scanner tool.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			file_path: {
				type: 'string',
				description: 'The path to the Python file to scan.',
				required: true
			}
		},
	};

	async execute(args: ISecurityScanFileArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.file_path) {
			return {
				result: 'Error: file_path argument is missing.',
				isError: true,
			};
		}

		const commandString = this.configurationService.getQaToolCommand('security_scanner');
		const [command, ...initialArgs] = commandString.split(' ');
		const commandArgs = [...initialArgs, args.file_path];


		try {
			const termResult = await context.executeTerminalCommand(command, commandArgs, context.projectRoot);
			this.logService.info(`[SecurityScanFileTool] command stdout for ${args.file_path}:\n${termResult.stdout}`);

			if (termResult.stdout) {
				try {
					const banditOutput: IBanditResults = JSON.parse(termResult.stdout);
					return {
						result: banditOutput.results || [], // Return the array of issues
					};
				} catch (e) {
					this.logService.error(`[SecurityScanFileTool] Failed to parse scanner JSON output for ${args.file_path}. Error: ${e}. Raw output: ${termResult.stdout}`);
					return {
						result: `Error: Failed to parse scanner JSON output. Raw output: ${termResult.stdout}`,
						isError: true,
					};
				}
			}

			if (termResult.stderr) {
				this.logService.warn(`[SecurityScanFileTool] command stderr for ${args.file_path}:\n${termResult.stderr}`);
			}
			return {
				result: [], // No issues found
			};

		} catch (e: any) {
			this.logService.error(`[SecurityScanFileTool] Error executing scanner command for ${args.file_path}:`, e);
			return {
				result: `Error executing scanner command: ${e.message || e}`,
				isError: true,
			};
		}
	}
}
