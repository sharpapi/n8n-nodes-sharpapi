import type {
	IExecuteFunctions,
	IDataObject,
	IHttpRequestMethods,
	INodeProperties,
	JsonObject,
	GenericValue,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

import { CREDENTIALS_NAME, DEFAULT_BASE_URL } from './Config';

/** Statuses returned by the SharpAPI job status endpoint. */
const TERMINAL_STATUSES = ['success', 'failed'];

/** Anything that may legally sit in an IDataObject field. */
type JobResult = IDataObject | GenericValue | GenericValue[] | IDataObject[];

export async function getBaseUrl(this: IExecuteFunctions): Promise<string> {
	const credentials = await this.getCredentials(CREDENTIALS_NAME);
	const baseUrl = (credentials.baseUrl as string) || DEFAULT_BASE_URL;
	return baseUrl.replace(/\/+$/, '');
}

/**
 * Plain JSON request against SharpAPI (used for the quota operation).
 */
export async function sharpApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
): Promise<IDataObject> {
	const baseUrl = await getBaseUrl.call(this);

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIALS_NAME, {
			method,
			url: `${baseUrl}${endpoint}`,
			headers: { Accept: 'application/json' },
			json: true,
		})) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Where the node takes its file from. Shared by every node.
 *
 * File URL exists for AI Agent tool use: n8n starts a tool node with only the
 * arguments the model chose, never the binary data of the conversation, so a
 * tool can only reach a file the model can name.
 */
export const FILE_INPUT_PROPERTIES: INodeProperties[] = [
	{
		displayName: 'Input Type',
		name: 'inputType',
		type: 'options',
		options: [
			{
				name: 'Binary File',
				value: 'binary',
				description: 'A file from a previous node, such as Read Files From Disk or a form upload',
			},
			{
				name: 'File URL',
				value: 'url',
				description: 'A publicly reachable URL the node downloads the file from. Use this when the node runs as an AI Agent tool.',
			},
		],
		default: 'binary',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { inputType: ['binary'] } },
		description: 'Name of the field in the input item that contains the file to send to SharpAPI',
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/document.pdf',
		displayOptions: { show: { inputType: ['url'] } },
		description: 'HTTP or HTTPS URL of the file to send to SharpAPI',
	},
];

interface InputFile {
	buffer: Buffer;
	mimeType: string;
	fileName: string;
}

/** Last path segment of a URL, if it looks like a file name. */
function fileNameFromUrl(url: URL): string {
	const last = decodeURIComponent(url.pathname.split('/').pop() ?? '');
	return last.includes('.') ? last : 'upload';
}

/**
 * Reads the file the node was pointed at, from binary data or a URL.
 *
 * The download uses the plain httpRequest helper, never the authenticated one,
 * so the SharpAPI key is not sent to whatever host the URL names.
 */
async function getInputFile(this: IExecuteFunctions, itemIndex: number): Promise<InputFile> {
	const inputType = this.getNodeParameter('inputType', itemIndex, 'binary') as string;

	if (inputType !== 'url') {
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
		const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
		return {
			buffer: await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName),
			mimeType: binaryData.mimeType || 'application/octet-stream',
			fileName: binaryData.fileName ?? 'upload',
		};
	}

	const raw = (this.getNodeParameter('fileUrl', itemIndex) as string).trim();
	let url: URL | undefined;
	try {
		url = new URL(raw);
	} catch {
		// handled below
	}

	if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
		throw new NodeOperationError(this.getNode(), `"${raw}" is not an HTTP or HTTPS URL`, {
			itemIndex,
			description: 'Set "File URL" to a full address starting with http:// or https://.',
		});
	}

	let response;
	try {
		response = await this.helpers.httpRequest({
			method: 'GET',
			url: url.href,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		});
	} catch (error) {
		throw new NodeOperationError(this.getNode(), `Could not download the file at ${url.href}`, {
			itemIndex,
			description: `${(error as Error).message}. Check that the URL is publicly reachable from this n8n instance.`,
		});
	}

	const contentType = String((response.headers as IDataObject)?.['content-type'] ?? '');
	return {
		buffer: Buffer.from(response.body as ArrayBuffer),
		mimeType: contentType.split(';')[0].trim() || 'application/octet-stream',
		fileName: fileNameFromUrl(url),
	};
}

/**
 * Uploads the node's input file as multipart/form-data and returns the URL to
 * poll.
 *
 * n8n sets the multipart boundary itself when the body is a FormData instance,
 * so the Content-Type header must not be set manually.
 *
 * The returned URL is deliberately NOT the `status_url` from the response. See
 * jobStatusUrl below for why.
 */
export async function sharpApiUpload(
	this: IExecuteFunctions,
	endpoint: string,
	itemIndex: number,
	fields: IDataObject,
): Promise<string> {
	const baseUrl = await getBaseUrl.call(this);
	const file = await getInputFile.call(this, itemIndex);

	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.fileName);

	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined && value !== null && value !== '') {
			form.append(key, String(value));
		}
	}

	let response: IDataObject;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIALS_NAME, {
			method: 'POST',
			url: `${baseUrl}${endpoint}`,
			headers: { Accept: 'application/json' },
			body: form,
			json: true,
		})) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	const jobId = response.job_id as string | undefined;
	const statusUrl = response.status_url as string | undefined;

	if (jobId) {
		return jobStatusUrl(baseUrl, endpoint, jobId);
	}

	// Only reachable if the API stops returning job_id. The generic status URL
	// still works, it just needs the result decoded afterwards.
	if (statusUrl) {
		return statusUrl;
	}

	throw new NodeOperationError(
		this.getNode(),
		'SharpAPI accepted the file but did not say where to collect the result',
		{ itemIndex, description: JSON.stringify(response) },
	);
}

/**
 * Builds the per-endpoint job status URL.
 *
 * SharpAPI exposes the same job under two status URLs, and they return the
 * result differently. `ApiJobController::status()` picks its transformer by
 * counting path segments:
 *
 *   /api/v1/job/status/{uuid}                       5 segments -> result is an
 *                                                   escaped JSON *string*
 *   /api/v1/hr/parse_resume/job/status/{uuid}       7 segments -> result is
 *                                                   already decoded JSON
 *
 * The 202 response advertises the short one, so following `status_url` verbatim
 * means always receiving a string and re-parsing it. The per-endpoint URL is
 * built here instead: it is registered for every job type in routes/api.php with
 * no extra conditions, carries `Retry-After` on pending polls exactly like the
 * short one, and hands back real objects and arrays.
 *
 * The path is identical to the submit endpoint, so nothing extra has to be
 * configured per node.
 *
 * Note that `/job/result/{uuid}` is NOT the endpoint to use. Despite the name it
 * returns the result as a string for everyone except marketplace keys, and it
 * 404s until the job has succeeded, so it cannot drive a polling loop.
 */
function jobStatusUrl(baseUrl: string, endpoint: string, jobId: string): string {
	return `${baseUrl}${endpoint}/job/status/${encodeURIComponent(jobId)}`;
}

/**
 * Turns whatever reached a catch block into an error n8n can present.
 *
 * Errors raised deliberately already carry node context and a useful
 * description, so they are passed through untouched; wrapping them again would
 * replace that description with a generic one. Anything else is unexpected and
 * gets wrapped so the workflow shows which item failed.
 */
export function toNodeError(this: IExecuteFunctions, error: unknown, itemIndex: number): Error {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		return error;
	}

	return new NodeOperationError(this.getNode(), error as Error, { itemIndex });
}

/**
 * Normalises the `result` attribute of a finished job into real JSON.
 *
 * Polling goes through the per-endpoint status URL, which already returns
 * decoded JSON, so in normal operation this is a no-op. It stays as a safety
 * net for the one path that still yields a string: the fallback in
 * sharpApiUpload that follows `status_url` when the response carries no job id.
 */
function parseResult(this: IExecuteFunctions, result: JobResult, itemIndex: number): JobResult {
	if (typeof result !== 'string') {
		return result;
	}

	const trimmed = result.trim();

	if (trimmed === '') {
		return result;
	}

	try {
		return JSON.parse(trimmed) as JobResult;
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'SharpAPI returned a job result that is not valid JSON',
			{
				itemIndex,
				description: `Received: ${trimmed.slice(0, 200)}`,
			},
		);
	}
}

/**
 * Extracts the reason a job failed. The API reports it in `error`; `result` is
 * only checked as a fallback, and never when it is an object, because a
 * stringified object makes a useless error message.
 */
function describeFailure(attributes: IDataObject): string | undefined {
	const { error, result } = attributes;

	if (typeof error === 'string' && error.trim() !== '') {
		return error;
	}

	if (typeof result === 'string' && result.trim() !== '') {
		return result;
	}

	return undefined;
}

/** Reads Retry-After, which n8n lowercases, and ignores the HTTP-date form. */
function retryAfterSeconds(headers: IDataObject): number | undefined {
	const value = Number(headers['retry-after'] ?? headers['Retry-After']);
	return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Polls a SharpAPI job status URL until the job reaches a terminal state.
 *
 * Honours Retry-After both on pending polls and on 429 responses, falls back to
 * pollInterval, and gives up after maxWait seconds.
 */
export async function sharpApiPoll(
	this: IExecuteFunctions,
	statusUrl: string,
	itemIndex: number,
	pollInterval: number,
	maxWait: number,
): Promise<IDataObject> {
	const interval = Math.max(1, pollInterval);
	let waited = 0;
	let delay = interval;

	while (waited < maxWait) {
		await sleep(delay * 1000);
		waited += delay;

		let response;
		try {
			response = await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIALS_NAME, {
				method: 'GET',
				url: statusUrl,
				headers: { Accept: 'application/json' },
				json: true,
				returnFullResponse: true,
				// A 429 is not a failure, it is an instruction to wait. Handled below
				// rather than thrown, so a busy account does not lose the job.
				ignoreHttpStatusErrors: true,
			});
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
		}

		const headers = (response.headers ?? {}) as IDataObject;
		const statusCode = response.statusCode ?? 200;

		if (statusCode === 429) {
			delay = retryAfterSeconds(headers) ?? interval;
			continue;
		}

		if (statusCode >= 400) {
			throw new NodeApiError(
				this.getNode(),
				(response.body ?? {}) as JsonObject,
				{ itemIndex, httpCode: String(statusCode) },
			);
		}

		const body = (response.body ?? {}) as IDataObject;
		const attributes = ((body.data as IDataObject)?.attributes ?? {}) as IDataObject;
		const status = attributes.status as string | undefined;

		if (status && TERMINAL_STATUSES.includes(status)) {
			if (status === 'failed') {
				throw new NodeOperationError(this.getNode(), 'The SharpAPI job failed', {
					itemIndex,
					description:
						describeFailure(attributes) ??
						'No result was returned. Failed jobs are not charged.',
				});
			}

			attributes.result = parseResult.call(this, attributes.result, itemIndex);

			return attributes;
		}

		delay = retryAfterSeconds(headers) ?? interval;
	}

	throw new NodeOperationError(
		this.getNode(),
		`The SharpAPI job did not finish within ${maxWait} seconds`,
		{
			itemIndex,
			description:
				'Increase "Max Wait Time" in the node options, or split large documents into smaller batches.',
		},
	);
}
