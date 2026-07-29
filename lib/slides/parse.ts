/**
 * Incremental extractor over the streamed JSON text of {"slides": [...]}.
 * Tracks curly-brace depth (string-aware): the root object is depth 1, each
 * slide object is depth 2. When a depth-2 object closes, its slice is parsed
 * and emitted — so slides surface one by one while the model is still writing.
 */
export class SlideStreamParser {
  private buffer = "";
  private depth = 0;
  private inString = false;
  private escaped = false;
  private slideStart = -1;

  /** Feed a text delta; returns any slide objects completed by it. */
  feed(delta: string): unknown[] {
    const completed: unknown[] = [];
    const offset = this.buffer.length;
    this.buffer += delta;

    for (let i = offset; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') {
        this.inString = true;
      } else if (ch === "{") {
        this.depth++;
        if (this.depth === 2) this.slideStart = i;
      } else if (ch === "}") {
        this.depth--;
        if (this.depth === 1 && this.slideStart >= 0) {
          try {
            completed.push(JSON.parse(this.buffer.slice(this.slideStart, i + 1)));
          } catch {
            // malformed slice — skip it, later slides still parse
          }
          this.slideStart = -1;
        }
      }
    }
    return completed;
  }
}
