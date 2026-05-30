import { createWriteStream, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';

interface Options {
  // Where the log files live. Created (recursive) on first write.
  dir: string;
  // Filename prefix. Final shape: `${prefix}YYYY-MM-DD.log`.
  prefix: string;
  // How many days of files to keep. Older ones get unlinked on rotation.
  retentionDays: number;
}

// UTC date stamp — using UTC avoids the "midnight in Belgrade vs. container TZ"
// gotcha that can otherwise produce two rotations on the same calendar day when
// the host TZ and container TZ disagree.
function todayUtcStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Pino's multistream accepts any Writable. We rotate lazily inside `_write`
// rather than on a timer so a process that idles past midnight doesn't leak
// the old file handle indefinitely — the first write after the day boundary
// closes the previous handle, opens the new one, and prunes the tail.
export function createRollingFileStream(opts: Options): Writable {
  mkdirSync(opts.dir, { recursive: true });

  let currentStamp = '';
  let stream: WriteStream | null = null;

  const filenameFor = (stamp: string): string =>
    join(opts.dir, `${opts.prefix}${stamp}.log`);

  const prune = () => {
    try {
      const entries = readdirSync(opts.dir);
      const ours = entries
        .filter((f) => f.startsWith(opts.prefix) && f.endsWith('.log'))
        .sort(); // ISO YYYY-MM-DD sorts chronologically ascending.
      const stale = ours.slice(0, Math.max(0, ours.length - opts.retentionDays));
      for (const f of stale) {
        try { unlinkSync(join(opts.dir, f)); } catch { /* best effort */ }
      }
    } catch { /* dir vanished; will recreate on next mkdirSync */ }
  };

  const rotateIfNeeded = () => {
    const stamp = todayUtcStamp();
    if (stamp === currentStamp && stream) return;
    if (stream) { try { stream.end(); } catch { /* ignore */ } }
    currentStamp = stamp;
    stream = createWriteStream(filenameFor(stamp), { flags: 'a' });
    prune();
  };

  return new Writable({
    write(chunk, _enc, cb) {
      try {
        rotateIfNeeded();
        stream!.write(chunk, cb);
      } catch (err) {
        cb(err as Error);
      }
    },
    final(cb) {
      if (stream) stream.end(cb);
      else cb();
    },
  });
}
