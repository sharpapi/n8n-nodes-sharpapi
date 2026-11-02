/**
 * A minimal stand-in for n8n's IExecuteFunctions, covering exactly the surface
 * the generated nodes touch. Kept at the monorepo root on purpose: the packages
 * ship with zero dependencies and carry no test tooling of their own.
 */
import { vi } from 'vitest';
import type { IDataObject } from 'n8n-workflow';

export interface HttpCall {
	method?: string;
	url?: string;
	headers?: Record<string, unknown>;
	body?: unknown;
	json?: boolean;
	returnFullResponse?: boolean;
}

/** A scripted reply. Returned in order, one per HTTP call. */
export type Responder = (options: HttpCall) => unknown;

export interface MockOptions {
	/** Node parameters, keyed by the name the node asks for. */
	params?: Record<string, unknown>;
	/** Input items. Defaults to a single empty item. */
	items?: Array<{ json: IDataObject }>;
	/** Replies handed back in order, one per HTTP call. */
	responses?: Array<unknown | Responder>;
	/** Whether the node should swallow errors into an { error } item. */
	continueOnFail?: boolean;
	/** Binary payload returned by assertBinaryData / getBinaryDataBuffer. */
	binary?: { mimeType?: string; fileName?: string; contents?: string } | null;
	credentials?: IDataObject;
}

export interface MockContext {
	calls: HttpCall[];
	getInputData: () => Array<{ json: IDataObject }>;
	getNodeParameter: (name: string, index: number, fallback?: unknown) => unknown;
	getNode: () => { name: string; type: string; typeVersion: number };
	getCredentials: (name: string) => Promise<IDataObject>;
	continueOnFail: () => boolean;
	helpers: {
		httpRequestWithAuthentication: (credentialsName: string, options: HttpCall) => Promise<unknown>;
		assertBinaryData: (index: number, property: string) => IDataObject;
		getBinaryDataBuffer: (index: number, property: string) => Promise<Buffer>;
	};
}

export function createMockExecuteFunctions(options: MockOptions = {}): MockContext {
	const {
		params = {},
		items = [{ json: {} }],
		responses = [],
		continueOnFail = false,
		binary = { mimeType: 'application/pdf', fileName: 'cv.pdf', contents: '%PDF-1.4 test' },
		credentials = { apiKey: 'test-key', baseUrl: 'https://sharpapi.com/api/v1' },
	} = options;

	const calls: HttpCall[] = [];
	const queue = [...responses];

	const context: MockContext = {
		calls,

		getInputData: () => items,

		getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,

		getNode: () => ({ name: 'SharpAPI', type: 'test', typeVersion: 1 }),

		getCredentials: async () => credentials,

		continueOnFail: () => continueOnFail,

		helpers: {
			httpRequestWithAuthentication: async (_credentialsName: string, httpOptions: HttpCall) => {
				calls.push(httpOptions);

				if (queue.length === 0) {
					throw new Error(
						`Unexpected HTTP call ${String(httpOptions.method)} ${String(httpOptions.url)}: no scripted response left`,
					);
				}

				const next = queue.shift();
				const value = typeof next === 'function' ? (next as Responder)(httpOptions) : next;

				// A scripted Error means "the transport failed", which is how n8n
				// surfaces a non-2xx response to the node.
				if (value instanceof Error) throw value;

				return value;
			},

			assertBinaryData: (_index: number, property: string) => {
				if (!binary) {
					throw new Error(
						`The item has no binary field called "${property}". Set "Input Data Field Name" to the field holding the file.`,
					);
				}
				return {
					mimeType: binary.mimeType,
					fileName: binary.fileName,
				} as unknown as IDataObject;
			},

			getBinaryDataBuffer: async () => Buffer.from(binary?.contents ?? ''),
		},
	};

	return context;
}

/** A 202 dispatch reply, as returned by every SharpAPI submit endpoint. */
export function dispatched(statusUrl = 'https://sharpapi.com/api/v1/job/status/abc-123') {
	return { status_url: statusUrl, job_id: 'abc-123' };
}

/** A job status reply in the JSON:API envelope the status endpoint uses. */
export function jobStatus(
	status: string,
	extra: { result?: unknown; error?: string; retryAfter?: number | string } = {},
) {
	const attributes: IDataObject = { status, type: 'test_job' };

	if ('result' in extra) attributes.result = extra.result as IDataObject;
	if (extra.error !== undefined) attributes.error = extra.error;

	const headers: Record<string, unknown> = {};
	if (extra.retryAfter !== undefined) headers['retry-after'] = extra.retryAfter;

	return {
		statusCode: 200,
		headers,
		body: { data: { type: 'api_job', id: 'abc-123', attributes } },
	};
}

/** A rate-limit reply, which the poll loop treats as "wait", not "fail". */
export function rateLimited(retryAfter?: number) {
	return {
		statusCode: 429,
		headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter },
		body: { message: 'Too Many Attempts.' },
	};
}

/** Any other non-2xx status, which should abort the poll. */
export function httpError(statusCode: number, body: unknown = { message: 'nope' }) {
	return { statusCode, headers: {}, body };
}

/**
 * Runs a node's execute() to completion, draining the fake timer queue that the
 * polling loop's sleep() calls sit on.
 */
export async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
	const settled = promise.then(
		(value) => ({ ok: true as const, value }),
		(error) => ({ ok: false as const, error }),
	);

	await vi.runAllTimersAsync();

	const outcome = await settled;
	if (outcome.ok) return outcome.value;
	throw outcome.error;
}
