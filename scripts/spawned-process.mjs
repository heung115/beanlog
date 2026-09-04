import { spawn } from "node:child_process";
import process from "node:process";

export function spawnOwnedProcess(command, args, options = {}, internals = {}) {
  const platform = internals.platform ?? process.platform;
  const spawnProcess = internals.spawnProcess ?? spawn;
  const killProcess = internals.killProcess ?? process.kill.bind(process);
  const ownsProcessGroup = platform !== "win32";
  const child = spawnProcess(command, args, {
    ...options,
    detached: ownsProcessGroup,
  });

  return {
    child,
    processGroupId: ownsProcessGroup ? child.pid : undefined,
    killProcess,
  };
}

export function waitForSpawnedProcess(ownedProcess) {
  const child = ownedProcess.child;
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code, signal) => {
      cleanup();
      resolve({ code, signal });
    };

    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function trySignal(ownedProcess, signal) {
  try {
    if (ownedProcess.processGroupId !== undefined) {
      ownedProcess.killProcess(-ownedProcess.processGroupId, signal);
    } else {
      ownedProcess.child.kill(signal);
    }
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

export function signalSpawnedProcess(ownedProcess, signal) {
  if (!ownedProcess) return false;
  return trySignal(ownedProcess, signal);
}

function isProcessTreeRunning(ownedProcess) {
  if (ownedProcess.processGroupId !== undefined) {
    return trySignal(ownedProcess, 0);
  }
  return (
    ownedProcess.child.exitCode === null &&
    ownedProcess.child.signalCode === null
  );
}

async function waitForProcessTreeExit(ownedProcess, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessTreeRunning(ownedProcess)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isProcessTreeRunning(ownedProcess);
}

export async function stopSpawnedProcess(ownedProcess, graceMs = 5_000) {
  if (!ownedProcess || !isProcessTreeRunning(ownedProcess)) return;

  trySignal(ownedProcess, "SIGTERM");
  if (await waitForProcessTreeExit(ownedProcess, graceMs)) return;

  trySignal(ownedProcess, "SIGKILL");
  if (!(await waitForProcessTreeExit(ownedProcess, graceMs))) {
    throw new Error(`Owned process group ${ownedProcess.processGroupId ?? "child"} did not exit`);
  }
}
