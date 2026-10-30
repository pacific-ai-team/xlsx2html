import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const tools = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sdk = require("./dist/artifact.cjs");
const official = require("./node_modules/@actions/artifact/lib/artifact.js");
const publicExports = (value) =>
  Object.keys(value)
    .filter((name) => name !== "__esModule")
    .sort();
assert.deepEqual(publicExports(sdk), publicExports(official));
assert.equal(typeof new sdk.DefaultArtifactClient().uploadArtifact, "function");
const action = await readFile(path.join(tools, "..", "action.yml"), "utf8");
const script = action
  .split("script: |\n")[1]
  .trimEnd()
  .split("\n")
  .map((line) => line.slice(10))
  .join("\n");
const workspace = await mkdtemp(path.join(os.tmpdir(), "ci-sdk-verify-"));
const destination = path.join(workspace, ".github", "actions", "ci-runtime");
try {
  await cp(path.join(tools, ".."), destination, {
    recursive: true,
    filter: (source) =>
      !source.split(path.sep).includes("node_modules") &&
      !source.endsWith("metafile.json"),
  });
  function execute() {
    const exported = {};
    vm.runInNewContext(script, {
      require,
      process: {
        version: process.version,
        execPath: process.execPath,
        env: {
          GITHUB_WORKSPACE: workspace,
          ACTIONS_RUNTIME_TOKEN: "fixture-token",
          ACTIONS_RESULTS_URL: "https://artifact-fixture.invalid",
        },
      },
      core: {
        addPath: () => {},
        setSecret: () => {},
        exportVariable: (key, value) => {
          exported[key] = value;
        },
      },
    });
    return exported;
  }
  const exported = execute();
  assert.equal(
    typeof require(exported.CI_RUNTIME_ARTIFACT_SDK).DefaultArtifactClient,
    "function",
  );
  const bundle = path.join(destination, "tools", "dist", "artifact.cjs");
  const bytes = await readFile(bundle);
  await writeFile(
    bundle,
    Buffer.concat([bytes, Buffer.from("\n// tampered\n")]),
  );
  assert.throws(execute, /Artifact SDK bundle mismatch/);
  await writeFile(bundle, bytes);
  const lock = path.join(destination, "tools", "package-lock.json");
  await writeFile(
    lock,
    Buffer.concat([await readFile(lock), Buffer.from("\n")]),
  );
  assert.throws(execute, /Artifact SDK source provenance changed/);
  console.log(
    "Official SDK exports, dependency-free load, and tamper rejection pass",
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
