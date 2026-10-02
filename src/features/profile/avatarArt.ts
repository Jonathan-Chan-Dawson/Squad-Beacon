const skin = ["#F1BD94", "#B97550", "#E3A776", "#875135", "#FFD8B3", "#CC916C"];
const shirts = [
  "#8D75DF",
  "#48B7A6",
  "#EF9A68",
  "#E7789E",
  "#679ED5",
  "#A3BC58",
];
export function avatarSeed(id: string) {
  return [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 216;
}
export function miniAvatarSvg(seed: number) {
  const n = Math.abs(Math.trunc(seed)) % 216,
    tone = skin[n % 6],
    shirt = shirts[Math.floor(n / 6) % 6],
    hair = ["#392D35", "#69412D", "#D3A056", "#272A40", "#9E5543", "#DBD6D0"][
      Math.floor(n / 36) % 6
    ];
  const curl = n % 3 === 0,
    glasses = n % 5 === 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="47" fill="${shirt}" opacity=".18"/><ellipse cx="48" cy="89" rx="29" ry="6" fill="#263846" opacity=".14"/><path d="M20 89 Q20 63 48 63 Q76 63 76 89" fill="${shirt}"/><path d="M41 63 L41 73 Q48 80 55 73 L55 63" fill="${tone}"/><ellipse cx="48" cy="40" rx="24" ry="28" fill="${hair}"/><circle cx="25" cy="45" r="5" fill="${tone}"/><circle cx="71" cy="45" r="5" fill="${tone}"/><ellipse cx="48" cy="44" rx="22" ry="25" fill="${tone}"/><path d="${curl ? "M25 36 Q18 17 32 20 Q35 8 45 17 Q55 8 61 19 Q76 17 71 35 Q56 25 44 27 Z" : "M25 36 Q24 10 49 14 Q73 14 72 36 Q55 34 51 23 Q43 35 25 36"}" fill="${hair}"/><circle cx="40" cy="44" r="2.3" fill="#292332"/><circle cx="57" cy="44" r="2.3" fill="#292332"/><path d="M42 55 Q48 61 55 54" fill="none" stroke="#723F3A" stroke-width="2.5" stroke-linecap="round"/>${glasses ? '<g fill="none" stroke="#32364F" stroke-width="2"><rect x="31" y="38" width="16" height="12" rx="4"/><rect x="50" y="38" width="16" height="12" rx="4"/><path d="M47 42h3"/></g>' : ""}<path d="M34 80 L34 90 M63 80 L63 90" stroke="#FFFFFF" stroke-opacity=".3" stroke-width="3"/></svg>`;
}
