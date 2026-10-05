# ABI SAP Resolution Demo

Static, SAP Fiori-inspired customer-resolution workbench for a Wonderful computer-use agent. This is a custom demonstration, not a verified replica of Anheuser-Busch's SAP implementation. All business records, customer names, organization codes and prices are fictional.

## Run

`npm ci`, `npx playwright install chromium` (once for tests), `npm run check`, `npm test`, and `npm start` (http://localhost:4173). Serve the directory as static files; no production dependency or build is needed. GitHub Pages serves the root of `main` with `.nojekyll`.

The five cases cover delivery shortage credits, damage replacements, incorrect-product returns, invoice adjustments and information-only resolution. Forms support review, save, generated document references, document flow, a change log and JSON export. `?case=CS-100241` opens a case; URL parameters never submit data.

Records persist in the current browser's local storage. There is no backend or shared ledger. Duplicate references and duplicate case resolutions are blocked within the browser, with the Web Locks API serializing cross-tab saves where supported. Clearing browser storage or switching computers resets that protection. The upstream application must maintain a durable deduplication ledger for retries across machines. The change log is demo history, not an immutable audit system.

## Research and fidelity

Reviewed 5 October 2026:

- [SAP Help: Create Credit Memo Requests](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/7b24a64d9d0941bda1afa753263d9e39/e4f22cd3184c4ef9badd0b461e5a4a0d.html). Directly read the 2025 FPS01 documentation: create with or without a preceding document; sales organization/distribution channel/division; sold-to/ship-to party; customer reference and date; order reason; material and quantity. A credit memo request requires release before a credit memo can be created. This informs the form and pending-release state.
- [Computer Weekly: Anheuser-Busch SAP use](https://www.computerweekly.com/news/450418295/SAP-goes-after-worlds-largest-brewing-company-in-600m-licence-dispute). Directly read historical reporting dated 5 May 2017 documenting longstanding SAP ERP use. This does not establish the current US deployment version, Fiori adoption or actual screens.
- The custom case worklist, handoff reference, customer agreement panel, replacement/return requests, organizational codes and change log are deliberately designed demo features. No evidence was found establishing that ABI USA uses these exact screens or fields together. No claim is made that its current system is S/4HANA.

## Computer-use integration

The companion `abi-sap-resolution-cu` agent lives in the Wonderful `computer-use` environment, General workspace. Its source is `../agents/abi-sap-resolution-cu`. It uses screenshots and native computer input; it does not call browser APIs or manipulate local storage.

The intended flow is: ABI USA app → server-side webhook request → back-office task in computer-use environment → configured computer → this static site → verified document receipt. A server-side caller must retain the webhook secret and maintain a durable handoff ledger. Never put the webhook credential in this public Pages repository or browser JavaScript. The USA app integration is a separate step; no existing app behavior is changed by this repository.

See `sample-resolution.json` for the business payload. Obtain the webhook URL and provider-required request/authentication format from the created trigger's Channels UI; do not infer it from this business JSON. The trigger is initially disabled until its computer pool is attached and a real computer-use smoke run passes.

## Custom domain

`yonahshafner.com` returned no A record from both public resolvers checked during setup. GitHub Pages is the working publication target. No CNAME file is committed, so the Pages address remains usable. To use a dedicated host later, create a DNS CNAME such as `sap.yonahshafner.com` pointing to `yonahs-wonderful.github.io`, then configure that verified host in this repository's Pages settings and enforce HTTPS once its certificate is ready. Do not replace an existing apex site.
