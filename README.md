# Anheuser-Busch — legacy SAP execution demo

This site is the **execution target**, separate from the Wonderful Control Tower. A person reviews and approves work in Wonderful. The computer-use agent then enters that already-approved transaction here, saves it, and returns the actual document number to Wonderful.

The site deliberately has no approval queue, customer-conversation panel, dashboard, approval action, or second review step. It resembles a legacy SAP GUI application: menu bar, command field, standard toolbar, sales-document header, editable item grid, Header texts, Document flow, and a bottom status bar.

## Transactions

- `VA01`: credit memo request (CR), subsequent delivery free of charge (SDF), and returns order (RE).
- `VA03`: display an existing document by document number or exact customer reference.
- `ZCNOTE`: a **custom demo transaction** for a customer contact note.

Use **Create with Reference**, enter a known billing document, and select **Copy**. Maintain Customer reference (the Wonderful approval/handoff key), Order reason, Created by, Document date, quantity, credit per case when applicable, and Header texts. **Save** writes the document directly. The green status bar and Display Document expose its generated document number. Credit requests remain blocked for release; saving a request is not a financial posting or dispatch confirmation.

All business data is fictional. The `invoices` array in `data.js` contains five billing/master-data fixtures. This is a SAP GUI-inspired simulation, not a verified copy of Anheuser-Busch's internal deployment. US01 and the other organizational codes are demo choices.

## Hosting and domain

- Intended canonical site: **https://yonahshafner.com/**.
- Working GitHub Pages staging URL: https://yonahs-wonderful.github.io/abi-sap-resolution-demo/.
- Cloudflare is authoritative for the domain. At the last check its apex had no address record, and the collaborative browser was not signed in to Cloudflare. Domain setup is pending that access.
- `dns/yonahshafner.com.zone` contains only the four required GitHub Pages A records. Preserve unrelated records. Once those records exist, configure `yonahshafner.com` as this repository's Pages custom domain, commit a `CNAME` containing that host, verify DNS, and enable HTTPS when its certificate is ready. CNAME is intentionally not active yet because enabling it would redirect the working Pages URL to an unresolved domain.

The code supports GitHub Pages project paths and custom-domain roots using relative asset URLs. No server or build is required for publication; Pages serves the root of `main`.

## Run and verify

`npm ci`, `npx playwright install chromium` (once), `npm run check`, `npm test`, then `npm start` for http://localhost:4173.

Tests cover reference lookup, required values, invoice quantity limits, the direct Save flow, simultaneous duplicate submissions, all five example tasks, display after reload, document flow, unsaved-change cancellation, and storage failure. An isolated browser context is used for live-site verification as well.

`?invoice=9000124581&transaction=credit` opens the corresponding reference and transaction type. This does not submit, approve, or prefill the action-specific fields. Old `?case=CS-100241` links still resolve the equivalent invoice for compatibility, without displaying a case worklist.

## Storage and integration boundary

Saved documents live in browser-local storage under `abi-sap-transactions-v2`. Earlier workbench records under `abi-sap-demo-v1` are left untouched. Duplicate customer references are blocked within the browser; Web Locks serialize saves across tabs where supported. These records are not shared across computers. The Wonderful caller must keep a durable decision/dispatch ledger and avoid a second execution after ambiguous delivery.

The companion `abi-sap-resolution-cu` backoffice agent belongs in the `computer-use` environment. Its computer pool must be configured there. The USA Control Tower owns approval; a server-side bridge invokes the remote webhook. Do not put the webhook URL/secret into this public repository or frontend. `sample-resolution.json` describes the business payload, not the provider-specific HTTP/authentication envelope. Current cross-environment dispatch and computer-pool activation are not proven by this website.

The agent needs no second business approval at SAP Save: the human's Wonderful decision already authorizes the bounded action. It should pause only for missing data, conflicting records, unavailable access, or a requested action outside that approval.

## Research

- [SAP Help: Create Credit Memo Requests](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/7b24a64d9d0941bda1afa753263d9e39/e4f22cd3184c4ef9badd0b461e5a4a0d.html) documents sales area, sold-to party, customer reference, order reason, reference documents, material and quantity, and the distinction between a credit memo request and its later release. Used for the transaction fields and states, not as evidence of ABI's current version or UI.
- [Computer Weekly: Anheuser-Busch SAP use](https://www.computerweekly.com/news/450418295/SAP-goes-after-worlds-largest-brewing-company-in-600m-licence-dispute) provides historical evidence of SAP ERP use. It does not establish the exact current US configuration.
- [GitHub Pages custom domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) is the source for the supplied apex A records.
