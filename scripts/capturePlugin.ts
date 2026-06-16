import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Dev-only Vite middleware: the DevHarness POSTs captured canvas PNGs to /__capture,
 * and this writes them into the gitignored `artifacts/` dir in the repo (instead of the
 * browser's Downloads folder). Lets the build agent fire a blob event and read the
 * resulting screenshot from a known repo path. No-op in production builds.
 */
export function capturePlugin(): Plugin {
  return {
    name: "blobolines-capture",
    apply: "serve",
    configureServer(server) {
      const outDir = resolve(server.config.root, "artifacts");
      const safe = (label: string) => label.replace(/[^a-z0-9-_]/gi, "_");
      const readBody = (req: Parameters<Parameters<typeof server.middlewares.use>[1]>[0]) =>
        new Promise<string>((res, rej) => {
          let body = "";
          req.on("data", (c: Buffer) => {
            // Cap body size — a captured PNG dataURL is well under this; guards OOM.
            if (body.length > 16_000_000) {
              res(body);
              return;
            }
            body += c;
          });
          req.on("end", () => res(body));
          req.on("error", rej);
        });

      server.middlewares.use("/__capture", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        readBody(req)
          .then((body) => {
            try {
              const { label, dataUrl } = JSON.parse(body) as { label: string; dataUrl: string };
              const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
              mkdirSync(outDir, { recursive: true });
              const file = resolve(outDir, `${safe(label)}.png`);
              writeFileSync(file, Buffer.from(base64, "base64"));
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, file }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          })
          .catch((err) => {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          });
      });

      server.middlewares.use("/__diagnostics", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        readBody(req)
          .then((body) => {
            try {
              const parsed = JSON.parse(body) as { label: string };
              mkdirSync(outDir, { recursive: true });
              const file = resolve(outDir, `${safe(parsed.label)}.json`);
              writeFileSync(file, JSON.stringify(parsed, null, 2));
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, file }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          })
          .catch((err) => {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          });
      });
    },
  };
}
