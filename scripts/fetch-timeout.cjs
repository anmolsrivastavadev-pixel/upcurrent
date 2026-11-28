// Gives every fetch() in a script a time limit, so one slow or hanging server can't hold a run for hours.
// A request that takes longer than FETCH_TIMEOUT_MS fails like any other error, and the source is
// treated as down for that run. Calls that pass their own signal keep it.
const LIMIT = Number(process.env.FETCH_TIMEOUT_MS) || 20000;
const raw = globalThis.fetch;
if (raw && !raw.withTimeout) {
  const timed = (url, opts = {}) => raw(url, opts.signal ? opts : { ...opts, signal: AbortSignal.timeout(LIMIT) });
  timed.withTimeout = true;
  globalThis.fetch = timed;
}
