const sharp = require('C:/Users/emilb/AppData/Roaming/npm/node_modules/openclaw/node_modules/sharp');
const path = require('path');

// IronCV icon: violet rounded square with white I-beam
const svg = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <!-- Top flange -->
  <rect x="22" y="24" width="84" height="20" rx="6" fill="white"/>
  <!-- Stem -->
  <rect x="52" y="44" width="24" height="40" fill="white"/>
  <!-- Bottom flange -->
  <rect x="22" y="84" width="84" height="20" rx="6" fill="white"/>
</svg>`;

const svgBuffer = Buffer.from(svg);
const dir = path.join(__dirname, 'icons');

const sizes = [16, 48, 128];

Promise.all(
  sizes.map(size =>
    sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, `icon${size}.png`))
      .then(() => console.log(`✓ icon${size}.png`))
  )
)
.then(() => console.log('All icons generated!'))
.catch(err => console.error('Error:', err));
