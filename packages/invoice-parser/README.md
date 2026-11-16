# @sharpapi/n8n-nodes-invoice-parser

**SharpAPI Invoice Parser for n8n.** Drop an invoice PDF or photo into n8n and get accounting-ready JSON out. Extracts invoices and delivery orders (PDF, scans, photos) into structured JSON with AI OCR.

Powered by [SharpAPI](https://sharpapi.com). One focused node, no glue code, no polling logic to maintain. SharpAPI also publishes the [Resume Parser](https://www.npmjs.com/package/@sharpapi/n8n-nodes-resume-parser) and [Resume Job Match Score](https://www.npmjs.com/package/@sharpapi/n8n-nodes-resume-job-match-score) nodes.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/) and use the package name `@sharpapi/n8n-nodes-invoice-parser`.

Self-hosted, from the CLI:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install @sharpapi/n8n-nodes-invoice-parser
```

Then restart n8n.

## Credentials

1. Create an account at [sharpapi.com](https://sharpapi.com) and generate an API key in the dashboard.
2. In n8n, add a **SharpAPI API** credential and paste the key.
3. The credential test calls `GET /ping`, so a green check means the key is valid.

Every SharpAPI node uses the same **SharpAPI API** credential, so the key is entered once even with several SharpAPI packages installed.

## Usage

The node takes its file in one of two ways, chosen with **Input Type**:

- **Binary File** (default): connect any node that produces a file (Gmail, Google Drive, HTTP Request, Read/Write Files from Disk, Form Trigger, Webhook) and set **Input Binary Field** to the field holding it, usually `data`. A Form Trigger names the field after the form field's label.
- **File URL**: the node downloads the file from a public HTTP or HTTPS URL itself. The download is sent without your SharpAPI key.

The node also sets `usableAsTool`, so an AI Agent can call it mid-conversation. n8n hands a tool only the arguments the model chose, never the files in the conversation, so use **File URL** as the input type when you attach it as a tool, and let the model fill it in: click the sparkle icon next to **File URL**, or set it to `{{ $fromAI('fileUrl', 'URL of the document to process', 'string') }}`. Try it with [this sample invoice](https://raw.githubusercontent.com/sharpapi/n8n-nodes-sharpapi/main/examples/sample-invoice.pdf).

## Invoice Parser

Accepted file formats: PDF, JPG, JPEG, JPE, PNG, TIFF, TIF, including scans and photos.

- Automate accounts payable from a shared mailbox to your accounting system
- Digitise supplier delivery orders and match them against purchase orders
- Batch-extract a backlog of scanned invoices from cloud storage
- Feed spend data into a BI dashboard without manual entry

| Option | Default | Notes |
| --- | --- | --- |
| Simplify Output | true | Returns the parsed result instead of the full job envelope |
| Poll Interval (Seconds) | 5 | Used when the API sends no `Retry-After` header |
| Max Wait Time (Seconds) | 300 | Node fails once exceeded |

**Output:** document metadata, invoice header fields, references, e_invoice block, seller and buyer blocks with addresses and bank details, sales_info, financials with tax_details[], line_items[] with per-line pricing and tax, payment terms and logistics. A single file may contain several invoices, so each detected invoice is returned as its own n8n item.

## Example workflow

[Invoice Parser](https://github.com/sharpapi/n8n-nodes-sharpapi/blob/main/examples/invoice-parser.json): reads a file from disk and runs it through the node. Import it into n8n with **Import from File**, point **Read file from disk** at your own file, then pick your SharpAPI credential on the SharpAPI node.

## Resources

- [SharpAPI documentation](https://sharpapi.com/documentation)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Source code](https://github.com/sharpapi/n8n-nodes-sharpapi/tree/main/packages/invoice-parser)

## License

[MIT](LICENSE.md)
