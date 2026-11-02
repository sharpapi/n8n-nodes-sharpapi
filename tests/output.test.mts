import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';

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

const TWO_INVOICES = JSON.stringify([
	{ document: { number: 'INV-1' }, financials: { total: 100 } },
	{ document: { number: 'INV-2' }, financials: { total: 250 } },
]);

describe('item shape', () => {
	it('emits one item per invoice found in the file', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: TWO_INVOICES })],
		});

		const [items] = await runWithTimers(new SharpApiInvoiceParser().execute.call(context as never));

		expect(items).toHaveLength(2);
		expect(items[0].json).toMatchObject({ document: { number: 'INV-1' } });
		expect(items[1].json).toMatchObject({ document: { number: 'INV-2' } });
		expect(items[0].pairedItem).toEqual({ item: 0 });
	});

	it('still emits one item when the file holds a single invoice', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [
				dispatched(),
				jobStatus('success', { result: JSON.stringify([{ document: { number: 'INV-9' } }]) }),
			],
		});

		const [items] = await runWithTimers(new SharpApiInvoiceParser().execute.call(context as never));

		expect(items).toHaveLength(1);
		expect(items[0].json).toMatchObject({ document: { number: 'INV-9' } });
	});

	it('emits exactly one item from the resume parser', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [
				dispatched(),
				jobStatus('success', { result: '{"candidate_name":"Alice","positions":[{},{}]}' }),
			],
		});

		const [items] = await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(items).toHaveLength(1);
	});

	it('emits exactly one item from the match score node', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', content: 'A role', options: {} },
			responses: [
				dispatched(),
				jobStatus('success', { result: '{"match_scores":{"overall_match":72}}' }),
			],
		});

		const [items] = await runWithTimers(
			new SharpApiResumeJobMatchScore().execute.call(context as never),
		);

		expect(items).toHaveLength(1);
		expect(items[0].json).toMatchObject({ match_scores: { overall_match: 72 } });
	});

	it('emits one output item per input item', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			items: [{ json: {} }, { json: {} }],
			responses: [
				dispatched(),
				jobStatus('success', { result: '{"candidate_name":"Alice"}' }),
				dispatched(),
				jobStatus('success', { result: '{"candidate_name":"Bob"}' }),
			],
		});

		const [items] = await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(items).toHaveLength(2);
		expect(items[1].pairedItem).toEqual({ item: 1 });
	});
});

describe('Simplify Output', () => {
	it('returns the full job envelope when turned off', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: { simplify: false } },
			responses: [dispatched(), jobStatus('success', { result: '{"candidate_name":"Alice"}' })],
		});

		const [items] = await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(items).toHaveLength(1);
		expect(items[0].json).toMatchObject({
			status: 'success',
			type: 'test_job',
			result: { candidate_name: 'Alice' },
		});
	});

	it('decodes the result even inside the full envelope', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: { simplify: false } },
			responses: [dispatched(), jobStatus('success', { result: TWO_INVOICES })],
		});

		const [items] = await runWithTimers(new SharpApiInvoiceParser().execute.call(context as never));

		expect(Array.isArray((items[0].json as { result: unknown }).result)).toBe(true);
	});

	it('returns only the result by default', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('success', { result: '{"candidate_name":"Alice"}' })],
		});

		const [items] = await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(items[0].json).not.toHaveProperty('status');
	});
});

describe('error handling', () => {
	it('turns a failure into an { error } item when Continue On Fail is set', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			continueOnFail: true,
			responses: [dispatched(), jobStatus('failed', { error: 'Unreadable document' })],
		});

		const [items] = await runWithTimers(new SharpApiResumeParser().execute.call(context as never));

		expect(items).toHaveLength(1);
		expect(items[0].json).toHaveProperty('error');
		expect((items[0].json as { error: string }).error).toContain('failed');
	});

	it('throws instead when Continue On Fail is not set', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [dispatched(), jobStatus('failed', { error: 'Unreadable document' })],
		});

		await expect(
			runWithTimers(new SharpApiResumeParser().execute.call(context as never)),
		).rejects.toThrow();
	});

	it('errors clearly when the dispatch response says nothing about the job', async () => {
		// Neither a job id to build a status URL from, nor an advertised one.
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'data', options: {} },
			responses: [{ message: 'accepted' }],
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('where to collect the result');
		expect(context.calls).toHaveLength(1);
	});

	it('names the missing binary field when the input item has no file', async () => {
		const context = createMockExecuteFunctions({
			params: { binaryPropertyName: 'attachment_1', options: {} },
			binary: null,
			responses: [],
		});

		const error = await runWithTimers(
			new SharpApiResumeParser().execute.call(context as never),
		).catch((caught: Error) => caught);

		expect((error as Error).message).toContain('attachment_1');
		expect(context.calls).toHaveLength(0);
	});
});

describe('client side validation', () => {
	it('rejects a Scoring Context over 5000 characters before calling the API', async () => {
		const context = createMockExecuteFunctions({
			params: {
				binaryPropertyName: 'data',
				content: 'A role',
				options: { context: 'x'.repeat(5001) },
			},
			responses: [],
		});

		const error = await runWithTimers(
			new SharpApiResumeJobMatchScore().execute.call(context as never),
		).catch((caught: NodeOperationError) => caught);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('5000');
		// The server would answer 422; failing locally saves the round trip.
		expect(context.calls).toHaveLength(0);
	});

	it('accepts a Scoring Context of exactly 5000 characters', async () => {
		const context = createMockExecuteFunctions({
			params: {
				binaryPropertyName: 'data',
				content: 'A role',
				options: { context: 'x'.repeat(5000) },
			},
			responses: [dispatched(), jobStatus('success', { result: '{}' })],
		});

		await runWithTimers(new SharpApiResumeJobMatchScore().execute.call(context as never));

		expect(context.calls).toHaveLength(2);
	});
});
