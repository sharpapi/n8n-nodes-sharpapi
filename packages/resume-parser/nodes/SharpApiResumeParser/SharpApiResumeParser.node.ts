import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	FILE_INPUT_PROPERTIES,
	sharpApiPoll,
	sharpApiUpload,
	toNodeError,
} from '../shared/GenericFunctions';
import { LANGUAGE_OPTIONS } from '../shared/Languages';

const ENDPOINT = '/hr/parse_resume';

export class SharpApiResumeParser implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Resume Parser',
		name: 'sharpApiResumeParser',
		icon: { light: 'file:resume-parser.svg', dark: 'file:resume-parser.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["inputType"] === "url" ? "From URL" : "From binary field"}}',
		description: 'Parse resumes and CVs into structured JSON with AI, powered by SharpAPI',
		usableAsTool: true,
		defaults: {
			name: 'Resume Parser',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'sharpApiApi',
				required: true,
			},
		],
		properties: [
				...FILE_INPUT_PROPERTIES,
				{
					displayName: 'Options',
					name: 'options',
					type: 'collection',
					placeholder: 'Add option',
					default: {},
					options: [
						{
							displayName: 'Max Wait Time (Seconds)',
							name: 'maxWait',
							type: 'number',
							typeOptions: {
								minValue: 10
							},
							default: 300,
							description: 'How long to keep polling before the node fails'
						},
						{
							displayName: 'Output Language',
							name: 'language',
							type: 'options',
							options: LANGUAGE_OPTIONS,
							default: 'English',
							description: 'Language the results are returned in'
						},
						{
							displayName: 'Poll Interval (Seconds)',
							name: 'pollInterval',
							type: 'number',
							typeOptions: {
								minValue: 1
							},
							default: 5,
							description: 'How long to wait between job status checks when the API sends no Retry-After header'
						},
						{
							displayName: 'Simplify Output',
							name: 'simplify',
							type: 'boolean',
							default: true,
							description: 'Whether to return only the parsed result instead of the full job envelope'
						}
					]
				}
			],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const simplify = options.simplify !== false;
				const pollInterval = (options.pollInterval as number) ?? 5;
				const maxWait = (options.maxWait as number) ?? 300;

				const fields: IDataObject = {};

				if (options.language) {
					fields.language = options.language;
				}

				const statusUrl = await sharpApiUpload.call(
					this,
					ENDPOINT,
					i,
					fields,
				);

				const attributes = await sharpApiPoll.call(this, statusUrl, i, pollInterval, maxWait);

				if (!simplify) {
					returnData.push({ json: attributes, pairedItem: { item: i } });
					continue;
				}

				returnData.push({
					json: (attributes.result ?? {}) as IDataObject,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw toNodeError.call(this, error, i);
			}
		}

		return [returnData];
	}
}
