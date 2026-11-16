// Dynamic forms can be replaced by Studio. No popup, observer or window listener outlives its field.
const lifetimes = new Map();
export function controlLifetime(owner) {
  const abort = new AbortController();
  const disposers = [];
  lifetimes.set(owner, () => { abort.abort(); disposers.forEach(dispose => dispose()); });
  return {
    listen(target, type, listener, options = {}) { target.addEventListener(type, listener, { ...options, signal: abort.signal }); },
    observe(target, callback, options) { const observer = new MutationObserver(callback); observer.observe(target, options); disposers.push(() => observer.disconnect()); },
    disposeWith(callback) { disposers.push(callback); },
  };
}
new MutationObserver(() => {
  for (const [owner, dispose] of lifetimes) if (!owner.isConnected) { dispose(); lifetimes.delete(owner); }
}).observe(document, { childList: true, subtree: true });
export function announcePopup(trigger) {
  document.dispatchEvent(new CustomEvent('keylog:popup-open', { detail: trigger }));
}
