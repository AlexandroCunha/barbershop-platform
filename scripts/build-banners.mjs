// Builds the README banners in English and Portuguese:
//   docs/banner.svg, docs/banner.pt-BR.svg       the header hero
//   docs/carousel.svg, docs/carousel.pt-BR.svg   the animated screenshot carousel
//
// Every banner uses the same 1000 x 640 canvas and the same type scale, so they line up when
// GitHub shows them at full width. GitHub strips scripts from README images, so the carousel is
// an animated SVG: each screenshot is embedded as a JPEG and shown in turn with SMIL animations.
// Run it after changing docs/screenshots or the copy: `npm run banners`.
// Image resizing uses macOS `sips`.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SHOTS_DIR = join(ROOT, "docs", "screenshots");

// One place for the canvas and the type scale, shared by every banner.
const CANVAS = { width: 1000, height: 640 };
const FONT = {
  serif: "DM Serif Display, Georgia, serif",
  sans: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
};
const TYPE = {
  eyebrow: { family: FONT.sans, size: 14, weight: 600, tracking: 4 },
  hero: { family: FONT.serif, size: 104, weight: 400 },
  heading: { family: FONT.serif, size: 30, weight: 400 },
  lead: { family: FONT.sans, size: 24, weight: 400 },
  body: { family: FONT.sans, size: 18, weight: 400 },
  button: { family: FONT.sans, size: 17, weight: 600 },
  counter: { family: FONT.sans, size: 14, weight: 600 },
  ticker: { family: FONT.serif, size: 18, weight: 400, style: "italic" },
};
const COLORS = {
  paper: "#f3f0e9",
  card: "#fbfaf7",
  charcoal: "#171717",
  olive: "#41483a",
  copper: "#b77951",
  copperInk: "#8a5a3b",
  muted: "#5e5a53",
};

const SECONDS_PER_SLIDE = 4;
const FADE_SECONDS = 0.6;
const IMAGE_BOX = { x: 40, y: 80, width: 920, height: 420 };

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
];

const COPY = {
  en: {
    eyebrow: "BOOKING FOR BARBERSHOPS",
    title: "Barbearia",
    lead: ["Every shop gets its own address,", "website and calendar."],
    cta: "Book an appointment",
    link: "View services",
    ticker: "Haircut · Skin fade · Beard trim · Haircut and beard · Book online · Arrive when it suits you",
    carouselEyebrow: "BARBEARIA · PREVIEW",
    carouselTitle: "Barbearia screenshots",
    carouselDesc: "Screenshots of the website, booking and owner area, shown in turn.",
  },
  pt: {
    eyebrow: "AGENDAMENTO PARA BARBEARIAS",
    title: "Barbearia",
    lead: ["Cada barbearia ganha o próprio endereço,", "site e agenda."],
    cta: "Agendar horário",
    link: "Ver serviços",
    ticker: "Corte · Degradê · Barba · Corte e barba · Agende online · Chegue no seu horário",
    carouselEyebrow: "BARBEARIA · PRÉVIA",
    carouselTitle: "Capturas de tela da Barbearia",
    carouselDesc: "Capturas do site, do agendamento e da área do dono, em sequência.",
  },
};

const escapeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const textAttrs = (style, extra = "") =>
  `font-family="${style.family}" font-size="${style.size}" font-weight="${style.weight}"` +
  `${style.style ? ` font-style="${style.style}"` : ""}` +
  `${style.tracking ? ` letter-spacing="${style.tracking}"` : ""} ${extra}`.trimEnd();

const svgOpen = (titleId, title, desc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" role="img" aria-labelledby="${titleId}-title ${titleId}-desc">
  <title id="${titleId}-title">${escapeXml(title)}</title>
  <desc id="${titleId}-desc">${escapeXml(desc)}</desc>`;

const workDir = mkdtempSync(join(tmpdir(), "banners-"));

function shotAsDataUri(file, maxSize = 900) {
  const out = join(workDir, `${maxSize}-${file.replace(/\.png$/, ".jpg")}`);
  execFileSync("sips", ["-Z", String(maxSize), "-s", "format", "jpeg", "-s", "formatOptions", "80", join(SHOTS_DIR, file), "--out", out], {
    stdio: "ignore",
  });
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
}

// Keyframes that show one slide during its slot of the cycle, fading in and out.
function slideAnimation(index, total) {
  const cycle = total * SECONDS_PER_SLIDE;
  const fade = FADE_SECONDS / cycle;
  const start = index / total;
  const end = (index + 1) / total;
  const keyTimes = [0, start, start + fade, end - fade, end, 1].map((t) => t.toFixed(4)).join(";");
  return `<animate attributeName="opacity" dur="${cycle}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="0;0;1;1;0;0"/>`;
}

function buildHeader(lang) {
  const copy = COPY[lang];
  const panel = { x: 600, y: 120, width: 360, height: 400 };
  return `${svgOpen("header", copy.title, copy.lead.join(" "))}
  <rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.paper}"/>

  <rect x="${panel.x + 28}" y="${panel.y + 28}" width="${panel.width}" height="${panel.height}" fill="none" stroke="${COLORS.charcoal}" stroke-opacity="0.3"/>
  <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${COLORS.olive}"/>
  <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="6" fill="${COLORS.copper}"/>
  <text x="${panel.x + panel.width / 2}" y="${panel.y + panel.height / 2 + 80}" text-anchor="middle" ${textAttrs({ family: FONT.serif, size: 240, weight: 400 }, `fill="${COLORS.paper}"`)}>B</text>

  <text x="60" y="150" ${textAttrs(TYPE.eyebrow, `fill="${COLORS.copperInk}"`)}>${escapeXml(copy.eyebrow)}</text>
  <text x="56" y="268" ${textAttrs(TYPE.hero, `fill="${COLORS.charcoal}"`)}>${escapeXml(copy.title)}</text>
  <text x="60" y="326" ${textAttrs(TYPE.lead, `fill="${COLORS.muted}"`)}>${escapeXml(copy.lead[0])}</text>
  <text x="60" y="358" ${textAttrs(TYPE.lead, `fill="${COLORS.muted}"`)}>${escapeXml(copy.lead[1])}</text>

  <rect x="60" y="400" width="280" height="54" rx="27" fill="${COLORS.charcoal}"/>
  <text x="200" y="433" text-anchor="middle" ${textAttrs(TYPE.button, `fill="${COLORS.paper}"`)}>${escapeXml(copy.cta)}</text>
  <text x="364" y="433" ${textAttrs(TYPE.button, `fill="${COLORS.charcoal}"`)}>${escapeXml(copy.link)} →</text>
  <line x1="364" y1="442" x2="${364 + (copy.link.length + 2) * 9}" y2="442" stroke="${COLORS.charcoal}" stroke-width="1.5"/>

  <rect x="0" y="${CANVAS.height - 44}" width="${CANVAS.width}" height="44" fill="${COLORS.charcoal}"/>
  <text x="40" y="${CANVAS.height - 16}" ${textAttrs(TYPE.ticker, `fill="${COLORS.paper}" xml:space="preserve"`)}>${copy.ticker.split(" · ").map((item, index) => (index === 0 ? escapeXml(item) : `<tspan fill="${COLORS.copper}"> · </tspan>${escapeXml(item)}`)).join("")}</text>
</svg>
`;
}

function buildCarousel(lang) {
  const copy = COPY[lang];
  const total = SLIDES.length;
  const cycle = total * SECONDS_PER_SLIDE;
  const dotGap = 22;
  const dotsStartX = CANVAS.width / 2 - ((total - 1) * dotGap) / 2;
  const dotsY = 596;

  const slides = SLIDES.map((slide, index) => {
    const [title, caption] = slide[lang];
    const href = shotAsDataUri(slide.file);
    const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    return `
  <g opacity="0">
    ${slideAnimation(index, total)}
    <image href="${href}" x="${IMAGE_BOX.x}" y="${IMAGE_BOX.y}" width="${IMAGE_BOX.width}" height="${IMAGE_BOX.height}" preserveAspectRatio="xMidYMid meet"/>
    <text x="${CANVAS.width - 48}" y="52" text-anchor="end" ${textAttrs(TYPE.counter, `fill="${COLORS.copperInk}"`)}>${counter}</text>
    <text x="${CANVAS.width / 2}" y="528" text-anchor="middle" ${textAttrs(TYPE.heading, `fill="${COLORS.charcoal}"`)}>${escapeXml(title)}</text>
    <text x="${CANVAS.width / 2}" y="558" text-anchor="middle" ${textAttrs(TYPE.body, `fill="${COLORS.muted}"`)}>${escapeXml(caption)}</text>
  </g>`;
  }).join("");

  const dots = SLIDES.map((_, index) => {
    const cx = dotsStartX + index * dotGap;
    return `
  <circle cx="${cx}" cy="${dotsY}" r="5" fill="${COLORS.charcoal}" fill-opacity="0.18"/>
  <circle cx="${cx}" cy="${dotsY}" r="5" fill="${COLORS.copper}" opacity="0">${slideAnimation(index, total)}</circle>`;
  }).join("");

  return `${svgOpen("carousel", copy.carouselTitle, copy.carouselDesc)}
  <rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.paper}"/>
  <rect x="20" y="20" width="960" height="600" rx="24" fill="${COLORS.card}" stroke="${COLORS.copper}" stroke-width="2"/>
  <text x="48" y="52" ${textAttrs(TYPE.eyebrow, `fill="${COLORS.copperInk}"`)}>${escapeXml(copy.carouselEyebrow)}</text>
  <line x1="48" y1="66" x2="${CANVAS.width - 48}" y2="66" stroke="${COLORS.charcoal}" stroke-opacity="0.12"/>${slides}
  ${dots}
  <!-- cycle: ${total} slides x ${SECONDS_PER_SLIDE}s = ${cycle}s -->
</svg>
`;
}

// Small JPEG thumbnails of each screenshot, used as clickable previews above the carousel.
// They link to the full PNG in docs/screenshots.
const THUMBS_DIR = join(ROOT, "docs", "thumbnails");

// Every thumbnail is cover-cropped to this box, so the row has one size. The README shows them
// at half this size, which keeps them sharp on high-density screens.
const THUMB = { width: 200, height: 132 };

function imageSize(path) {
  const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], { encoding: "utf8" });
  return {
    width: Number(/pixelWidth: (\d+)/.exec(output)[1]),
    height: Number(/pixelHeight: (\d+)/.exec(output)[1]),
  };
}

function buildThumbnails() {
  mkdirSync(THUMBS_DIR, { recursive: true });
  for (const slide of SLIDES) {
    const source = join(SHOTS_DIR, slide.file);
    const out = join(THUMBS_DIR, slide.file.replace(/\.png$/, ".jpg"));
    const size = imageSize(source);
    const scale = Math.max(THUMB.width / size.width, THUMB.height / size.height);
    const scaled = { width: Math.ceil(size.width * scale), height: Math.ceil(size.height * scale) };
    execFileSync("sips", ["-z", String(scaled.height), String(scaled.width), "-s", "format", "jpeg", "-s", "formatOptions", "78", source, "--out", out], {
      stdio: "ignore",
    });
    execFileSync("sips", ["--cropToHeightWidth", String(THUMB.height), String(THUMB.width), out], { stdio: "ignore" });
    console.log(`wrote docs/thumbnails/${slide.file.replace(/\.png$/, ".jpg")} (${THUMB.width}x${THUMB.height})`);
  }
}

buildThumbnails();

const outputs = [
  { file: "banner.svg", build: () => buildHeader("en") },
  { file: "banner.pt-BR.svg", build: () => buildHeader("pt") },
  { file: "carousel.svg", build: () => buildCarousel("en") },
  { file: "carousel.pt-BR.svg", build: () => buildCarousel("pt") },
];

for (const output of outputs) {
  writeFileSync(join(ROOT, "docs", output.file), output.build());
  console.log(`wrote docs/${output.file}`);
}

rmSync(workDir, { recursive: true, force: true });
