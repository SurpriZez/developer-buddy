// Developer Buddy — Offscreen Document
// Executes arbitrary JavaScript in a sandboxed (non-page) context.

export interface ScriptResult {
  output: string[];
  error: string | null;
}

async function executeScript(body: string): Promise<ScriptResult> {
  const output: string[] = [];

  // Intercept console methods
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  };

  const capture = (...args: unknown[]) =>
    output.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));

  console.log = capture;
  console.warn = capture;
  console.info = capture;
  // Keep console.error going to output too but preserve type
  console.error = (...args: unknown[]) => {
    capture(...args);
    original.error(...args);
  };

  try {
    // Wrap in async IIFE so await works at top level
    const wrapped = `(async function() { ${body} })()`;
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return ${wrapped}`);
    await fn();
    return { output, error: null };
  } catch (err) {
    return { output, error: err instanceof Error ? err.message : String(err) };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.info = original.info;
    console.error = original.error;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXECUTE_SCRIPT') {
    executeScript(message.payload.body).then(sendResponse);
    return true; // keep channel open
  }
  return false;
});
