// Generates the WebP files the site actually ships. Sources stay untouched:
// add photos to assets/<gallery>/ and this runs before dev/build.
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputRoot = path.join(root, "assets", "optimized");
const galleries = [
  "self1",
  "project1",
  "project2",
  "relevantexperience1",
  "relevantexperience2",
];
const imageFile = /\.(jpe?g|png|webp)$/i;

const modified = async (file) => {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0;
  }
};

async function optimize(input, output, resize, webp) {
  if ((await modified(output)) >= (await modified(input))) return 0;

  await mkdir(path.dirname(output), { recursive: true });
  await sharp(input).rotate().resize(resize).webp(webp).toFile(output);
  return (await stat(output)).size;
}

let total = 0;

for (const gallery of galleries) {
  const sourceDir = path.join(root, "assets", gallery);
  const outputDir = path.join(outputRoot, gallery);
  const sources = (await readdir(sourceDir)).filter((file) => imageFile.test(file));
  const expected = new Set(sources.map((file) => file.replace(/\.[^.]+$/, ".webp")));

  for (const file of sources) {
    total += await optimize(
      path.join(sourceDir, file),
      path.join(outputDir, file.replace(/\.[^.]+$/, ".webp")),
      { width: 1800, height: 1800, fit: "inside", withoutEnlargement: true },
      { quality: 82, alphaQuality: 90, effort: 5 },
    );
  }

  for (const file of await readdir(outputDir).catch(() => [])) {
    if (!expected.has(file)) await rm(path.join(outputDir, file), { force: true });
  }
}

total += await optimize(
  path.join(root, "assets", "laptop.png"),
  path.join(outputRoot, "laptop.webp"),
  { width: 1536, height: 1536, fit: "inside", withoutEnlargement: true },
  { quality: 88, alphaQuality: 95, effort: 5 },
);

total += await optimize(
  path.join(root, "assets", "lcdlines.png"),
  path.join(outputRoot, "lcdlines.webp"),
  { width: 1920, height: 1920, fit: "inside", withoutEnlargement: true },
  { quality: 85, alphaQuality: 90, effort: 5 },
);

if (total) console.log(`optimized ${Math.round(total / 1024)} kB of images`);
