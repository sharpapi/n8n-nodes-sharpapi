# n8n-nodes-sharpapi

**SharpAPI for n8n.** Turn resumes and invoices into clean, structured JSON, and score candidates against a job, inside your n8n workflow.

Powered by [SharpAPI](https://sharpapi.com). Each node is a single, focused step. No glue code, no polling logic to maintain.

| Node | What it does |
| --- | --- |
| Invoice Parser | Extract structured data from invoices and delivery orders with AI OCR, powered by SharpAPI |
| Resume Job Match Score | Score a resume against a job description across 20 dimensions with AI, powered by SharpAPI |
| Resume Parser | Parse resumes and CVs into structured JSON with AI, powered by SharpAPI |

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/) and use the package name `n8n-nodes-sharpapi`.

Self-hosted, from the CLI:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install n8n-nodes-sharpapi
```

Then restart n8n.

## Credentials

All nodes share one credential, so the key is entered once.

1. Create an account at [sharpapi.com](https://sharpapi.com) and generate an API key in the dashboard.
2. In n8n, add a **SharpAPI API** credential and paste the key.
3. The credential test calls `GET /ping`, so a green check means the key is valid.

## Usage

Connect any node that produces a file (Gmail, Google Drive, HTTP Request, Read/Write Files from Disk, Webhook) and point **Input Data Field Name** at the field holding it, usually `data`.

Every node also sets `usableAsTool`, so an AI Agent node can call it directly to process a document mid-conversation.

## Nodes

### Invoice Parser

Drop an invoice PDF or photo into n8n and get accounting-ready JSON out. Extracts invoices and delivery orders (PDF, scans, photos) into structured JSON with AI OCR.

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

### Resume Job Match Score

Rank candidates against a job description automatically, with a score you can filter on. Scores a candidate resume against a job description and returns 20 AI match scores with explanations.

Accepted file formats: DOC, DOCX, TXT, RTF, PDF, JPG, JPEG, JPE, PNG, TIFF, TIF, including scans and photos.

- Auto-rank an inbound application pipeline and alert on strong matches only
- Pre-screen a shortlist before recruiter review
- Re-score an existing candidate database against a newly opened role
- Add explainable scoring to a recruitment agency workflow

| Option | Default | Notes |
| --- | --- | --- |
| Output Language | English | Language of the returned results |
| Scoring Context | empty | Extra scoring directives, one per line, max 5000 characters. Supported prefixes: EMPHASIZE:, DEEMPHASIZE:, CREDIT:. |
| Simplify Output | true | Returns the parsed result instead of the full job envelope |
| Poll Interval (Seconds) | 5 | Used when the API sends no `Retry-After` header |
| Max Wait Time (Seconds) | 300 | Node fails once exceeded |

**Output:** match_scores with 20 integer scores from 0 to 100 (overall_match, skills_match, experience_match, education_match, certifications_match, job_title_relevance, industry_experience_match, project_experience_match, technical_stack_match, soft_skills_match, methodologies_match, language_proficiency_match, location_preference_match, remote_work_flexibility, certifications_training_relevance, years_experience_weighting, recent_role_relevance, management_experience_match, cultural_fit_potential, stability_score) plus explanations keyed by the same names

### Resume Parser

Turn any CV into clean, structured JSON inside your n8n workflow. Parses resumes and CVs (PDF, DOCX, images, scans) into structured JSON candidate profiles.

Accepted file formats: DOC, DOCX, TXT, RTF, PDF, JPG, JPEG, JPE, PNG, TIFF, TIF, including scans and photos.

- Feed a recruitment inbox straight into an ATS or Google Sheet
- Bulk-normalise a legacy CV archive sitting in Google Drive or S3
- Enrich inbound applications before they reach a human recruiter
- Let an AI agent read an attached CV mid-conversation

| Option | Default | Notes |
| --- | --- | --- |
| Output Language | English | Language of the returned results |
| Simplify Output | true | Returns the parsed result instead of the full job envelope |
| Poll Interval (Seconds) | 5 | Used when the API sends no `Retry-After` header |
| Max Wait Time (Seconds) | 300 | Node fails once exceeded |

**Output:** candidate_name, candidate_email, candidate_phone, candidate_address, candidate_language, candidate_spoken_languages[], candidate_honors_and_awards[], candidate_courses_and_certifications[], positions[] (position_name, company_name, start_date, end_date, country, job_details, skills[]) and education_qualifications[] (school_name, school_type, degree_type, specialization_subjects, faculty_department, learning_mode, education_details, start_date, end_date, country)

## Example workflows

Import any of these into n8n with **Import from File**, point **Read file from disk** at your own file, then pick your SharpAPI credential on the SharpAPI node.

- [Invoice Parser](https://github.com/sharpapi/n8n-nodes-sharpapi/blob/main/examples/invoice-parser.json): reads a file from disk and runs it through the node
- [Resume Job Match Score](https://github.com/sharpapi/n8n-nodes-sharpapi/blob/main/examples/resume-job-match-score.json): reads a file from disk and runs it through the node
- [Resume Parser](https://github.com/sharpapi/n8n-nodes-sharpapi/blob/main/examples/resume-parser.json): reads a file from disk and runs it through the node

## Development

Requires Node.js 24 or newer, which current n8n releases need for `npm run dev`.

```bash
npm install
npm run dev     # builds, starts a local n8n with the nodes loaded, hot-rebuilds on change
npm run lint
npm run build
npm test        # unit tests, no network
```

## Resources

- [SharpAPI documentation](https://sharpapi.com/documentation)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
