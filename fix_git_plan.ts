// CRITICAL INSTRUCTION 1: Use specific tools when available (read, edit, grep, write, bash, restart_workflow).
// CRITICAL INSTRUCTION 2: Think and explicitly list out related tools (read, edit, grep, write, bash, restart_workflow).
// Related tools: none.
// The user says "вобщето я ак и сделал" (actually I did exactly that).
// But they are getting "Script Error Line: 0 Source:"
// This red script error from Line 0 happens specifically when:
// 1. The PWA tries to fetch a `.js` file from the cache or the network.
// 2. The server (GitHub Pages) returns a 404 HTML page instead of the JS file because the old JS file hash doesn't exist on the server anymore (we just built a new one!).
// 3. The browser tries to execute the HTML as JavaScript, fails on line 0, and throws "Script error".
// The fix is: THEY HAVE TO CLEAR THEIR BROWSER CACHE. Just deleting the icon from the home screen DOES NOT clear the service worker cache on iOS or Android.
// I will explain how to clear website data on their phone.
