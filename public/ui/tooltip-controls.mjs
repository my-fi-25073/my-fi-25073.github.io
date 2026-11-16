import { copyTokens, positionPopup } from './select-controls.mjs';
const bound = new WeakSet();
let tooltip;
let active;
let showTimer;
let hideTimer;

function hide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (active) {
    const descriptions = (active.getAttribute('aria-describedby') || '').split(/\s+/)
      .filter(id => id && id !== tooltip.id);
    if (descriptions.length) active.setAttribute('aria-describedby', descriptions.join(' '));
    else active.removeAttribute('aria-describedby');
  }
  active = null;
  if (tooltip) tooltip.hidden = true;
}
function position() {
  if (!active) return;
  if (!active.isConnected || !active.getClientRects().length) { hide(); return; }
  const maximum = Number.parseFloat(getComputedStyle(tooltip).getPropertyValue('--k-tooltip-max-width'));
  if (!Number.isFinite(maximum)) throw new Error('Missing tooltip width token.');
  positionPopup(active, tooltip, { matchWidth: false, maxWidth: maximum, closeIfOutside: hide });
}
function show(trigger) {
  if (trigger.matches(':disabled') || trigger.isContentEditable || !trigger.dataset.tooltip) return;
  hide();
  active = trigger;
  tooltip.textContent = trigger.dataset.tooltip;
  (trigger.closest('dialog, [popover]') || document.body).append(tooltip);
  copyTokens(trigger, tooltip);
  tooltip.hidden = false;
  const descriptions = new Set((trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  descriptions.add(tooltip.id);
  trigger.setAttribute('aria-describedby', [...descriptions].join(' '));
  position();
}
export function initializeTooltips(root = document) {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'keylog-tooltip';
    tooltip.className = 'k-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.append(tooltip);
    tooltip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    tooltip.addEventListener('pointerleave', () => { hideTimer = setTimeout(hide, 100); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, true);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true, capture: true });
  }
  for (const trigger of root.querySelectorAll('[data-tooltip]')) {
    if (bound.has(trigger)) continue;
    bound.add(trigger);
    trigger.addEventListener('pointerenter', () => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => show(trigger), 300);
    });
    trigger.addEventListener('pointerleave', () => {
      clearTimeout(showTimer);
      hideTimer = setTimeout(hide, 100);
    });
    trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) show(trigger); });
    trigger.addEventListener('blur', hide);
    trigger.addEventListener('pointerdown', hide);
    trigger.addEventListener('keydown', hide);
  }
}
