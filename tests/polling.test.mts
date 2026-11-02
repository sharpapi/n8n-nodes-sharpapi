import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';

import { SharpApiResumeParser } from '../nodes/SharpApiResumeParser/SharpApiResumeParser.node';

import {
	createMockExecuteFunctions,
	dispatched,
	httpError,
	jobStatus,
	rateLimited,
	runWithTimers,
} from './helpers/mock-execute';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base = { binaryPropertyName: 'data' };

describe('polling', () => {
	it('polls the per-endpoint status URL, not the one the response advertises', async () => {
		// The 202 advertises /api/v1/job/status/{uuid}, which is 5 path segments
		// and therefore returns `result` as an escaped JSON string. The
		// per-endpoint URL is 7 segments and returns decoded JSON, so that is the
		// one worth polling.
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), jobStatus('success', { result: {} })],
		});

		await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(context.calls[1].method).toBe('GET');
		expect(context.calls[1].url).toBe(
			'https://sharpapi.com/api/v1/hr/parse_resume/job/status/abc-123',
		);
		expect(new URL(context.calls[1].url as string).pathname.split('/').filter(Boolean)).toHaveLength(
			7,
		);
	});

	it('builds the status URL under a custom base URL too', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			credentials: { apiKey: 'k', baseUrl: 'https://eu.sharpapi.com/api/v1/' },
			responses: [dispatched(), jobStatus('success', { result: {} })],
		});

		await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(context.calls[1].url).toBe(
			'https://eu.sharpapi.com/api/v1/hr/parse_resume/job/status/abc-123',
		);
	});

	it('percent-encodes the job id', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [
				{ status_url: 'https://sharpapi.com/api/v1/job/status/x', job_id: 'a b/c' },
				jobStatus('success', { result: {} }),
			],
		});

		await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(context.calls[1].url).toBe(
			'https://sharpapi.com/api/v1/hr/parse_resume/job/status/a%20b%2Fc',
		);
	});

	it('falls back to the advertised status URL when no job id comes back', async () => {
		// Then the result arrives as a string, which is what parseResult is for.
		const statusUrl = 'https://sharpapi.com/api/v1/job/status/abc-123';

		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [
				{ status_url: statusUrl },
				jobStatus('success', { result: '{"candidate_name":"Alice"}' }),
			],
		});

		const [items] = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		);

		expect(context.calls[1].url).toBe(statusUrl);
		expect(items[0].json).toEqual({ candidate_name: 'Alice' });
	});

	it('keeps polling through new and pending, then stops on success', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [
				dispatched(),
				jobStatus('new'),
				jobStatus('pending'),
				jobStatus('success', { result: '{"candidate_name":"Alice"}' }),
			],
		});

		const [items] = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		);

		expect(context.calls).toHaveLength(4);
		expect(items[0].json).toEqual({ candidate_name: 'Alice' });
	});

	it('throws a NodeOperationError when the job fails', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), jobStatus('failed', { error: 'The document was unreadable' })],
		});

		await expect(
			runWithTimers(new SharpApiResumeParser().execute.call(context as never)),
		).rejects.toBeInstanceOf(NodeOperationError);
	});

	it('reports the failure reason from `error`, which is where the API puts it', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), jobStatus('failed', { error: 'The document was unreadable' })],
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect((error as NodeOperationError).description).toBe('The document was unreadable');
	});

	it('falls back to a generic reason when the API sends no error text', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), jobStatus('failed')],
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect((error as NodeOperationError).description).toContain('not charged');
	});
});

describe('poll pacing', () => {
	it('uses the configured interval when no Retry-After header is present', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 7 } },
			responses: [dispatched(), jobStatus('pending'), jobStatus('success', { result: '{}' })],
		});

		const promise = new SharpApiResumeParser().execute.call(context as never);

		// First poll lands only after the configured interval.
		await vi.advanceTimersByTimeAsync(6_999);
		expect(context.calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(context.calls).toHaveLength(2);

		await runWithTimers(promise);
	});

	it('honours Retry-After over the configured interval', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 30 } },
			responses: [
				dispatched(),
				jobStatus('pending', { retryAfter: 2 }),
				jobStatus('success', { result: '{}' }),
			],
		});

		const promise = new SharpApiResumeParser().execute.call(context as never);

		// The first sleep still uses pollInterval, since no header has been seen.
		await vi.advanceTimersByTimeAsync(30_000);
		expect(context.calls).toHaveLength(2);

		// The second waits 2s, from the header, not the configured 30s.
		await vi.advanceTimersByTimeAsync(2_000);
		expect(context.calls).toHaveLength(3);

		await runWithTimers(promise);
	});

	it('ignores an unparseable Retry-After and keeps the configured interval', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 5 } },
			responses: [
				dispatched(),
				jobStatus('pending', { retryAfter: 'Wed, 21 Oct 2026 07:28:00 GMT' }),
				jobStatus('success', { result: '{}' }),
			],
		});

		const promise = new SharpApiResumeParser().execute.call(context as never);

		await vi.advanceTimersByTimeAsync(5_000);
		expect(context.calls).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(4_999);
		expect(context.calls).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(context.calls).toHaveLength(3);

		await runWithTimers(promise);
	});

	it('gives up once maxWait is exhausted instead of looping forever', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 5, maxWait: 20 } },
			// Always pending: the loop must terminate on its own.
			responses: Array.from({ length: 12 }, (_unused, index) =>
				index === 0 ? dispatched() : jobStatus('pending'),
			),
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('did not finish within 20 seconds');
		// 20s budget at 5s per poll: four polls, then it stops.
		expect(context.calls).toHaveLength(5);
	});
});

describe('rate limiting', () => {
	it('waits and retries on a 429 instead of failing the job', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 5 } },
			responses: [
				dispatched(),
				rateLimited(2),
				jobStatus('success', { result: { candidate_name: 'Alice' } }),
			],
		});

		const promise = new SharpApiResumeParser().execute.call(context as never);

		await vi.advanceTimersByTimeAsync(5_000);
		expect(context.calls).toHaveLength(2); // first poll, rate limited

		// Retry-After from the 429 wins over the configured 5s interval.
		await vi.advanceTimersByTimeAsync(2_000);
		expect(context.calls).toHaveLength(3);

		const [items] = await runWithTimers(promise);
		expect(items[0].json).toEqual({ candidate_name: 'Alice' });
	});

	it('falls back to the poll interval when a 429 carries no Retry-After', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 3 } },
			responses: [dispatched(), rateLimited(), jobStatus('success', { result: {} })],
		});

		const promise = new SharpApiResumeParser().execute.call(context as never);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(context.calls).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(2_999);
		expect(context.calls).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(context.calls).toHaveLength(3);

		await runWithTimers(promise);
	});

	it('a 429 still counts against maxWait rather than looping forever', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: { pollInterval: 5, maxWait: 20 } },
			responses: Array.from({ length: 12 }, (_unused, index) =>
				index === 0 ? dispatched() : rateLimited(5),
			),
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('did not finish within 20 seconds');
	});

	it('aborts on a non-429 error status', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), httpError(402, { code: 'GEN-PAYMENT-REQUIRED' })],
		});

		await expect(
			runWithTimers(new SharpApiResumeParser().execute.call(context as never)),
		).rejects.toThrow();
	});
});

describe('result decoding', () => {
	it('parses the escaped JSON string the short status URL returns', async () => {
		// /api/v1/job/status/{uuid} is 5 segments, so the API serves
		// ApiJobTransformerResult, which hands back response_body unparsed.
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [
				dispatched(),
				jobStatus('success', { result: '{"candidate_name":"Alice","years_of_experience":8}' }),
			],
		});

		const [items] = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		);

		expect(items[0].json).toEqual({ candidate_name: 'Alice', years_of_experience: 8 });
	});

	it('passes an already-decoded result through untouched', async () => {
		// The long status URL handed to whitelabel keys decodes it server-side.
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), jobStatus('success', { result: { candidate_name: 'Alice' } })],
		});

		const [items] = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		);

		expect(items[0].json).toEqual({ candidate_name: 'Alice' });
	});

	it('raises a readable error when the result is not JSON at all', async () => {
		const context = createMockExecuteFunctions({
			params: { ...base, options: {} },
			responses: [dispatched(), jobStatus('success', { result: '<html>gateway timeout</html>' })],
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('not valid JSON');
	});
});
