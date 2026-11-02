import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { sharpApiPoll, sharpApiUpload, toNodeError } from '../shared/GenericFunctions';
import { LANGUAGE_OPTIONS } from '../shared/Languages';

const ENDPOINT = '/hr/resume_job_match_score';

export class SharpApiResumeJobMatchScore implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Resume Job Match Score',
		name: 'sharpApiResumeJobMatchScore',
		icon: { light: 'file:resume-job-match-score.svg', dark: 'file:resume-job-match-score.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["binaryPropertyName"]}}',
		description: 'Score a resume against a job description across 20 dimensions with AI, powered by SharpAPI',
		usableAsTool: true,
		defaults: {
			name: 'Resume Job Match Score',
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
				{
					displayName: 'Input Data Field Name',
					name: 'binaryPropertyName',
					type: 'string',
					default: 'data',
					required: true,
					description: 'Name of the field in the input item that contains the file to send to SharpAPI'
				},
				{
					displayName: 'Job Description',
					name: 'content',
					type: 'string',
					typeOptions: {
						rows: 6
					},
					default: '',
					required: true,
					description: 'Full text of the job description the resume is scored against'
				},
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
							displayName: 'Scoring Context',
							name: 'context',
							type: 'string',
							typeOptions: {
								rows: 4
							},
							default: '',
							description: 'Extra scoring directives, one per line, max 5000 characters. Supported prefixes: EMPHASIZE:, DEEMPHASIZE:, CREDIT:.'
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
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const simplify = options.simplify !== false;
				const pollInterval = (options.pollInterval as number) ?? 5;
				const maxWait = (options.maxWait as number) ?? 300;

				const fields: IDataObject = {};

				if (options.language) {
					fields.language = options.language;
				}

				fields.content = this.getNodeParameter('content', i) as string;

				const context = options.context as string | undefined;
				if (context) {
					const value = context;
					if (value.length > 5000) {
						throw new NodeOperationError(
							this.getNode(),
							'Scoring Context exceeds the 5000 character limit accepted by SharpAPI',
							{ itemIndex: i },
						);
					}
					fields.context = value;
				}

				const statusUrl = await sharpApiUpload.call(
					this,
					ENDPOINT,
					i,
					binaryPropertyName,
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
