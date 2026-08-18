import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

// 1. Regular Icon SVG (Standard Icon for app stores, shortcuts, browser tabs)
const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0d14" />
      <stop offset="50%" stop-color="#09090b" />
      <stop offset="100%" stop-color="#050507" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe" />
      <stop offset="45%" stop-color="#4facfe" />
      <stop offset="80%" stop-color="#6b11ff" />
      <stop offset="100%" stop-color="#ff0844" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe" />
      <stop offset="100%" stop-color="#4facfe" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Base with Squircle shape -->
  <rect width="512" height="512" rx="120" fill="url(#bgGrad)" />
  <rect width="504" height="504" x="4" y="4" rx="116" fill="none" stroke="url(#accentGrad)" stroke-width="8" opacity="0.8" />

  <!-- Background Glow Orb -->
  <circle cx="256" cy="256" r="140" fill="url(#shieldGrad)" opacity="0.15" filter="url(#glow)" />

  <!-- Outer Ring with Dynamic Segment -->
  <circle cx="256" cy="256" r="165" fill="none" stroke="url(#accentGrad)" stroke-width="22" stroke-dasharray="180 50" stroke-linecap="round" />

  <!-- Inner Cloud / Vault Hexagon Frame -->
  <polygon points="256,120 370,185 370,325 256,390 142,325 142,185" fill="#13141f" stroke="url(#accentGrad)" stroke-width="12" stroke-linejoin="round" />

  <!-- Play / Stream Triangle in Center -->
  <path d="M226 195 L320 256 L226 317 Z" fill="url(#accentGrad)" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" />

  <!-- Orbiting Satellite Sparkles -->
  <circle cx="370" cy="185" r="14" fill="#00f2fe" filter="url(#glow)" />
  <circle cx="142" cy="325" r="12" fill="#ff0844" filter="url(#glow)" />
  <circle cx="256" cy="120" r="10" fill="#ffffff" />
</svg>
`;

// 2. Maskable Icon SVG (Safe zone compliant with 15% inner padding for Android adaptive launchers)
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0d14" />
      <stop offset="50%" stop-color="#09090b" />
      <stop offset="100%" stop-color="#050507" />
    </linearGradient>
    <linearGradient id="accentGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe" />
      <stop offset="45%" stop-color="#4facfe" />
      <stop offset="80%" stop-color="#6b11ff" />
      <stop offset="100%" stop-color="#ff0844" />
    </linearGradient>
    <linearGradient id="shieldGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe" />
      <stop offset="100%" stop-color="#4facfe" />
    </linearGradient>
    <filter id="glowMask" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Full Bleed Background for Maskable Icon -->
  <rect width="512" height="512" fill="url(#bgGradMask)" />

  <!-- Inner Safe-Zone Content (Scale 0.75 centered) -->
  <g transform="translate(64, 64) scale(0.75)">
    <!-- Background Glow Orb -->
    <circle cx="256" cy="256" r="140" fill="url(#shieldGradMask)" opacity="0.2" filter="url(#glowMask)" />

    <!-- Outer Ring with Dynamic Segment -->
    <circle cx="256" cy="256" r="165" fill="none" stroke="url(#accentGradMask)" stroke-width="24" stroke-dasharray="180 50" stroke-linecap="round" />

    <!-- Inner Cloud / Vault Hexagon Frame -->
    <polygon points="256,120 370,185 370,325 256,390 142,325 142,185" fill="#13141f" stroke="url(#accentGradMask)" stroke-width="14" stroke-linejoin="round" />

    <!-- Play / Stream Triangle in Center -->
    <path d="M226 195 L320 256 L226 317 Z" fill="url(#accentGradMask)" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" />

    <!-- Orbiting Satellite Sparkles -->
    <circle cx="370" cy="185" r="16" fill="#00f2fe" filter="url(#glowMask)" />
    <circle cx="142" cy="325" r="14" fill="#ff0844" filter="url(#glowMask)" />
    <circle cx="256" cy="120" r="12" fill="#ffffff" />
  </g>
</svg>
`;

async function generate() {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Save SVGs
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg.trim());

  // 2. Generate PNG sizes
  const sizes = [
    { name: 'pwa-512x512.png', size: 512, svg: standardSvg },
    { name: 'pwa-192x192.png', size: 192, svg: standardSvg },
    { name: 'pwa-maskable-512x512.png', size: 512, svg: maskableSvg },
    { name: 'pwa-maskable-192x192.png', size: 192, svg: maskableSvg },
    { name: 'apple-touch-icon.png', size: 180, svg: standardSvg },
    { name: 'apple-touch-icon-180x180.png', size: 180, svg: standardSvg },
    { name: 'apple-touch-icon-152x152.png', size: 152, svg: standardSvg },
    { name: 'apple-touch-icon-120x120.png', size: 120, svg: standardSvg },
    { name: 'favicon-32x32.png', size: 32, svg: standardSvg },
    { name: 'favicon-16x16.png', size: 16, svg: standardSvg },
  ];

  for (const item of sizes) {
    const dest = path.join(publicDir, item.name);
    await sharp(Buffer.from(item.svg))
      .resize(item.size, item.size)
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(dest);
    console.log(`Generated ${item.name} (${item.size}x${item.size})`);
  }

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
