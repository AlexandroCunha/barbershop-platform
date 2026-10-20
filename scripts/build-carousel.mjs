// Builds the animated README carousels (docs/carousel.svg and docs/carousel.pt-BR.svg).
//
// GitHub strips scripts and interactive controls from README images, so the carousel is an
// animated SVG: each screenshot is embedded as a JPEG and shown in turn with SMIL animations.
// Run it after changing docs/screenshots: `node scripts/build-carousel.mjs`.
// Image resizing uses macOS `sips`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SHOTS_DIR = join(ROOT, "docs", "screenshots");

const SLIDES = [
  {
    file: "01-website-hero.png",
    en: ["The website", "A first impression that fits the shop"],
    pt: ["O site", "Uma primeira impressão que combina com a barbearia"],
  },
  {
    file: "02-barbers-and-services-menu.png",
    en: ["Barbers and services", "Pick a barber and a service side by side"],
    pt: ["Barbeiros e serviços", "Escolha um barbeiro e um serviço lado a lado"],
  },
  {
    file: "03-booking-date-and-time.png",
    en: ["Booking", "Choose a day and a free time"],
    pt: ["Agendamento", "Escolha um dia e um horário livre"],
  },
  {
    file: "04-booking-details-and-summary.png",
    en: ["Confirm", "A live summary of the appointment"],
    pt: ["Confirmação", "Um resumo ao vivo do atendimento"],
  },
  {
    file: "05-mobile-hero.png",
    en: ["Mobile first", "It looks great on a phone"],
    pt: ["Feito para o celular", "Fica ótimo no telefone"],
  },
  {
    file: "06-mobile-barbers.png",
    en: ["Mobile barbers", "The team, one tap away"],
    pt: ["Barbeiros no celular", "A equipe a um toque de distância"],
  },
  {
    file: "07-owner-area-business.png",
    en: ["Owner area", "The owner edits everything without touching code"],
    pt: ["Área do dono", "O dono edita tudo sem mexer em código"],
  },
  {
    file: "08-owner-area-services.png",
    en: ["Services", "Prices, durations and descriptions"],
    pt: ["Serviços", "Preços, durações e descrições"],
  },
  {
    file: "09-platform-barbershops.png",
    en: ["Platform owner", "Every shop and its license in one place"],
    pt: ["Dono da plataforma", "Todas as barbearias e suas licenças em um lugar"],
  },
];

const SECONDS_PER_SLIDE = 4;
const FADE_SECONDS = 0.6;
const WIDTH = 1000;
const HEIGHT = 640;
const IMAGE_BOX = { x: 40, y: 80, width: 920, height: 420 };

const COLORS = {
  paper: "#f3f0e9",
  card: "#fbfaf7",
  charcoal: "#171717",
  olive: "#41483a",
  copper: "#b77951",
  copperInk: "#8a5a3b",
  muted: "#5e5a53",
};

const escapeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const workDir = mkdtempSync(join(tmpdir(), "carousel-"));

function shotAsDataUri(file) {
  const out = join(workDir, file.replace(/\.png$/, ".jpg"));
  execFileSync("sips", ["-Z", "900", "-s", "format", "jpeg", "-s", "formatOptions", "80", join(SHOTS_DIR, file), "--out", out], {
    stdio: "ignore",
  });
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
}

// Keyframes that show slide `index` for its slot of the cycle, fading in and out.
function slideAnimation(index, total) {
  const cycle = total * SECONDS_PER_SLIDE;
  const fade = FADE_SECONDS / cycle;
  const start = index / total;
  const end = (index + 1) / total;
  const keyTimes = [0, start, start + fade, end - fade, end, 1].map((t) => t.toFixed(4)).join(";");
  const values = "0;0;1;1;0;0";
  return `<animate attributeName="opacity" dur="${cycle}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${values}"/>`;
}

function buildCarousel(lang, label) {
  const total = SLIDES.length;
  const cycle = total * SECONDS_PER_SLIDE;
  const dotGap = 22;
  const dotsStartX = WIDTH / 2 - ((total - 1) * dotGap) / 2;

  const slides = SLIDES.map((slide, index) => {
    const [title, caption] = slide[lang];
    const href = shotAsDataUri(slide.file);
    const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    return `
  <g opacity="0">
    ${slideAnimation(index, total)}
    <image href="${href}" x="${IMAGE_BOX.x}" y="${IMAGE_BOX.y}" width="${IMAGE_BOX.width}" height="${IMAGE_BOX.height}" preserveAspectRatio="xMidYMid meet"/>
    <text x="${WIDTH - 48}" y="52" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="${COLORS.copperInk}">${counter}</text>
    <text x="${WIDTH / 2}" y="528" text-anchor="middle" font-family="DM Serif Display, Georgia, serif" font-size="30" fill="${COLORS.charcoal}">${escapeXml(title)}</text>
    <text x="${WIDTH / 2}" y="558" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="18" fill="${COLORS.muted}">${escapeXml(caption)}</text>
  </g>`;
  }).join("");

  const dots = SLIDES.map((_, index) => {
    const cx = dotsStartX + index * dotGap;
    return `
  <circle cx="${cx}" cy="594" r="5" fill="${COLORS.charcoal}" fill-opacity="0.18"/>
  <circle cx="${cx}" cy="594" r="5" fill="${COLORS.copper}" opacity="0">${slideAnimation(index, total)}</circle>`;
  }).join("");

  const title = lang === "en" ? "Barbearia screenshots" : "Capturas de tela da Barbearia";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="carousel-title carousel-desc">
  <title id="carousel-title">${escapeXml(title)}</title>
  <desc id="carousel-desc">${escapeXml(label)}</desc>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.paper}"/>
  <rect x="20" y="20" width="960" height="600" rx="24" fill="${COLORS.card}" stroke="${COLORS.copper}" stroke-width="2"/>
  <text x="48" y="52" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="3" fill="${COLORS.copperInk}">${lang === "en" ? "BARBEARIA · PREVIEW" : "BARBEARIA · PRÉVIA"}</text>
  <line x1="48" y1="66" x2="${WIDTH - 48}" y2="66" stroke="${COLORS.charcoal}" stroke-opacity="0.12"/>${slides}
  ${dots}
  <!-- cycle: ${total} slides x ${SECONDS_PER_SLIDE}s = ${cycle}s -->
</svg>
`;
}

const outputs = [
  { file: "carousel.svg", lang: "en", label: "Screenshots of the website, booking, owner area and platform area, shown in turn." },
  { file: "carousel.pt-BR.svg", lang: "pt", label: "Capturas do site, do agendamento, da área do dono e da área da plataforma, em sequência." },
];

for (const output of outputs) {
  writeFileSync(join(ROOT, "docs", output.file), buildCarousel(output.lang, output.label));
  console.log(`wrote docs/${output.file}`);
}

rmSync(workDir, { recursive: true, force: true });
