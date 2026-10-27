(function (root) {
  'use strict';
  class SaveQueue {
    constructor(send, changed, failed, delay = 140) {
      this.send = send; this.changed = changed; this.failed = failed;
      this.delay = delay; this.items = new Map(); this.running = false; this.timer = null;
      this.waiters = [];
    }
    register(id, saved, meta) {
      let item = this.items.get(id);
      if (item && (item.saving || item.dirty)) return item;
      item = { id, saved, desired: saved, meta, dirty: false, saving: false, error: '', due: 0 };
      this.items.set(id, item); return item;
    }
    update(id, value) {
      const item = this.items.get(id);
      if (!item || item.error) return;
      item.desired = value; item.dirty = String(value) !== String(item.saved);
      item.due = Date.now() + this.delay;
      this.changed(item); this.schedule();
    }
    schedule() {
      clearTimeout(this.timer);
      if (this.running) return;
      const pending = [...this.items.values()].filter(item => item.dirty && !item.error);
      if (!pending.length) { this.waiters.splice(0).forEach(resolve => resolve()); return; }
      const next = pending.reduce((a, b) => a.due <= b.due ? a : b);
      this.timer = setTimeout(() => this.pump(next), Math.max(0, next.due - Date.now()));
    }
    async pump(item) {
      this.running = true; item.saving = true;
      const submitted = item.desired;
      this.changed(item);
      try {
        const result = await this.send({ ...item.meta, value: submitted, previous: item.saved });
        item.saved = result.value;
        item.meta.dimension = result.dimension;
        item.dirty = String(item.desired) !== String(item.saved);
        this.changed(item, result);
      } catch (error) {
        item.error = error.message; item.dirty = false; item.desired = item.saved;
        this.failed(item, error);
      } finally {
        item.saving = false; this.running = false; this.changed(item); this.schedule();
      }
    }
    async flush() {
      for (const item of this.items.values()) item.due = 0;
      if (!this.running && ![...this.items.values()].some(item => item.dirty && !item.error)) return;
      const done = new Promise(resolve => this.waiters.push(resolve));
      this.schedule(); await done;
    }
    hasPending() { return this.running || [...this.items.values()].some(item => item.dirty); }
  }
  if (typeof module !== 'undefined') module.exports = SaveQueue;
  else root.SaveQueue = SaveQueue;
})(typeof window !== 'undefined' ? window : globalThis);
