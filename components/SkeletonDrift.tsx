/**
 * The empty stage's one picture (Mario, 1 Oct 2026): a row of slide
 * skeletons drifting left to right, as if the deck were already being laid
 * out, faded at both sides so it has no edges. A row, not a column, so the
 * headline stays near the middle of the stage. Grey shapes only, no
 * words: it says "slides come here" without competing with the headline.
 * The list is drawn twice so the loop has no seam; it stands still under
 * reduced motion (globals.css, .skeleton-drift).
 */
export default function SkeletonDrift() {
  const row = (
    <div className="flex shrink-0 gap-4 pr-4">
      <Cover />
      <Bullets />
      <Chart />
      <Columns />
    </div>
  );
  return (
    <div aria-hidden className="skeleton-window relative w-[640px] max-w-full overflow-hidden">
      <div className="skeleton-drift flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="aspect-video w-[200px] shrink-0 rounded-xl border border-hairline-light bg-canvas-2 p-3.5">{children}</div>;
}

const Bar = ({ className = "" }: { className?: string }) => <div className={`rounded-full bg-mist ${className}`} />;

function Cover() {
  return (
    <Card>
      <div className="flex h-full flex-col justify-end gap-2">
        <Bar className="h-3 w-3/4" />
        <Bar className="h-3 w-1/2" />
        <Bar className="mt-1 h-2 w-1/3" />
      </div>
    </Card>
  );
}

function Bullets() {
  return (
    <Card>
      <Bar className="h-2.5 w-1/2" />
      <div className="mt-4 flex flex-col gap-2.5">
        {["w-4/5", "w-2/3", "w-3/4"].map((w) => (
          <div key={w} className="flex items-center gap-2">
            <div className="size-1.5 shrink-0 rounded-full bg-mist" />
            <Bar className={`h-2 ${w}`} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Chart() {
  return (
    <Card>
      <div className="flex h-full flex-col">
        <Bar className="h-2.5 w-2/5" />
        <div className="mt-3 flex flex-1 items-end gap-2.5">
          {["h-[35%]", "h-[60%]", "h-[45%]", "h-[85%]", "h-[70%]"].map((h) => (
            <div key={h} className={`flex-1 rounded-t-md bg-mist ${h}`} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Columns() {
  return (
    <Card>
      <Bar className="h-2.5 w-1/3" />
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Bar className="h-2 w-3/4" />
            <Bar className="h-1.5 w-full" />
            <Bar className="h-1.5 w-5/6" />
          </div>
        ))}
      </div>
    </Card>
  );
}
