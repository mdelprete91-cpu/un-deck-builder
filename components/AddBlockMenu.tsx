"use client";

import {
  AlignLeft,
  Heading2,
  BadgeInfo,
  ListOrdered,
  MonitorSmartphone,
  PanelRight,
  Sheet,
  BarChart3,
  Columns2,
  Contact,
  Image as ImageIcon,
  Images,
  LayoutPanelTop,
  ListChecks,
  Rows3,
  Table2,
  Text,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BLOCK_LABELS } from "@/lib/slides/pages/presets";
import type { PageBlockType } from "@/lib/slides/pages/schema";

/** What each block is for, one line, in the menu. */
const HINTS: Record<PageBlockType, string> = {
  section: "A label on the left, paragraphs or bullets on the right",
  stats: "Three to six figures in cards",
  pillars: "Three areas of work, each with an icon",
  figure: "A full-width photo or country map",
  compare: "Before and today, grouped by country",
  asks: "Opportunities, each with what a partner could do",
  panels: "What is running beside what you ask for",
  photos: "Two or four photo cards",
  banner: "A photo strip with the title over it",
  title: "A big title to open a page",
  contacts: "Names, roles and emails",
  lede: "A full-width paragraph under the title",
  heading: "A smaller title that opens a new part",
  callout: "A bordered note on where things stand",
  split: "A pill and text beside a picture or map",
  screens: "Two product screenshots with arrows",
  numbered: "Asks in numbered circles",
  table: "Three columns with a header row",
};

const ICONS: Record<PageBlockType, LucideIcon> = {
  section: Text,
  stats: BarChart3,
  pillars: Columns2,
  figure: ImageIcon,
  compare: Table2,
  asks: ListChecks,
  panels: LayoutPanelTop,
  photos: Images,
  banner: Rows3,
  title: Type,
  contacts: Contact,
  lede: AlignLeft,
  heading: Heading2,
  callout: BadgeInfo,
  split: PanelRight,
  screens: MonitorSmartphone,
  numbered: ListOrdered,
  table: Sheet,
};

/**
 * The block menu of a two-pager page: every block of the catalog, named for
 * what it does. Picking one inserts it with placeholder copy where the "+"
 * was pressed.
 */
export default function AddBlockMenu({
  onPick,
  onClose,
}: {
  onPick: (type: PageBlockType) => void;
  onClose: () => void;
}) {
  const types = Object.keys(BLOCK_LABELS) as PageBlockType[];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add a block"
        className="pop-in w-full max-w-md rounded-2xl bg-surface p-2 shadow-stripe-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <p className="px-3 pb-1 pt-2 text-sm font-medium text-ink">Add a block</p>
        <ul className="flex flex-col">
          {types.map((type, i) => {
            const Icon = ICONS[type];
            return (
              <li key={type}>
                <button
                  type="button"
                  autoFocus={i === 0}
                  onClick={() => onPick(type)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-mist focus-visible:bg-mist focus-visible:outline-none"
                >
                  <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{BLOCK_LABELS[type]}</span>
                    <span className="block truncate text-xs text-ink-muted">{HINTS[type]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
