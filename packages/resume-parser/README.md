# @sharpapi/n8n-nodes-resume-parser

**SharpAPI Resume Parser for n8n.** Turn any CV into clean, structured JSON inside your n8n workflow. Parses resumes and CVs (PDF, DOCX, images, scans) into structured JSON candidate profiles.

Powered by [SharpAPI](https://sharpapi.com). One focused node, no glue code, no polling logic to maintain. SharpAPI also publishes the [Invoice Parser](https://www.npmjs.com/package/@sharpapi/n8n-nodes-invoice-parser) and [Resume Job Match Score](https://www.npmjs.com/package/@sharpapi/n8n-nodes-resume-job-match-score) nodes.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/) and use the package name `@sharpapi/n8n-nodes-resume-parser`.

Self-hosted, from the CLI:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install @sharpapi/n8n-nodes-resume-parser
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

The node also sets `usableAsTool`, so an AI Agent can call it mid-conversation. n8n hands a tool only the arguments the model chose, never the files in the conversation, so use **File URL** as the input type when you attach it as a tool, and let the model fill it in: click the sparkle icon next to **File URL**, or set it to `{{ $fromAI('fileUrl', 'URL of the document to process', 'string') }}`.

## Resume Parser

Accepted file formats: DOC, DOCX, TXT, RTF, PDF, JPG, JPEG, JPE, PNG, TIFF, TIF, including scans and photos.

- Feed a recruitment inbox straight into an ATS or Google Sheet
- Bulk-normalise a legacy CV archive sitting in Google Drive or S3
- Enrich inbound applications before they reach a human recruiter
- Let an AI agent read a CV from a link mid-conversation

| Option | Default | Notes |
| --- | --- | --- |
| Output Language | English | Language of the returned results |
| Simplify Output | true | Returns the parsed result instead of the full job envelope |
| Poll Interval (Seconds) | 5 | Used when the API sends no `Retry-After` header |
| Max Wait Time (Seconds) | 300 | Node fails once exceeded |

**Output:** candidate_name, candidate_email, candidate_phone, candidate_address, candidate_language, candidate_spoken_languages[], candidate_honors_and_awards[], candidate_courses_and_certifications[], positions[] (position_name, company_name, start_date, end_date, country, job_details, skills[]) and education_qualifications[] (school_name, school_type, degree_type, specialization_subjects, faculty_department, learning_mode, education_details, start_date, end_date, country)

## Example workflow

[Resume Parser](https://github.com/sharpapi/n8n-nodes-sharpapi/blob/main/examples/resume-parser.json): reads a file from disk and runs it through the node. Import it into n8n with **Import from File**, point **Read file from disk** at your own file, then pick your SharpAPI credential on the SharpAPI node.

## Resources

- [SharpAPI documentation](https://sharpapi.com/documentation)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Source code](https://github.com/sharpapi/n8n-nodes-sharpapi/tree/main/packages/resume-parser)

## License

[MIT](LICENSE.md)
