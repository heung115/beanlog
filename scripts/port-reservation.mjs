import net from "node:net";

export function reserveLoopbackPort(port, label, { createServer = net.createServer } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const onError = (error) => {
      reject(
        new Error(`${label} port ${port} is unavailable; no existing process was changed.`, {
          cause: error,
        })
      );
    };
    server.once("error", onError);
    server.listen({ host: "127.0.0.1", port }, () => {
      server.off("error", onError);
      const address = server.address();
      let released = false;
      resolve({
        port: typeof address === "object" && address ? address.port : port,
        async release() {
          if (released) return;
          released = true;
          await new Promise((releaseResolve, releaseReject) => {
            server.close((error) => {
              if (error) releaseReject(error);
              else releaseResolve();
            });
          });
        },
      });
    });
  });
}
