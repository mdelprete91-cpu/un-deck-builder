import type { DeckState } from "./state";
import type { BrandTheme } from "./brand";
import { renderSlide } from "./layouts";
import { AUTOFIT_JS } from "./autofit";
import { deckStateScript } from "./deck-file";
import { inlineAssets, inlineFontCss } from "./export-html";

/**
 * The two-pager's HTML file.
 *
 * A two-pager is a printed piece, so this is not the fullscreen, arrow-key
 * deck runner: it is the pages stacked down the screen at their real size,
 * with the same A4 print rule the app uses, so Cmd+P from the file gives the
 * same PDF.
 *
 * It carries the identical `deckStateScript` payload, which is what makes it
 * the project file too — there is no server, so this file is the save.
 */
const PAGE_CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:#f2f4f6;}
#pages{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px;}
.page-sheet{width:595pt;height:842pt;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12);overflow:hidden;position:relative;}
@page{size:595pt 842pt;margin:0;}
@media print{
  html,body{background:#fff;}
  #pages{gap:0;padding:0;}
  .page-sheet{box-shadow:none;break-after:page;break-inside:avoid;}
}`;

export async function exportPageDoc(
  state: DeckState,
  theme: BrandTheme,
  title: string,
): Promise<void> {
  const fontCss = await inlineFontCss();
  // The payload is assembled after this string, never inside it.
  const body = await inlineAssets(
    state.slides
      .map(
        (s, i) =>
          `<div class="page-sheet slide-root">${renderSlide(s, theme, { index: i, total: state.slides.length })}</div>`,
      )
      .join("\n"),
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Giga Deck Builder">
<title>${title.replace(/</g, "&lt;")}</title>
<style>${fontCss}${PAGE_CSS}</style>
</head>
<body>
<div id="pages">
${body}
</div>
<script>${AUTOFIT_JS}
document.fonts.ready.then(function(){autofitAll(document.getElementById('pages'));});</script>
${deckStateScript(state)}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "two-pager"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
