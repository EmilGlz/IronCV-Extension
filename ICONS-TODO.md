# Icon Generation TODO

## Required Icons
The Chrome extension needs 3 PNG icons:
- **16x16px** - Toolbar icon
- **48x48px** - Extension management page
- **128x128px** - Chrome Web Store listing

## Design Specs
- **Background:** Transparent or white
- **Logo:** IronCV target logo (red #C41E3A)
- **Style:** Simple, recognizable at small sizes

## Quick Generation Options

### Option 1: Online Tool (Easiest - 5 min)
1. Go to https://www.favicon-generator.org/
2. Upload IronCV logo (or create simple "I" text logo)
3. Download all sizes
4. Rename to `icon16.png`, `icon48.png`, `icon128.png`
5. Place in `icons/` folder

### Option 2: Canva (Best Quality - 10 min)
1. Go to https://www.canva.com/
2. Create 128x128px design
3. Add red circle background (#C41E3A)
4. Add white "I" or "IronCV" text
5. Download as PNG
6. Resize to 48x48 and 16x16 (use https://imageresizer.com/)

### Option 3: SVG Template (included)
- File: `icons/icon.svg`
- Use online converter: https://svgtopng.com/
- Convert to 128px, 48px, 16px

## Placeholder SVG
```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <circle cx="64" cy="64" r="60" fill="#C41E3A"/>
  <text x="64" y="80" font-size="60" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold">I</text>
</svg>
```

## After Icons Ready
1. Place in `icons/` folder:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
2. Test extension with `chrome://extensions`
3. Load unpacked and verify icons appear
4. Ready for Chrome Web Store submission!

## Chrome Web Store Additional Images Needed
- **Promotional tile:** 440x280px
- **Screenshots:** 1280x800px or 640x400px (3-5 images)
- **Small tile:** 128x128px (same as icon)
