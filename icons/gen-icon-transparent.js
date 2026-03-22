const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateTransparentIcon() {
  const size = 128;
  const cornerRadius = 24;
  
  // Create SVG with rounded purple rectangle and I-beam logo
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#7c3aed"/>
          <stop offset="100%" style="stop-color:#a78bfa"/>
        </linearGradient>
      </defs>
      <!-- Rounded rectangle background -->
      <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#purpleGrad)"/>
      <!-- I-beam logo (white) -->
      <g fill="white">
        <rect x="22" y="24" width="84" height="20" rx="4"/>
        <rect x="52" y="44" width="24" height="40"/>
        <rect x="22" y="84" width="84" height="20" rx="4"/>
      </g>
    </svg>
  `;
  
  // Convert SVG to PNG with transparency
  const outputPath = path.join(__dirname, 'icon128-transparent.png');
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);
  
  console.log('Created:', outputPath);
  
  // Also create 48x48 and 16x16 versions
  for (const s of [48, 16]) {
    const outPath = path.join(__dirname, `icon${s}-transparent.png`);
    await sharp(Buffer.from(svg))
      .resize(s, s)
      .png()
      .toFile(outPath);
    console.log('Created:', outPath);
  }
}

generateTransparentIcon().catch(console.error);
