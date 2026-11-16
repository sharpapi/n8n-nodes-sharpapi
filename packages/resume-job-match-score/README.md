# @sharpapi/n8n-nodes-resume-job-match-score

**SharpAPI Resume Job Match Score for n8n.** Rank candidates against a job description automatically, with a score you can filter on. Scores a candidate resume against a job description and returns 20 AI match scores with explanations.

Powered by [SharpAPI](https://sharpapi.com). One focused node, no glue code, no polling logic to maintain. SharpAPI also publishes the [Resume Parser](https://www.npmjs.com/package/@sharpapi/n8n-nodes-resume-parser) and [Invoice Parser](https://www.npmjs.com/package/@sharpapi/n8n-nodes-invoice-parser) nodes.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/) and use the package name `@sharpapi/n8n-nodes-resume-job-match-score`.

Self-hosted, from the CLI:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install @sharpapi/n8n-nodes-resume-job-match-score
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

## Resume Job Match Score

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

## Example workflow

[Resume Job Match Score](https://github.com/sharpapi/n8n-nodes-sharpapi/blob/main/examples/resume-job-match-score.json): reads a file from disk and runs it through the node. Import it into n8n with **Import from File**, point **Read file from disk** at your own file, then pick your SharpAPI credential on the SharpAPI node.

## Resources

- [SharpAPI documentation](https://sharpapi.com/documentation)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Source code](https://github.com/sharpapi/n8n-nodes-sharpapi/tree/main/packages/resume-job-match-score)

## License

[MIT](LICENSE.md)
