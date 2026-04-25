// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: none.
// The user pressed "Share" and got a red script error!
// The error is `Error: script error Line: 0 Source: `.
// Ah! Safari tries to fetch the Web App Manifest when you click the Share button (to prepare the "Add to Home Screen" dialog)!
// In our `index.html` there was an old `<link rel="manifest" href="/manifest.json">`.
// Because we are deployed at `/phlogiston-chem-journal/`, `/manifest.json` returns the 404 HTML page.
// The 404 page is an HTML document. Safari tries to parse it as a JSON manifest, fails catastrophically, and triggers the global `window.onerror` script error with line 0 (because it's not a real script, it's a parsing error from the browser internals triggered by the network request).
// I just removed the hardcoded `manifest.json` and absolute paths to `favicon.png` from `index.html`!
// VitePWA plugin automatically injects the correct manifest link (with the correct `/phlogiston-chem-journal/manifest.webmanifest` path).
// I will commit and push this fix.
