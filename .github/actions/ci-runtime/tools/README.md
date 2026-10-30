# Official artifact SDK bundle

The helper ships `@actions/artifact` 6.3.1 as a CommonJS bundle so test jobs can
upload durable checkpoints without installing a second dependency tree. The
transport is the official SDK. Test commands keep their existing Node version;
the helper uses the Node 24 executable already running `actions/github-script`.

Regenerate with Node 24 from this `tools` directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run check
npm run verify
```

`package-lock.json` pins the SDK, all dependencies and esbuild 0.25.12. The build
uses no downloaded compiler or package outside that lock. `dist/provenance.json`
records package integrity/resolution, compiler version, source hashes and output
hashes. The action checks those hashes before exposing the SDK. A clean install
in a separate directory must produce byte-identical `dist` files.

`dist/THIRD_PARTY_NOTICES.txt` preserves license and notice files from every
package contributing code, including nested versions. Binary 0.3.0 declares MIT
in its package metadata and README; its complete README is preserved because the
npm archive omits a standalone license. Isarray 1.0.0 includes the full MIT grant
in its README. Three other archives omit license text: checked-in supplemental
sources retain the exact package-version Debian copyright records for chainsaw
and buffers, and the upstream LICENSE at the npm gitHead for @nodable/entities.
`LICENSE_SOURCES.json` records their URLs and hashes; builds do not fetch them.
The buffers record identifies the upstream commit adding the omitted license.

All required imports are bundled; external imports are Node built-ins. Debug's
guarded, optional `supports-color` probe remains optional, as in the installed
SDK. It is explicitly external so an unrelated application's ancestor
node_modules cannot contaminate the generated output. The SDK loads and exposes
its client with that optional package absent.

Generated bundle files stay outside product dependencies. Keep the helper's
locked source and generated notices together when copying it to a consumer.

The generated distribution retains upstream whitespace and Markdown headings.
The scoped `.gitattributes` keeps text diffs visible while allowing upstream
trailing spaces and using a longer conflict marker for those generated files.
It does not disable diff or secret scanning.

When copying this helper, also merge the repository-root `.gitleaks.toml`
allowlist if that consumer uses Gitleaks. All default detection rules remain
active. The exception requires both the exact generated bundle path and one of
two exact public Azure SDK constants: a CRC64 lookup-table entry from
`@azure/storage-common` 12.5.0 `dist/commonjs/crc64.js`, and the documented local
Azure development-storage value from that package and `@azure/storage-blob`
12.34.0 `dist/commonjs/utils/constants.js`. No other bundle content is exempt.
The locked source tarballs and their integrity values are in the package lock
and generated provenance. Gitleaks 8.30.1 controls verify that the same public
literals in another path, and an unrelated synthetic credential in the bundle,
remain detected. Revisit these exact exceptions when updating dependencies.
