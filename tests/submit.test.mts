import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { SharpApiResumeParser } from '../nodes/SharpApiResumeParser/SharpApiResumeParser.node';
import { SharpApiResumeJobMatchScore } from '../nodes/SharpApiResumeJobMatchScore/SharpApiResumeJobMatchScore.node';
import { SharpApiInvoiceParser } from '../nodes/SharpApiInvoiceParser/SharpApiInvoiceParser.node';

import {
	createMockExecuteFunctions,
	dispatched,
	jobStatus,
	runWithTimers,
} from './helpers/mock-execute';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('submitting a job', () => {
	it('posts the file to the endpoint the spec declares', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeParser();
		await runWithTimers(node.execute.call(context as never));

		const submit = context.calls[0];
		expect(submit.method).toBe('POST');
		expect(submit.url).toBe('https://sharpapi.com/api/v1/hr/parse_resume');
	});

	it('sends a FormData body carrying the file under the "file" key', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
			binary: { mimeType: 'application/pdf', fileName: 'alice-cv.pdf', contents: '%PDF-1.4' },
		});

		const node = new SharpApiResumeParser();
		await runWithTimers(node.execute.call(context as never));

		const body = context.calls[0].body as FormData;
		expect(body).toBeInstanceOf(FormData);

		const file = body.get('file') as File;
		expect(file).toBeInstanceOf(Blob);
		expect(file.type).toBe('application/pdf');
		expect(await file.text()).toBe('%PDF-1.4');
		// The filename is what SharpAPI echoes back in the job record.
		expect((file as File).name).toBe('alice-cv.pdf');
	});

	it('never sets Content-Type by hand, so the multipart boundary survives', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeParser();
		await runWithTimers(node.execute.call(context as never));

		const headerNames = Object.keys(context.calls[0].headers ?? {}).map((name) =>
			name.toLowerCase(),
		);
		expect(headerNames).not.toContain('content-type');
		expect(context.calls[0].headers).toMatchObject({ Accept: 'application/json' });
	});

	it('omits optional text fields that were left empty', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeParser();
		await runWithTimers(node.execute.call(context as never));

		const body = context.calls[0].body as FormData;
		expect(body.get('language')).toBeNull();
	});

	it('sends the language option when the user adds it', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: { language: 'Polish' } },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeParser();
		await runWithTimers(node.execute.call(context as never));

		expect((context.calls[0].body as FormData).get('language')).toBe('Polish');
	});
});

describe('match score field names', () => {
	it('sends the job description as "content", not "job_description"', async () => {
		const context = createMockExecuteFunctions({
			params: {
				binaryPropertyName: 'data',
				content: 'Senior TypeScript engineer, remote, 5+ years',
				options: {},
			},
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeJobMatchScore();
		await runWithTimers(node.execute.call(context as never));

		const body = context.calls[0].body as FormData;
		expect(body.get('content')).toBe('Senior TypeScript engineer, remote, 5+ years');
		expect(body.get('job_description')).toBeNull();
	});

	it('sends the scoring context as "context" when supplied', async () => {
		const context = createMockExecuteFunctions({
			params: {
				binaryPropertyName: 'data',
				content: 'A role',
				options: { context: 'EMPHASIZE: Kubernetes' },
			},
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeJobMatchScore();
		await runWithTimers(node.execute.call(context as never));

		expect((context.calls[0].body as FormData).get('context')).toBe('EMPHASIZE: Kubernetes');
	});

	it('posts to the match score endpoint', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', content: 'A role', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeJobMatchScore();
		await runWithTimers(node.execute.call(context as never));

		expect(context.calls[0].url).toBe('https://sharpapi.com/api/v1/hr/resume_job_match_score');
	});
});

describe('invoice submission', () => {
	it('posts to the invoice endpoint', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '[]' })],
		});

		const node = new SharpApiInvoiceParser();
		await runWithTimers(node.execute.call(context as never));

		expect(context.calls[0].url).toBe('https://sharpapi.com/api/v1/finance/parse_invoice');
	});

	it('never sends a language field, because the endpoint ignores it', async () => {
		// The backend's ParseInvoiceStoreRequest validates `file` only, and
		// buildInvoicePrompt() never reads a language. Offering the option would
		// be a control that silently does nothing.
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: { language: 'Polish' } },
			responses: [dispatched(), jobStatus('success', { result: '[]' })],
		});

		const node = new SharpApiInvoiceParser();
		await runWithTimers(node.execute.call(context as never));

		expect((context.calls[0].body as FormData).get('language')).toBeNull();
	});

	it('does not offer an Output Language option in the node UI', () => {
		const node = new SharpApiInvoiceParser();
		const optionNames = node.description.properties
			.filter((property) => property.name === 'options')
			.flatMap((property) => (property.options ?? []) as Array<{ name?: string }>)
			.map((option) => option.name);

		expect(optionNames).not.toContain('language');
	});
});

describe('credential wiring', () => {
	it('honours a custom base URL and strips its trailing slash', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			credentials: { apiKey: 'k', baseUrl: 'https://eu.sharpapi.com/api/v1/' },
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		const node = new SharpApiResumeParser();
		await runWithTimers(node.execute.call(context as never));

		expect(context.calls[0].url).toBe('https://eu.sharpapi.com/api/v1/hr/parse_resume');
	});
});
