/**
 * Text autofit: every editable node carries a `data-fit` vertical budget in px
 * (derived from the template geometry). When its content is taller than the
 * budget, the font (and any px line-height) shrinks progressively — down to
 * 40% — so edited text can never overlap the elements below it.
 *
 * Clipping is a last resort only: `overflow:hidden` is applied just when the
 * text still exceeds the budget at minimum size. Text that fits stays
 * unclipped, so descenders (g, y, p) of tight line-height titles are never
 * cut off.
 *
 * Runs in the editor preview, in thumbnails, in the print root, and (as an
 * inlined script) in the exported HTML deck.
 */
export function autofitNode(node: HTMLElement): void {
  const max = Number(node.getAttribute("data-fit"));
  if (!max || node.offsetParent === null) return;

  // Remember the original sizes once; reset before measuring so edits that
  // get shorter grow the text back.
  if (!node.dataset.fitFs) {
    node.dataset.fitFs = String(parseFloat(getComputedStyle(node).fontSize));
    const inlineLh = node.style.lineHeight;
    if (/px$/.test(inlineLh)) node.dataset.fitLh = String(parseFloat(inlineLh));
  }
  const baseFs = parseFloat(node.dataset.fitFs!);
  const baseLh = node.dataset.fitLh ? parseFloat(node.dataset.fitLh) : NaN;
  node.style.fontSize = `${baseFs}px`;
  if (!Number.isNaN(baseLh)) node.style.lineHeight = `${baseLh}px`;
  node.style.maxHeight = "";
  node.style.overflow = "";

  let scale = 1;
  while (node.scrollHeight > max + 1 && scale > 0.4) {
    scale -= 0.05;
    node.style.fontSize = `${baseFs * scale}px`;
    if (!Number.isNaN(baseLh)) node.style.lineHeight = `${baseLh * scale}px`;
  }
  if (node.scrollHeight > max + 1) {
    node.style.maxHeight = `${max}px`;
    node.style.overflow = "hidden";
  }
}

export function autofitAll(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-fit]").forEach(autofitNode);
}

/** Standalone ES5 version inlined into the exported HTML deck. */
export const AUTOFIT_JS = `
function autofitNode(node){
  var max = Number(node.getAttribute('data-fit'));
  if(!max || node.offsetParent === null) return;
  if(!node.dataset.fitFs){
    node.dataset.fitFs = String(parseFloat(getComputedStyle(node).fontSize));
    if(/px$/.test(node.style.lineHeight)) node.dataset.fitLh = String(parseFloat(node.style.lineHeight));
  }
  var fs = parseFloat(node.dataset.fitFs);
  var lh = node.dataset.fitLh ? parseFloat(node.dataset.fitLh) : NaN;
  node.style.fontSize = fs + 'px';
  if(!isNaN(lh)) node.style.lineHeight = lh + 'px';
  node.style.maxHeight = '';
  node.style.overflow = '';
  var scale = 1;
  while(node.scrollHeight > max + 1 && scale > 0.4){
    scale -= 0.05;
    node.style.fontSize = (fs * scale) + 'px';
    if(!isNaN(lh)) node.style.lineHeight = (lh * scale) + 'px';
  }
  if(node.scrollHeight > max + 1){
    node.style.maxHeight = max + 'px';
    node.style.overflow = 'hidden';
  }
}
function autofitAll(root){
  var nodes = root.querySelectorAll('[data-fit]');
  for(var i = 0; i < nodes.length; i++) autofitNode(nodes[i]);
}
`;
