# How to Create og-image.png

Telegram requires PNG format for OG images (not SVG).

## Option 1: Use Online Converter
1. Go to https://svgtopng.com/ or https://convertio.co/svg-png/
2. Upload `public/og-image.svg`
3. Set size to 1200x630
4. Download and save as `public/og-image.png`

## Option 2: Use Browser Screenshot
1. Open `public/og-image-generator.html` in Chrome
2. Press F12 to open DevTools
3. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
4. Type "screenshot" and select "Capture full size screenshot"
5. Save as `public/og-image.png`

## Option 3: Use ImageMagick (if installed)
```bash
convert -background "#050609" -size 1200x630 public/og-image.svg public/og-image.png
```

After creating the PNG, rebuild and redeploy.
