# Dependency security review

Review date: 16 October 2026 (v1 Android candidate). This is a dated dependency assessment, not a penetration test or a claim of vulnerability-free software. Location data, permissions, storage and export threats are described in [privacy.md](privacy.md).

## Reproduced result

On Windows, Node 24.18.0 and npm 11.16.0, `npm audit --json` returned exit code 1 with **20 high, 0 moderate, 0 low and 0 critical** package findings. These are propagated affected-package entries arising from **two root advisories**, not 20 independent application attacks. `npm ls braces node-forge decode-uri-component uuid --all` confirmed the installed paths below.

Lockfile SHA-256 at this review:

```text
ACCE46D9CC6C70AE9298CBB11BE0B77F8156449BCA52CE98C062D68EFAAACBA9
```

Rerun the audit after any lockfile change; advisory data can also change without a code change.

## Unresolved roots

| Installed dependency | Advisory and impact | Observed path / assessment |
| --- | --- | --- |
| `braces@3.0.3` | [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): deeply nested patterns can exhaust the Node call stack. Affected `<=3.0.3`; advisory lists no patched version. | `expo@57.0.30 → @expo/metro@56.0.2 → metro-file-map@0.84.5 → micromatch@4.0.8 → braces`. Identified exposure is bundler/file-pattern processing. |
| `node-forge@1.4.0` | [GHSA-86w9-cpqp-85rv / CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv): malformed nested signature metadata can bypass affected RSA verification. Affected `<=1.4.0`; advisory lists no patched version. | `expo@57.0.30 → @expo/cli@57.0.31 → node-forge`, also through `@expo/code-signing-certificates@0.0.6`. Identified exposure is Expo development/signing tooling. |

Source search found no direct imports of these two packages in the app, custom plugins or preparation scripts. That observation narrows the known integration points; it does not prove their absence from every generated artifact. No exploit was executed, no runtime request path was demonstrated, and no signed-binary dependency audit was performed. The reported severity must not be relabelled as a confirmed critical network vulnerability in the riding app, nor dismissed solely because the first observed paths are tooling.

The audit suggests major downgrades, including Expo 44.0.6, as possible graph changes. Applying `npm audit fix --force` would break this SDK 57 dependency contract and is not the chosen remediation. Compatible upstream fixes must be evaluated and tested when available.

## Applied dependency changes

`package.json` includes two targeted overrides, reflected in the installed tree:

| Override | Verified installed path | Follow-up |
| --- | --- | --- |
| `decode-uri-component: 0.5.0` | `expo-router@57.0.28 → query-string@7.1.3 → decode-uri-component@0.5.0` | Recheck URL/query behavior and remove the override when upstream dependency resolution no longer needs it. |
| `xcode → uuid: 11.1.1` | `expo-sharing@57.0.23 → @expo/config-plugins@57.0.10 → xcode@3.0.1 → uuid@11.1.1` | Type/export checks do not validate native project generation; verify this path in the first EAS native build. |

These changes remove those packages from the current audit findings. They do not resolve the two roots above. The current source validation has 68 passing tests and Expo doctor 21/21. See the current [release record](release.md) for native compilation/signing results; export alone does not establish native integration.

## Controls and release decision

- Keep Metro on localhost for ordinary preview use, and build only reviewed source/configuration. Avoid processing untrusted repositories or arbitrary pattern inputs with the affected toolchain.
- Keep signing material and registry/Expo credentials outside source. Use the established Expo signing workflow; do not introduce custom verification based on an affected primitive.
- Preserve the lockfile and review dependency changes. Re-run audit, checks, Expo doctor and native builds after an upgrade or override change.
- Do not treat an `npm audit --omit=dev` result as a runtime reachability proof: Expo tooling is transitively installed through the runtime `expo` package.
- Before distributing a production candidate, re-evaluate the advisories, inspect shipping artifacts and record either a compatible remediation or an explicit release-owner risk decision with follow-up ownership.

The current disposition is documented residual tooling risk for development/source delivery. Production security review remains a release gate. An initial lockfile scan or passing tests do not close that gate.

Report a suspected issue with the app/build version and a minimal synthetic reproduction. Do not attach personal GPX tracks, tokens, certificates or private locations to public issues. No dedicated security contact or private-reporting service is configured by this repository; the repository owner must establish one before a public release.
