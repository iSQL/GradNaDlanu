import {
  closeSync,
  createWriteStream,
  mkdirSync,
  openSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
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

  // Probe: confirm we can actually CREATE files in dir. mkdirSync only proves
  // the dir exists; write permission isn't guaranteed (bind mounts can present
  // a host dir whose effective owner-in-container differs from process uid).
  // Fail loudly here so buildLogger() can catch and degrade to stdout-only —
  // otherwise the first log line emits an unhandled 'error' on a WriteStream
  // and the process dies.
  const probePath = join(opts.dir, `.write-probe-${process.pid}`);
  try {
    const fd = openSync(probePath, 'w');
    closeSync(fd);
    unlinkSync(probePath);
  } catch (err) {
    throw new Error(`log dir ${opts.dir} not writable: ${(err as Error).message}`);
  }

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
    const path = filenameFor(stamp);
    stream = createWriteStream(path, { flags: 'a' });
    // Catch async write errors (disk full, dir vanished, late perms flip) so
    // they don't kill the process via "Unhandled 'error' event". We surface
    // to stderr directly — using pino here would recurse into the same stream.
    stream.on('error', (err) => {
      console.error(`[rolling-log] write error on ${path}: ${err.message}`);
    });
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
