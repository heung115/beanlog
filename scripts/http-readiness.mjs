function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error("HTTP readiness check was aborted");
}

function pause(delayMs, signal) {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, delayMs));
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForHttpStatus(
  url,
  {
    label,
    timeoutMs = 120_000,
    expectedStatus,
    requestTimeoutMs = 5_000,
    retryDelayMs = 2_000,
    signal,
    fetchImpl = fetch,
  }
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw abortReason(signal);
    try {
      const remainingMs = Math.max(1, deadline - Date.now());
      const attemptSignal = signal
        ? AbortSignal.any([
            signal,
            AbortSignal.timeout(Math.min(requestTimeoutMs, remainingMs)),
          ])
        : AbortSignal.timeout(Math.min(requestTimeoutMs, remainingMs));
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: attemptSignal,
      });
      const ready = expectedStatus !== undefined
        ? response.status === expectedStatus
        : response.status > 0 && response.status < 500;
      await response.body?.cancel();
      if (ready) return;
    } catch {
      if (signal?.aborted) throw abortReason(signal);
    }
    await pause(Math.min(retryDelayMs, Math.max(1, deadline - Date.now())), signal);
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000}s`);
}
