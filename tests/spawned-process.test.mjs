import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import process from "node:process";
import test from "node:test";

import {
  spawnOwnedProcess,
  stopSpawnedProcess,
  waitForSpawnedProcess,
} from "../scripts/spawned-process.mjs";

class FakeChild extends EventEmitter {
  exitCode = null;
  signalCode = null;
  pid = 321;

  kill() {
    return true;
  }
}

function fakeProcessGroup({ exitOnSignal }) {
  const child = new FakeChild();
  const signals = [];
  let running = true;
  const ownedProcess = {
    child,
    processGroupId: child.pid,
    killProcess(pid, signal) {
      signals.push({ pid, signal });
      if (!running) {
        const error = new Error("missing process group");
        error.code = "ESRCH";
        throw error;
      }
      if (signal === exitOnSignal) running = false;
    },
  };
  return { child, ownedProcess, signals, stop: () => (running = false) };
}

test("owned process spawn creates a dedicated POSIX process group", () => {
  const child = new FakeChild();
  let spawnOptions;
  const ownedProcess = spawnOwnedProcess(
    "node",
    ["script.mjs"],
    { cwd: "/tmp" },
    {
      platform: "darwin",
      spawnProcess(_command, _args, options) {
        spawnOptions = options;
        return child;
      },
      killProcess() {},
    }
  );

  assert.equal(spawnOptions.detached, true);
  assert.equal(ownedProcess.processGroupId, child.pid);
});

test("spawned process completion preserves its exact exit result", async () => {
  const { child, ownedProcess } = fakeProcessGroup({});
  const completion = waitForSpawnedProcess(ownedProcess);

  child.exitCode = 7;
  child.emit("exit", 7, null);

  assert.deepEqual(await completion, { code: 7, signal: null });
});

test("owned process cleanup signals the exact group and exits gracefully", async () => {
  const { ownedProcess, signals } = fakeProcessGroup({ exitOnSignal: "SIGTERM" });

  await stopSpawnedProcess(ownedProcess, 20);

  assert.deepEqual(
    signals.filter(({ signal }) => signal !== 0),
    [{ pid: -321, signal: "SIGTERM" }]
  );
});

test("owned process cleanup escalates the same group when descendants remain", async () => {
  const { ownedProcess, signals } = fakeProcessGroup({ exitOnSignal: "SIGKILL" });

  await stopSpawnedProcess(ownedProcess, 1);

  assert.deepEqual(
    signals.filter(({ signal }) => signal !== 0),
    [
      { pid: -321, signal: "SIGTERM" },
      { pid: -321, signal: "SIGKILL" },
    ]
  );
});

test("owned process cleanup leaves an exited group untouched", async () => {
  const { ownedProcess, signals, stop } = fakeProcessGroup({});
  stop();

  await stopSpawnedProcess(ownedProcess, 1);

  assert.deepEqual(signals.filter(({ signal }) => signal !== 0), []);
});

test("owned process cleanup kills a descendant that ignores SIGTERM", async (context) => {
  if (process.platform === "win32") {
    context.skip("POSIX process groups are unavailable on Windows");
    return;
  }

  const leafScript = [
    'process.on("SIGTERM", () => {});',
    'process.stdout.write(`leaf:${process.pid}\\n`);',
    "setInterval(() => {}, 1000);",
  ].join("");
  const parentScript = [
    'const { spawn } = require("node:child_process");',
    `spawn(process.execPath, ["-e", ${JSON.stringify(leafScript)}], `,
    '{ stdio: ["ignore", "inherit", "ignore"] });',
    'process.on("SIGTERM", () => process.exit(0));',
    "setInterval(() => {}, 1000);",
  ].join("");
  const ownedProcess = spawnOwnedProcess(process.execPath, ["-e", parentScript], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  context.after(async () => stopSpawnedProcess(ownedProcess, 50));

  const [chunk] = await once(ownedProcess.child.stdout, "data");
  const leafPid = Number(chunk.toString().match(/leaf:(\d+)/)?.[1]);
  assert.ok(Number.isInteger(leafPid));

  await stopSpawnedProcess(ownedProcess, 50);
  assert.throws(() => process.kill(leafPid, 0), { code: "ESRCH" });
});
