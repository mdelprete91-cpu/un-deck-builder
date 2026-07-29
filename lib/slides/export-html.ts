import type { Slide } from "./schema";
import type { BrandTheme } from "./brand";
import { renderSlide } from "./layouts";
import { AUTOFIT_JS } from "./autofit";

/**
 * Serialize the deck into one self-contained HTML file:
 * fonts and assets inlined as data URIs, arrow-key navigation, and the
 * template's entrance animations replayed on each slide change.
 */

const FONT_FILES = [
  "/fonts/manrope-var-normal-latin.woff2",
  "/fonts/manrope-var-normal-latin-ext.woff2",
  "/fonts/open-sans-var-normal-latin.woff2",
  "/fonts/open-sans-var-normal-latin-ext.woff2",
];

async function toDataUri(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fontFace(family: string, weight: string, dataUri: string, unicodeRange: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(${dataUri}) format('woff2');unicode-range:${unicodeRange};}`;
}

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const DECK_CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;background:#000;overflow:hidden;}
#stage{position:absolute;width:1920px;height:1080px;left:50%;top:50%;}
.deck-slide{display:none;position:absolute;inset:0;}
.deck-slide.active{display:block;}
#hud{position:fixed;right:16px;bottom:12px;font-family:system-ui,sans-serif;font-size:12px;color:#888;z-index:10;}
@keyframes deckRise{from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);}}
@keyframes deckFade{from{opacity:0;}to{opacity:1;}}
@keyframes deckGrowW{from{transform:scaleX(0);}to{transform:scaleX(1);}}
@keyframes deckGrowH{from{transform:scaleY(0);}to{transform:scaleY(1);}}
@keyframes deckRiseSm{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@media (prefers-reduced-motion: no-preference){
[data-deck-active] .ar{animation:deckRise .7s cubic-bezier(.2,.7,.25,1) both;}
[data-deck-active] .ars{animation:deckRiseSm .6s cubic-bezier(.2,.7,.25,1) both;}
[data-deck-active] .af{animation:deckFade .85s ease both;}
[data-deck-active] .agw{animation:deckGrowW .8s cubic-bezier(.2,.7,.25,1) both;transform-origin:left center;}
[data-deck-active] .agh{animation:deckGrowH .75s cubic-bezier(.2,.7,.25,1) both;transform-origin:bottom;}
}`;

const DECK_JS = `
(function(){
  var slides=document.querySelectorAll('.deck-slide');
  var stage=document.getElementById('stage');
  var hud=document.getElementById('hud');
  var i=Math.max(0,Math.min(slides.length-1,parseInt(location.hash.slice(1),10)-1||0));
  function fit(){
    var s=Math.min(innerWidth/1920,innerHeight/1080);
    stage.style.transform='translate(-50%,-50%) scale('+s+')';
  }
  function show(n){
    i=Math.max(0,Math.min(slides.length-1,n));
    slides.forEach(function(el,k){
      el.classList.toggle('active',k===i);
      if(k===i){el.setAttribute('data-deck-active','');}
      else{el.removeAttribute('data-deck-active');}
    });
    location.hash=String(i+1);
    hud.textContent=(i+1)+' / '+slides.length;
    requestAnimationFrame(function(){ autofitAll(slides[i]); });
  }
  addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();show(i+1);}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();show(i-1);}
    else if(e.key==='Home'){show(0);}
    else if(e.key==='End'){show(slides.length-1);}
  });
  addEventListener('click',function(){show(i+1);});
  addEventListener('resize',fit);
  fit();show(i);
})();`;

export async function exportHtmlDeck(slides: Slide[], theme: BrandTheme, title: string): Promise<void> {
  // 1. Inline fonts
  const [manropeLatin, manropeExt, openSansLatin, openSansExt] = await Promise.all(
    FONT_FILES.map(toDataUri),
  );
  const fontCss =
    fontFace("Manrope", "200 800", manropeExt, LATIN_EXT) +
    fontFace("Manrope", "200 800", manropeLatin, LATIN) +
    fontFace("Open Sans", "300 800", openSansExt, LATIN_EXT) +
    fontFace("Open Sans", "300 800", openSansLatin, LATIN);

  // 2. Render slides, collect referenced assets, inline them
  let body = slides
    .map((s) => `<div class="deck-slide">${renderSlide(s, theme)}</div>`)
    .join("\n");

  const assetPaths = new Set<string>();
  for (const match of body.matchAll(/src="(\/[^"]+)"/g)) assetPaths.add(match[1]);
  for (const path of assetPaths) {
    try {
      const uri = await toDataUri(path);
      body = body.split(`src="${path}"`).join(`src="${uri}"`);
    } catch {
      // missing asset (e.g. a partner logo not yet exported) — the markup's
      // onerror fallback shows the text instead
    }
  }

  // 3. Assemble the document
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, "&lt;")}</title>
<style>${fontCss}${DECK_CSS}</style>
</head>
<body>
<div id="stage">
${body}
</div>
<div id="hud"></div>
<script>${AUTOFIT_JS}${DECK_JS}</script>
</body>
</html>`;

  // 4. Download
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deck"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
