import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mark = join(root, "public/brand/voixly-logomark.png");

function pngsToIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map((png) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(png.width >= 256 ? 0 : png.width, 0);
    entry.writeUInt8(png.height >= 256 ? 0 : png.height, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.buffer.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs.map((png) => png.buffer)]);
}

const [icon16, icon32, icon180] = await Promise.all([
  sharp(mark).resize(16, 16).png().toBuffer(),
  sharp(mark).resize(32, 32).png().toBuffer(),
  sharp(mark).resize(180, 180).png().toBuffer(),
]);

await sharp(mark).resize(192, 192).png().toFile(join(root, "src/app/icon.png"));
await sharp(mark).resize(180, 180).png().toFile(join(root, "src/app/apple-icon.png"));

const ico = pngsToIco([
  { buffer: icon16, width: 16, height: 16 },
  { buffer: icon32, width: 32, height: 32 },
]);
await writeFile(join(root, "public/favicon.ico"), ico);

const width = 1200;
const height = 630;
const logo = await sharp(mark).resize(168, 168).png().toBuffer();
const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#0a0f14"/>
  <rect x="0" y="0" width="8" height="${height}" fill="#FF6B4A"/>
  <text x="308" y="292" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="600" fill="#f8fafc">ClientHub</text>
  <text x="308" y="348" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" fill="#FF6B4A">Powered by Voixly</text>
  <text x="96" y="548" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" fill="#94a3b8">Billing, projects, files, and support in one secure portal.</text>
</svg>`);

await sharp({
  create: { width, height, channels: 3, background: "#0a0f14" },
})
  .composite([
    { input: overlay, top: 0, left: 0 },
    { input: logo, left: 96, top: 198 },
  ])
  .png()
  .toFile(join(root, "src/app/opengraph-image.png"));

await sharp(join(root, "src/app/opengraph-image.png")).toFile(
  join(root, "src/app/twitter-image.png")
);

console.log("Generated favicon, apple-icon, and social images");
