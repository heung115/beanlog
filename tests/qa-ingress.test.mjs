import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { startQaIngress } from "../scripts/qa-ingress.mjs";

test("local QA ingress overwrites caller proofs and keeps upstream transport on loopback", async () => {
  const proof = "a".repeat(64);
  let seen;
  const upstream = http.createServer((request, response) => {
    seen = { headers: request.headers, url: request.url, address: request.socket.remoteAddress };
    response.writeHead(200, { "Set-Cookie": "fixture=1; HttpOnly" });
    response.end("ok");
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const ingress = await startQaIngress({ port: 0, upstreamPort: upstream.address().port, proof });
  try {
    const response = await fetch(`http://127.0.0.1:${ingress.port}/api/health`, { headers: {
      "X-Beanmap-Client-Proof": "forged", "X-Beanmap-Client-IP": "198.51.100.1",
      "X-Beanmap-Auth-Client-IP": "198.51.100.2", "X-Beanmap-Auth-Rate-Identity": "forged",
    } });
    assert.equal(await response.text(), "ok");
    assert.equal(response.headers.get("set-cookie"), "fixture=1; HttpOnly");
    assert.equal(seen.headers["x-beanmap-client-proof"], proof);
    assert.equal(seen.headers["x-beanmap-client-ip"], "127.0.0.1");
    assert.equal(seen.headers["x-beanmap-auth-client-ip"], undefined);
    assert.equal(seen.headers["x-beanmap-auth-rate-identity"], undefined);
    assert.equal(seen.address, "127.0.0.1");
    assert.equal(seen.url, "/api/health");
    assert.equal(response.headers.get("x-beanmap-client-proof"), null);
  } finally {
    await ingress.close();
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});

test("local QA ingress rejects invalid configuration before listening", async () => {
  await assert.rejects(startQaIngress({ port: 0, upstreamPort: 3000, proof: "bad" }), /Invalid/);
  await assert.rejects(startQaIngress({ port: 0, upstreamPort: 0, proof: "a".repeat(64) }), /Invalid/);
});
