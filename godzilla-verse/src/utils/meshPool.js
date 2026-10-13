// A small pool of module Web Workers running meshWorker.js. Each worker is allowed
// PER_WORKER jobs in flight so it never idles between messages, but the queue stays short
// enough that the nearest-first ordering decided on the main thread still means something.

const PER_WORKER = 3;

export function defaultWorkerCount() {
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  return Math.min(4, Math.max(2, cores - 1));
}

export class MeshPool {
  /**
   * @param {number} size worker count
   * @param {(result) => void} onResult called with each worker reply
   * @param {(err) => void} onFail called once if any worker errors (caller falls back)
   */
  constructor(size, onResult, onFail) {
    this.workers = [];
    this.dead = false;
    for (let i = 0; i < size; i++) {
      // The `new Worker(new URL(...), { type: 'module' })` form is what Vite rewrites
      // (including under a non-root `base`), so keep it literal.
      const w = new Worker(new URL('./meshWorker.js', import.meta.url), { type: 'module' });
      w.load = 0;
      w.onmessage = (e) => {
        w.load--;
        onResult(e.data);
      };
      w.onerror = (e) => {
        if (this.dead) return;
        this.dead = true;
        onFail(e);
      };
      this.workers.push(w);
    }
  }

  get size() {
    return this.workers.length;
  }

  get inFlight() {
    let n = 0;
    for (const w of this.workers) n += w.load;
    return n;
  }

  hasCapacity() {
    for (const w of this.workers) if (w.load < PER_WORKER) return true;
    return false;
  }

  /** Hand a padded section copy to the least-loaded worker. The buffer is transferred. */
  submit(id, key, pad) {
    let best = this.workers[0];
    for (const w of this.workers) if (w.load < best.load) best = w;
    best.load++;
    best.postMessage({ id, key, pad: pad.buffer }, [pad.buffer]);
  }

  dispose() {
    this.dead = true;
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
  }
}
