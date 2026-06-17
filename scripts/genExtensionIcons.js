/**
 * Rasterize the OneTap logomark into extension toolbar icons.
 *
 * Chrome MV3 action/toolbar icons must be raster (PNG), so we render the brand
 * SVG into the standard sizes. Re-run when the logo changes:
 *
 *   npx --yes -p sharp node scripts/genExtensionIcons.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SVG_PATH = path.join(__dirname, "..", "client", "public", "onetap-logomark.svg");
const OUT_DIR = path.join(__dirname, "..", "extension", "icons");
const SIZES = [16, 32, 48, 128];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const svg = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(svg, { density: 512 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(out);
    console.log(`wrote ${path.relative(process.cwd(), out)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
