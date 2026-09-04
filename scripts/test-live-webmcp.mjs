import { spawn } from "node:child_process";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const TARGET_URL = "https://webmcp.kurogrid.com/sites/mimo-01";

console.log(`1. Launching headless Chrome to test WebMCP on ${TARGET_URL}...`);

const chrome = spawn(
  CHROME_PATH,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/chrome_webmcp_test_profile",
    TARGET_URL,
  ],
  { stdio: "ignore" }
);

function cleanup() {
  chrome.kill("SIGKILL");
}
process.on("exit", cleanup);
process.on("SIGINT", cleanup);

// Wait for Chrome remote debugging port to be ready
let targets = null;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 300));
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    if (res.ok) {
      targets = await res.json();
      if (targets.length > 0) break;
    }
  } catch {}
}

if (!targets || targets.length === 0) {
  console.error("Failed to connect to headless Chrome debugging port.");
  cleanup();
  process.exit(1);
}

const pageTarget = targets.find((t) => t.type === "page") || targets[0];
console.log(`2. Connected to tab: "${pageTarget.title}" (${pageTarget.url})`);

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
function sendCdp(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener("message", handler);
        resolve(data.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// Enable Runtime
await sendCdp("Runtime.enable");

// Wait 2.5 seconds for scripts to run and register tools
console.log("3. Waiting 2.5s for page scripts and tools to initialize...");
await new Promise((r) => setTimeout(r, 2500));

async function evalInPage(expression) {
  const res = await sendCdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(JSON.stringify(res.exceptionDetails));
  }
  return res.result.value;
}

console.log("\n--- TEST RESULTS ---");

const typeofContext = await evalInPage("typeof document.modelContext");
console.log(`typeof document.modelContext:`, typeofContext);

const inDocument = await evalInPage("'modelContext' in document");
console.log(`'modelContext' in document:`, inDocument);

const tools = await evalInPage("document.modelContext ? document.modelContext.getTools() : null");
console.log(`\nRegistered WebMCP Tools (${tools ? tools.length : 0} tools):`);
console.dir(tools, { depth: null });

if (tools && tools.length > 0) {
  console.log(`\n4. Executing live tool "find_appointment_slots" via document.modelContext...`);
  const slotsResult = await evalInPage(`
    document.modelContext.executeTool("find_appointment_slots", {
      service_slug: "dermatology",
      date: "2026-09-05"
    })
  `);
  console.log("Execution Result from document.modelContext.executeTool():");
  console.dir(slotsResult, { depth: null });
}

ws.close();
cleanup();
console.log("\n--- TEST COMPLETE ---");
process.exit(0);
