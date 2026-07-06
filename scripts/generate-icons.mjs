import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// BuilderBridge icon: black rounded square, white "bridge" arc + deck + "BB".
// Matches DESIGN.md's monochrome brand (ink #111111 on white).
function iconSvg({ maskable = false } = {}) {
  // Maskable icons need ~10% safe-zone padding all around.
  const pad = maskable ? 56 : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 96}" fill="#111111"/>
  <g transform="translate(${pad}, ${pad}) scale(${(512 - 2 * pad) / 512})">
    <!-- bridge deck -->
    <rect x="76" y="300" width="360" height="28" rx="14" fill="#ffffff"/>
    <!-- bridge arch -->
    <path d="M 96 300 Q 256 120 416 300" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>
    <!-- suspension lines -->
    <line x1="176" y1="238" x2="176" y2="300" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
    <line x1="256" y1="212" x2="256" y2="300" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
    <line x1="336" y1="238" x2="336" y2="300" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
    <!-- wordmark initials -->
    <text x="256" y="424" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700"
          fill="#ffffff" text-anchor="middle" letter-spacing="2">BB</text>
  </g>
</svg>`;
}

await mkdir("public/icons", { recursive: true });

await sharp(Buffer.from(iconSvg())).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(iconSvg())).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(iconSvg({ maskable: true }))).resize(512, 512).png().toFile("public/icons/icon-512-maskable.png");
await sharp(Buffer.from(iconSvg())).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

console.log("Icons generated: icon-192, icon-512, icon-512-maskable, apple-touch-icon");
