import { mkdir, copyFile } from "node:fs/promises";
// Metro bundles the main module. MapLibre's module worker needs its original
// sibling shared module, served from the same origin in development and export.
const target = new URL("../public/vendor/maplibre/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(
    new URL(`../node_modules/maplibre-gl/dist/${file}`, import.meta.url),
    new URL(file, target),
  );
}
await copyFile(
  new URL("../node_modules/maplibre-gl/LICENSE.txt", import.meta.url),
  new URL("LICENSE.txt", target),
);
