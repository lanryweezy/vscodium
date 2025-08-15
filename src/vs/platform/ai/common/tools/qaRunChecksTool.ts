/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IConfigurationService, IQaToolsConfig } from 'vs/platform/ai/common/configurationService';
import { ILogService } from 'vs/platform/log/common/log';

interface IQaRunChecksArgs {
	file_path: string;
	check_type: keyof IQaToolsConfig;
}

export class QaRunChecksTool implements IAgentTool {
	readonly name = 'qa.runChecks';
	readonly description = 'Runs a quality assurance check (like a linter or unit tester) on a single file using the commands defined in the project configuration.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			file_path: {
				type: 'string',
				description: 'The path to the file to check.',
				required: true
			},
			check_type: {
				type: 'string',
				description: 'The type of check to run.',
				enum: ['linter', 'tester'],
				required: true
			}
		},
	};

	async execute(args: IQaRunChecksArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.file_path || !args.check_type) {
			return { result: 'Error: file_path and check_type arguments are required.', isError: true };
		}

		const commandString = this.configurationService.getQaToolCommand(args.check_type);
		if (!commandString) {
			return { result: `Error: No command configured for check_type '${args.check_type}'.`, isError: true };
		}

		// Simple command parsing. A more robust solution would be needed for complex commands.
		const [command, ...initialArgs] = commandString.split(' ');
		const fullArgs = [...initialArgs, args.file_path];

		this.logService.info(`[QaRunChecksTool] Executing '${args.check_type}' check on '${args.file_path}' with command: '${command} ${fullArgs.join(' ')}'`);

		try {
			const termResult = await context.executeTerminalCommand(command, fullArgs, context.projectRoot);
			return {
				result: termResult, // Return the full terminal result object
			};
		} catch (e: any) {
			this.logService.error(`[QaRunChecksTool] Error executing command for '${args.check_type}':`, e);
			return {
				result: `Error executing command: ${e.message || e}`,
				isError: true,
			};
		}
	}
}
