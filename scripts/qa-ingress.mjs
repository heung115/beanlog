import http from "node:http";

// Local production-build QA needs the same trusted ingress boundary as staging.
// Fixed loopback transport only: no arbitrary upstream URL or redirect following.
export async function startQaIngress({ port, upstreamPort, proof }) {
  if (!/^[a-f0-9]{64}$/.test(proof) || !Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535) {
    throw new Error("Invalid local QA ingress configuration");
  }
  const server = http.createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, (request, response) => {
    const headers = { ...request.headers };
    delete headers["x-beanmap-auth-client-ip"];
    delete headers["x-beanmap-auth-rate-identity"];
    headers["x-beanmap-client-ip"] = "127.0.0.1";
    headers["x-beanmap-client-proof"] = proof;
    const upstream = http.request({ hostname: "127.0.0.1", port: upstreamPort, method: request.method, path: request.url, headers }, (result) => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    });
    upstream.setTimeout(30_000, () => upstream.destroy());
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => upstream.destroy());
    request.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    port: server.address().port,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
