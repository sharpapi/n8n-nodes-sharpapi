import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { SharpApiInvoiceParser } from '../nodes/SharpApiInvoiceParser/SharpApiInvoiceParser.node';

import {
	createMockExecuteFunctions,
	dispatched,
	downloaded,
	jobStatus,
	runWithTimers,
} from './helpers/mock-execute';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const urlParams = (fileUrl: string) => ({ inputType: 'url', fileUrl, options: {} });

describe('File URL input', () => {
	it('downloads the file without credentials and uploads it to SharpAPI', async () => {
		const context = createMockExecuteFunctions({
			params: urlParams('https://files.example.com/inbox/INV%20417.pdf?sig=abc'),
			binary: null,
			downloads: [downloaded('%PDF-1.7 invoice', 'application/pdf; charset=binary')],
			responses: [dispatched(), jobStatus('success', { result: [] })],
		});

		await runWithTimers(new SharpApiInvoiceParser().execute.call(context as never));

		// The download goes through the plain helper, so the SharpAPI key stays home.
		expect(context.downloadCalls).toHaveLength(1);
		expect(context.downloadCalls[0]).toMatchObject({
			method: 'GET',
			url: 'https://files.example.com/inbox/INV%20417.pdf?sig=abc',
		});
		expect(context.calls[0].url).toBe('https://sharpapi.com/api/v1/finance/parse_invoice');

		const file = (context.calls[0].body as FormData).get('file') as File;
		expect(await file.text()).toBe('%PDF-1.7 invoice');
		expect(file.type).toBe('application/pdf');
		expect(file.name).toBe('INV 417.pdf');
	});

	it('rejects anything that is not an HTTP or HTTPS URL without making a request', async () => {
		for (const bad of ['file:///etc/passwd', 'invoice.pdf', '']) {
			const context = createMockExecuteFunctions({ params: urlParams(bad), binary: null });

			await expect(
				runWithTimers(new SharpApiInvoiceParser().execute.call(context as never)),
			).rejects.toThrow('is not an HTTP or HTTPS URL');
			expect(context.downloadCalls).toHaveLength(0);
			expect(context.calls).toHaveLength(0);
		}
	});

	it('says which URL could not be downloaded', async () => {
		const context = createMockExecuteFunctions({
			params: urlParams('https://files.example.com/missing.pdf'),
			binary: null,
			downloads: [new Error('Request failed with status code 404')],
		});

		await expect(
			runWithTimers(new SharpApiInvoiceParser().execute.call(context as never)),
		).rejects.toThrow('Could not download the file at https://files.example.com/missing.pdf');
		expect(context.calls).toHaveLength(0);
	});
});
