/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAgentTool, IAgentToolExecuteArg, IAgentToolExecuteResult } from 'vs/platform/ai/common/aiTypes';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';

type CodeModifyOperation = 'replace_function_body' | 'rename_variable' | 'add_import';

interface ICodeModifyArgs {
	file_path: string;
	operation: CodeModifyOperation;
	target_name?: string; // e.g., function or variable name
	new_content?: string;  // e.g., new function body or new variable name
	import_name?: string; // e.g., 'requests' or 'pandas as pd'
}

export class CodeModifyTool implements IAgentTool {
	readonly name = 'code.modify';
	readonly description = 'Performs structured modifications to code, such as replacing a function body, renaming a variable, or adding an import. This is often safer than editing the raw text of a file.';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
	) { }

	readonly inputSchema = {
		type: 'object',
		properties: {
			file_path: {
				type: 'string',
				description: 'The path to the Python file to modify.',
				required: true
			},
			operation: {
				type: 'string',
				description: 'The type of structural modification to perform.',
				enum: ['replace_function_body', 'rename_variable', 'add_import'],
				required: true
			},
			target_name: {
				type: 'string',
				description: 'The name of the target to modify (e.g., the function name, the variable to rename). Required for most operations.'
			},
			new_content: {
				type: 'string',
				description: 'The new content to use (e.g., the new function body, the new variable name).'
			},
			import_name: {
				type: 'string',
				description: 'The name of the package or module to import (e.g., "requests", "pandas as pd"). Required for "add_import" operation.'
			}
		},
	};

	async execute(args: ICodeModifyArgs, context: IAgentToolExecuteArg): Promise<IAgentToolExecuteResult> {
		if (!args.file_path || !args.operation) {
			return { result: 'Error: file_path and operation arguments are required.', isError: true };
		}
		if (!context.projectRoot) {
			return { result: 'Error: No project root is available in the current context.', isError: true };
		}

		const fileUri = URI.joinPath(context.projectRoot, args.file_path);

		try {
			const fileContentBuffer = await this.fileService.readFile(fileUri);
			let fileContent = fileContentBuffer.toString();
			let newFileContent = '';

			switch (args.operation) {
				case 'add_import':
					if (!args.import_name) {
						return { result: 'Error: import_name is required for add_import operation.', isError: true };
					}
					// Naive implementation: adds the import to the top of the file.
					newFileContent = `import ${args.import_name}\n${fileContent}`;
					break;

				case 'replace_function_body': {
					if (!args.target_name || args.new_content === undefined) {
						return { result: 'Error: target_name and new_content are required for replace_function_body operation.', isError: true };
					}
					const defRegex = new RegExp(`^(\\s*)def\\s+${args.target_name}\\s*\\([^)]*\\):\\s*$`, 'm');
					const defMatch = defRegex.exec(fileContent);
					if (!defMatch) {
						return { result: `Error: Function '${args.target_name}' not found.`, isError: true };
					}

					const defLineIndentation = defMatch[1] || '';
					const defLineEndIndex = defMatch.index + defMatch[0].length;
					const subsequentContent = fileContent.substring(defLineEndIndex);
					const lines = subsequentContent.split('\n');

					let bodyIndent = '';
					let bodyStartIndex = -1;

					// Find the first indented line which determines the body's indentation level
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						if (line.trim() !== '') {
							const indentMatch = line.match(/^(\s+)/);
							if (indentMatch && indentMatch[1].length > defLineIndentation.length) {
								bodyIndent = indentMatch[1];
								bodyStartIndex = i;
							}
							break; // Found the first non-empty line
						}
					}

					if (bodyStartIndex === -1) {
						// Function has an empty body (e.g., just a pass statement or docstring)
						// This logic can be complex, for now, let's assume a simple case.
						// Fallback to a simple append if no body is found.
						bodyIndent = defLineIndentation + '    ';
					}

					// Find end of block: first line with indent less than or equal to the function's own indent
					let bodyEndIndex = lines.length;
					for (let i = bodyStartIndex; i < lines.length; i++) {
						const line = lines[i];
						if (line.trim() !== '' && !line.startsWith(bodyIndent)) {
							bodyEndIndex = i;
							break;
						}
					}

					const newBody = args.new_content.split('\n').map(l => (l ? `${bodyIndent}${l}` : '')).join('\n');

					const beforeContent = fileContent.substring(0, defLineEndIndex);
					const afterContent = lines.slice(bodyEndIndex).join('\n');

					newFileContent = `${beforeContent}\n${newBody}\n${afterContent}`;
					break;
				}

				case 'rename_variable':
					this.logService.warn('[CodeModifyTool] "rename_variable" is a naive implementation and does not understand scope. Use with caution.');
					if (!args.target_name || !args.new_content) {
						return { result: 'Error: target_name and new_content are required for rename_variable operation.', isError: true };
					}
					// Naive, scope-unaware replacement.
					const renameRegex = new RegExp(`\\b${args.target_name}\\b`, 'g');
					newFileContent = fileContent.replace(renameRegex, args.new_content);
					break;

				default:
					return { result: `Error: Unsupported operation '${args.operation}'.`, isError: true };
			}

			if (newFileContent !== fileContent) {
				await this.fileService.writeFile(fileUri, VSBuffer.fromString(newFileContent));
				return { result: `Successfully applied operation '${args.operation}' to file '${args.file_path}'.` };
			} else {
				return { result: `Operation '${args.operation}' resulted in no changes to the file.` };
			}

		} catch (e: any) {
			this.logService.error(`[CodeModifyTool] Error processing file ${args.file_path}:`, e);
			return { result: `Error processing file: ${e.message}`, isError: true };
		}
	}
}
