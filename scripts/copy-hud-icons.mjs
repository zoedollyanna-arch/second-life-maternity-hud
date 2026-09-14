import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const destDir = join(here, "..", "src", "assets");
const srcDir = join(here, "..", "..", "pixel-perfect-main", "src", "assets");

mkdirSync(destDir, { recursive: true });

const files = [
  "icon-pregnancy.png",
  "icon-health.png",
  "icon-care.png",
  "icon-partner.png",
  "icon-journal.png",
  "icon-baby.png",
  "icon-notifications.png",
  "icon-settings.png",
];

for (const file of files) {
  const from = join(srcDir, file);
  const to = join(destDir, file);
  if (!existsSync(from)) {
    throw new Error(`Missing source icon: ${from}`);
  }
  copyFileSync(from, to);
  console.log(`copied ${file}`);
}
