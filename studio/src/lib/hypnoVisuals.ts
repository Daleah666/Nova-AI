import type { VisualItem } from "../types";

function svgUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export function builtInVisuals(): VisualItem[] {
  const spiralArms = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const x = 400 + Math.cos(a) * 280;
    const y = 400 + Math.sin(a) * 280;
    const mx = 400 + Math.cos(a + 0.6) * 140;
    const my = 400 + Math.sin(a + 0.6) * 140;
    return `<path d="M400 400 Q ${mx} ${my} ${x} ${y}" fill="none" stroke="rgba(244,235,228,0.38)" stroke-width="10"/>`;
  }).join("");

  const rings = Array.from({ length: 12 }, (_, i) => {
    const r = 40 + i * 28;
    const op = 0.14 + (i % 2) * 0.16;
    return `<circle cx="400" cy="400" r="${r}" fill="none" stroke="rgba(232,160,184,${op})" stroke-width="14"/>`;
  }).join("");

  const petals = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const x = 400 + Math.cos(a) * 180;
    const y = 400 + Math.sin(a) * 180;
    const deg = (a * 180) / Math.PI;
    return `<ellipse cx="${x}" cy="${y}" rx="70" ry="28" transform="rotate(${deg} ${x} ${y})" fill="rgba(212,184,150,0.3)"/>`;
  }).join("");

  const tunnel = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const s = 800 - i * 90;
      const x = (800 - s) / 2;
      const fill = i % 2 === 0 ? "#3d1a28" : "#c45c7a";
      return `<rect x="${x}" y="${x}" width="${s}" height="${s}" rx="${Math.max(8, 40 - i * 3)}" fill="${fill}" opacity="${0.35 + i * 0.08}"/>`;
    })
    .join("");

  return [
    {
      id: "builtin-rose-well",
      name: "Rose well",
      source: "built-in",
      src: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
        <defs><radialGradient id="g" cx="50%" cy="50%"><stop offset="0%" stop-color="#f8d5e0"/><stop offset="55%" stop-color="#c45c7a"/><stop offset="100%" stop-color="#2a0f18"/></radialGradient></defs>
        <rect width="800" height="800" fill="#2a0f18"/>
        <circle cx="400" cy="400" r="380" fill="url(#g)"/>
        ${rings}
        <circle cx="400" cy="400" r="36" fill="#f4ebe4"/>
      </svg>`),
    },
    {
      id: "builtin-spiral",
      name: "Gold spiral",
      source: "built-in",
      src: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#160910"/>
        ${spiralArms}
        <circle cx="400" cy="400" r="22" fill="#e8a0b8"/>
      </svg>`),
    },
    {
      id: "builtin-petals",
      name: "Soft mandala",
      source: "built-in",
      src: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#1c1016"/>
        ${petals}
        <circle cx="400" cy="400" r="90" fill="none" stroke="#e8a0b8" stroke-width="6"/>
        <circle cx="400" cy="400" r="24" fill="#d4b896"/>
      </svg>`),
    },
    {
      id: "builtin-horizon",
      name: "Dusk smear",
      source: "built-in",
      src: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
        <defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3a1730"/><stop offset="40%" stop-color="#c45c7a"/>
          <stop offset="75%" stop-color="#e8b892"/><stop offset="100%" stop-color="#1a0b12"/>
        </linearGradient></defs>
        <rect width="800" height="800" fill="url(#h)"/>
        <circle cx="560" cy="220" r="90" fill="rgba(244,235,228,0.35)"/>
      </svg>`),
    },
    {
      id: "builtin-tunnel",
      name: "Velvet tunnel",
      source: "built-in",
      src: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#11080c"/>
        ${tunnel}
      </svg>`),
    },
    {
      id: "builtin-gaze",
      name: "Soft gaze",
      source: "built-in",
      src: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#221018"/>
        <ellipse cx="400" cy="400" rx="260" ry="140" fill="#f4ebe4"/>
        <ellipse cx="400" cy="400" rx="120" ry="120" fill="#6b3a4a"/>
        <ellipse cx="400" cy="400" rx="52" ry="52" fill="#1a0b12"/>
        <ellipse cx="430" cy="370" rx="18" ry="18" fill="#f4ebe4" opacity="0.7"/>
      </svg>`),
    },
  ];
}
