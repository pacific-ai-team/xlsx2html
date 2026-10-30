import { build, version as esbuildVersion } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const pkg = await readJson(path.join(root, "package.json"));
const lockBytes = await readFile(path.join(root, "package-lock.json"));
const lock = JSON.parse(lockBytes);
const supplements = await readJson(path.join(root, "LICENSE_SOURCES.json"));
if (!process.version.startsWith("v24.")) throw new Error("Build with Node 24");
if (esbuildVersion !== pkg.devDependencies.esbuild)
  throw new Error("Installed esbuild does not match the pinned compiler");

const result = await build({
  absWorkingDir: root,
  entryPoints: ["node_modules/@actions/artifact/lib/artifact.js"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  minify: true,
  keepNames: true,
  outfile: "dist/artifact.cjs",
  legalComments: "linked",
  // debug probes this optional peer inside try/catch. Never pull an unrelated
  // application's copy into the bundle through ancestor node_modules folders.
  external: ["supports-color"],
  metafile: true,
  write: false,
});
const builtins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);
for (const output of Object.values(result.metafile.outputs)) {
  for (const item of output.imports) {
    if (
      item.external &&
      !builtins.has(item.path) &&
      item.path !== "supports-color"
    )
      throw new Error(`Unbundled dependency: ${item.path}`);
  }
}

const packages = new Map();
for (const output of Object.values(result.metafile.outputs)) {
  for (const [input, contribution] of Object.entries(output.inputs)) {
    if (!contribution.bytesInOutput) continue;
    let directory = path.dirname(path.join(root, input));
    let metadata;
    while (directory !== root) {
      try {
        metadata = await readJson(path.join(directory, "package.json"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (
        metadata?.name &&
        metadata?.version &&
        lock.packages[path.relative(root, directory)]
      )
        break;
      directory = path.dirname(directory);
    }
    if (!metadata?.name || !metadata?.version)
      throw new Error(`Cannot identify package for ${input}`);
    packages.set(path.relative(root, directory), { directory, metadata });
  }
}

const notices = [];
const inventory = [];
for (const [relative, { directory, metadata }] of [...packages].sort()) {
  const key = `${metadata.name}@${metadata.version}`;
  const locked = lock.packages[relative];
  if (!locked || locked.version !== metadata.version || !locked.integrity)
    throw new Error(`No locked provenance for ${relative}`);
  const files = (await readdir(directory))
    .filter((file) =>
      /^(licen[cs]e|copying|notice|copyright)([._-].*)?$/i.test(file),
    )
    .sort();
  const texts = [];
  const sources = [];
  for (const file of files) {
    const bytes = await readFile(path.join(directory, file));
    texts.push(`${file}\n\n${bytes.toString("utf8")}`);
    sources.push({ file: `${relative}/${file}`, sha256: sha256(bytes) });
  }
  if (!texts.length && supplements[key]) {
    const source = supplements[key];
    const bytes = await readFile(path.join(root, source.file));
    if (sha256(bytes) !== source.sha256)
      throw new Error(`Changed supplemental license for ${key}`);
    texts.push(`License source: ${source.source}\n\n${bytes.toString("utf8")}`);
    sources.push(source);
  }
  if (!texts.length && ["binary@0.3.0", "isarray@1.0.0"].includes(key)) {
    const file = key === "binary@0.3.0" ? "README.markdown" : "README.md";
    const bytes = await readFile(path.join(directory, file));
    if (!/license[\s\S]*MIT/i.test(bytes.toString("utf8")))
      throw new Error(`Missing upstream README license for ${key}`);
    texts.push(
      `Complete upstream README (contains license)\n\n${bytes.toString("utf8")}`,
    );
    sources.push({ file: `${relative}/${file}`, sha256: sha256(bytes) });
  }
  if (!texts.length) throw new Error(`Missing license/notice text for ${key}`);
  notices.push(
    `${"=".repeat(78)}\n${key}\nInstalled path: ${relative}\nDeclared license: ${
      metadata.license || "not included in npm metadata; see preserved source"
    }\n\n${texts.join("\n\n")}\n`,
  );
  inventory.push({
    name: metadata.name,
    version: metadata.version,
    path: relative,
    integrity: locked.integrity,
    resolved: locked.resolved,
    license: metadata.license || null,
    notices: sources,
  });
}

const generated = new Map(
  result.outputFiles.map((file) => [
    path.basename(file.path),
    Buffer.from(file.contents),
  ]),
);
generated.set(
  "THIRD_PARTY_NOTICES.txt",
  Buffer.from(
    "Official @actions/artifact SDK dependency notices.\n" +
      "Only packages contributing code to artifact.cjs are listed.\n" +
      "Upstream notices are preserved verbatim; supplemental sources are identified.\n\n" +
      notices.join("\n"),
  ),
);
generated.set(
  "provenance.json",
  Buffer.from(
    JSON.stringify(
      {
        sdk: {
          name: "@actions/artifact",
          version: pkg.dependencies["@actions/artifact"],
        },
        compiler: {
          name: "esbuild",
          version: esbuildVersion,
          target: "node24",
        },
        optional_external: [
          "supports-color (debug's guarded terminal-color probe)",
        ],
        lock_sha256: sha256(lockBytes),
        build_sha256: sha256(await readFile(path.join(root, "build.mjs"))),
        outputs: Object.fromEntries(
          [...generated].map(([name, bytes]) => [name, sha256(bytes)]),
        ),
        packages: inventory,
      },
      null,
      2,
    ) + "\n",
  ),
);
await mkdir(path.join(root, "dist"), { recursive: true });
for (const [name, bytes] of generated) {
  const destination = path.join(root, "dist", name);
  if (check) {
    if (!(await readFile(destination)).equals(bytes))
      throw new Error(`Stale generated artifact: ${name}; run npm run build`);
  } else {
    await writeFile(destination, bytes);
  }
}
if (!check) {
  const require = createRequire(import.meta.url);
  const sdk = require("./dist/artifact.cjs");
  if (typeof sdk.DefaultArtifactClient !== "function")
    throw new Error("Bundled official artifact client export is missing");
  new sdk.DefaultArtifactClient();
}
console.log(
  `${check ? "Verified" : "Built"} official SDK ${pkg.dependencies["@actions/artifact"]}; ` +
    `${inventory.length} packages with preserved notices; ${generated.get("artifact.cjs").length} bytes`,
);
