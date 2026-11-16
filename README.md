# SharpAPI nodes for n8n

**SharpAPI for n8n.** Turn resumes and invoices into clean, structured JSON, and score candidates against a job, inside your n8n workflow. Powered by [SharpAPI](https://sharpapi.com).

Each node is its own npm package. Install the ones you need; they all share one **SharpAPI API** credential, so the key is entered once.

| Package | What it does |
| --- | --- |
| [`@sharpapi/n8n-nodes-invoice-parser`](packages/invoice-parser) | Extract structured data from invoices and delivery orders with AI OCR |
| [`@sharpapi/n8n-nodes-resume-job-match-score`](packages/resume-job-match-score) | Score a resume against a job description across 20 dimensions with AI |
| [`@sharpapi/n8n-nodes-resume-parser`](packages/resume-parser) | Parse resumes and CVs into structured JSON with AI |

Every package README covers installation, credentials, options, output and an example workflow. Example workflows live in [`examples/`](examples).

`@sharpapi/n8n-nodes-sharpapi`, which shipped all three nodes in one package, stays on npm; its history is in [CHANGELOG.md](CHANGELOG.md).

## Development

Requires Node.js 24 or newer for `npm run dev`; everything else runs on Node 22.

```bash
npm run setup       # npm install --ignore-scripts, for all packages
npm run sync        # copy shared/ into every package after editing it
npm run typecheck   # every package
npm test            # unit tests for every package, no network
npm run lint        # every package
npm run build       # every package

cd packages/resume-parser
npm run dev         # local n8n with this package linked
npm run release     # bump, tag resume-parser-vX.Y.Z, push; CI publishes
```

Shared code and the credential live in [`shared/`](shared) and are copied into each package, because a published package may not depend on anything at runtime. Edit `shared/`, never a package's copy, then run `npm run sync`.

## License

[MIT](LICENSE.md)
