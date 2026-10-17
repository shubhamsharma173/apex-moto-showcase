// Development-only: retrieve public road geometry, never a rider's location.
import { writeFile, mkdir } from "node:fs/promises";
const routes = [
  {
    id: "lavasa",
    name: "The Lavasa escape",
    region: "Pune · Maharashtra",
    category: "Twisties",
    description:
      "Quiet bends, lake views, and a coffee stop at the waterfront. A little detour that feels like a world away.",
    coordinates: "73.7568,18.5075;73.6185,18.4771;73.5074,18.4079",
    tags: ["Lakeside", "Winding roads"],
    stops: ["Chandani Chowk", "Temghar viewpoint", "Lavasa waterfront"],
    elevation: 640,
  },
  {
    id: "mulshi",
    name: "Around the blue",
    region: "Mulshi · Maharashtra",
    category: "Scenic",
    description:
      "Follow the reservoir into the hills. Make time for the viewpoints, and take the return road at your own pace.",
    coordinates: "73.7568,18.5075;73.5103,18.5188;73.4135,18.4678",
    tags: ["Reservoir", "Weekend ride"],
    stops: ["Chandani Chowk", "Mulshi lake", "Tamhini viewpoint"],
    elevation: 480,
  },
  {
    id: "panshet",
    name: "The quiet way out",
    region: "Panshet · Maharashtra",
    category: "Easygoing",
    description:
      "A relaxed morning by the water. Open countryside and a lakeside finish make this an easy favourite.",
    coordinates: "73.8150,18.4540;73.7501,18.4095;73.6251,18.3839",
    tags: ["Countryside", "Short escape"],
    stops: ["Sinhagad Road", "Khadakwasla", "Panshet dam"],
    elevation: 310,
  },
];
const output = [];
for (const route of routes) {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${route.coordinates}?overview=full&geometries=geojson&steps=false`,
    { signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok) throw new Error(`OSRM ${response.status}`);
  const data = await response.json();
  if (data.code !== "Ok") throw new Error("No route");
  const r = data.routes[0];
  const coords = r.geometry.coordinates;
  const stride = Math.max(1, Math.floor(coords.length / 650));
  const shape = coords.filter(
    (_, i) => i % stride === 0 || i === coords.length - 1,
  );
  const { coordinates, ...metadata } = route;
  output.push({
    ...metadata,
    distanceKm: r.distance / 1000,
    durationSeconds: r.duration,
    shape,
  });
}
await mkdir("src/data", { recursive: true });
await writeFile("src/data/routes.json", JSON.stringify(output));
console.log(
  "Saved public route previews:",
  output.map((r) => ({
    id: r.id,
    points: r.shape.length,
    km: r.distanceKm.toFixed(1),
  })),
);
