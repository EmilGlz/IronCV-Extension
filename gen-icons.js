const sharp = require('C:/Users/emilb/AppData/Roaming/npm/node_modules/openclaw/node_modules/sharp');
const path = require('path');

// IronCV icon: crimson circle with white "I" letter made of rectangles
const svg = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <circle cx="64" cy="64" r="62" fill="#C41E3A"/>
  <rect x="52" y="26" width="12" height="76" rx="3" fill="white"/>
  <rect x="34" y="26" width="48" height="13" rx="3" fill="white"/>
  <rect x="34" y="89" width="48" height="13" rx="3" fill="white"/>
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
