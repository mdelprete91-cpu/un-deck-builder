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
 * Nodes that share a `data-fit-group` are fitted as one: each is fitted on
 * its own first, then every member takes the smallest scale of the group, so
 * a row of stat values shrinks together instead of ending up in six sizes.
 *
 * Runs in the editor preview, in thumbnails, in the print root, and (as an
 * inlined script) in the exported HTML deck: AUTOFIT_JS below is the ES5
 * copy of everything here, kept in step by hand.
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

  // Overflow check covers both axes: vertical against the fit budget, and
  // horizontal for white-space:nowrap fields (stat values) that must shrink
  // instead of breaking onto a second line.
  const overflows = () =>
    node.scrollHeight > max + 1 || node.scrollWidth > node.clientWidth + 2;

  let scale = 1;
  while (overflows() && scale > 0.4) {
    scale -= 0.05;
    node.style.fontSize = `${baseFs * scale}px`;
    if (!Number.isNaN(baseLh)) node.style.lineHeight = `${baseLh * scale}px`;
  }
  if (node.scrollHeight > max + 1) {
    node.style.maxHeight = `${max}px`;
    node.style.overflow = "hidden";
  }
}

/** The scale a fitted node landed on (1 = its original size). */
function scaleOf(node: HTMLElement): number {
  const base = parseFloat(node.dataset.fitFs ?? "");
  return base ? parseFloat(node.style.fontSize) / base : 1;
}

/** Give every member of `nodes` the smallest scale among them. */
function equalize(nodes: HTMLElement[]): void {
  const scale = Math.min(...nodes.map(scaleOf));
  for (const node of nodes) {
    const baseFs = parseFloat(node.dataset.fitFs ?? "");
    if (!baseFs) continue;
    node.style.fontSize = `${baseFs * scale}px`;
    if (node.dataset.fitLh) node.style.lineHeight = `${parseFloat(node.dataset.fitLh) * scale}px`;
    const max = Number(node.getAttribute("data-fit"));
    if (max && node.scrollHeight > max + 1) {
      node.style.maxHeight = `${max}px`;
      node.style.overflow = "hidden";
    }
  }
}

function groupsIn(root: ParentNode): HTMLElement[][] {
  const groups = new Map<string, HTMLElement[]>();
  root.querySelectorAll<HTMLElement>("[data-fit-group]").forEach((node) => {
    const name = node.getAttribute("data-fit-group")!;
    (groups.get(name) ?? groups.set(name, []).get(name)!).push(node);
  });
  return [...groups.values()];
}

/**
 * Fits every budgeted node under `root` and returns how many ended up below
 * their original size: the layout switcher shows "Text shrinks" on a
 * preview from that count.
 */
export function autofitAll(root: ParentNode): number {
  const nodes = [...root.querySelectorAll<HTMLElement>("[data-fit]")];
  nodes.forEach(autofitNode);
  groupsIn(root).forEach(equalize);
  return nodes.filter((node) => scaleOf(node) < 0.999).length;
}

/**
 * Refit one node and, when it belongs to a group, its whole group: the live
 * edit path, where typing in one value must move its siblings too. The group
 * is scoped to the nearest slide root so two slides never share a scale.
 */
export function refitNode(node: HTMLElement): void {
  const name = node.getAttribute("data-fit-group");
  if (!name) {
    autofitNode(node);
    return;
  }
  const scope: ParentNode = node.closest("section") ?? node.ownerDocument;
  const members = [...scope.querySelectorAll<HTMLElement>(`[data-fit-group="${name}"]`)];
  members.forEach(autofitNode);
  equalize(members);
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
  while((node.scrollHeight > max + 1 || node.scrollWidth > node.clientWidth + 2) && scale > 0.4){
    scale -= 0.05;
    node.style.fontSize = (fs * scale) + 'px';
    if(!isNaN(lh)) node.style.lineHeight = (lh * scale) + 'px';
  }
  if(node.scrollHeight > max + 1){
    node.style.maxHeight = max + 'px';
    node.style.overflow = 'hidden';
  }
}
function equalize(nodes){
  var scale = 1, i, node, base;
  for(i = 0; i < nodes.length; i++){
    base = parseFloat(nodes[i].dataset.fitFs || '');
    if(base) scale = Math.min(scale, parseFloat(nodes[i].style.fontSize) / base);
  }
  for(i = 0; i < nodes.length; i++){
    node = nodes[i]; base = parseFloat(node.dataset.fitFs || '');
    if(!base) continue;
    node.style.fontSize = (base * scale) + 'px';
    if(node.dataset.fitLh) node.style.lineHeight = (parseFloat(node.dataset.fitLh) * scale) + 'px';
    var max = Number(node.getAttribute('data-fit'));
    if(max && node.scrollHeight > max + 1){ node.style.maxHeight = max + 'px'; node.style.overflow = 'hidden'; }
  }
}
function autofitAll(root){
  var nodes = root.querySelectorAll('[data-fit]');
  for(var i = 0; i < nodes.length; i++) autofitNode(nodes[i]);
  var grouped = root.querySelectorAll('[data-fit-group]'), groups = {}, names = [];
  for(var j = 0; j < grouped.length; j++){
    var name = grouped[j].getAttribute('data-fit-group');
    if(!groups[name]){ groups[name] = []; names.push(name); }
    groups[name].push(grouped[j]);
  }
  for(var k = 0; k < names.length; k++) equalize(groups[names[k]]);
}
`;
