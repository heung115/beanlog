import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { reserveLoopbackPort } from "../scripts/port-reservation.mjs";

function fakeServerFactory() {
  const reserved = new Set();
  return function createServer() {
    const server = new EventEmitter();
    let port;
    server.listen = (options, callback) => {
      port = options.port === 0 ? 43210 : options.port;
      queueMicrotask(() => {
        if (reserved.has(port)) {
          const error = new Error("address in use");
          error.code = "EADDRINUSE";
          server.emit("error", error);
          return;
        }
        reserved.add(port);
        callback();
      });
    };
    server.address = () => ({ address: "127.0.0.1", family: "IPv4", port });
    server.close = (callback) => {
      reserved.delete(port);
      queueMicrotask(() => callback());
    };
    return server;
  };
}

test("a loopback reservation excludes concurrent QA and releases cleanly", async () => {
  const createServer = fakeServerFactory();
  const first = await reserveLoopbackPort(0, "QA lock", { createServer });
  try {
    await assert.rejects(
      reserveLoopbackPort(first.port, "QA lock", { createServer }),
      (error) => error.cause?.code === "EADDRINUSE"
    );
  } finally {
    await first.release();
  }

  const afterRelease = await reserveLoopbackPort(first.port, "QA lock", {
    createServer,
  });
  await afterRelease.release();
  await afterRelease.release();
});
