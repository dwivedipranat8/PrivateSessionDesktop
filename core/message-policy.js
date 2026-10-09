'use strict';
(function () {
  class MessagePolicy {
    constructor(createdAt) {
      if (!Number.isFinite(createdAt)) throw Error('Invalid start');
      this.createdAt = createdAt;
      this.seenAt = null;
    }
    markSeen(now) {
      if (!Number.isFinite(now) || now < this.createdAt) return false;
      if (this.seenAt !== null || now >= this.expiresAt()) return false;
      this.seenAt = now;
      return true;
    }
    expiresAt() {
      const fallback = this.createdAt + 120000;
      return this.seenAt === null ? fallback : this.seenAt + 120000;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {MessagePolicy};
  else if (typeof window !== 'undefined') window.MessagePolicy = MessagePolicy;
})();
