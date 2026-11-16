import { controlLifetime, announcePopup } from './control-lifecycle.mjs';
const mountedDates = new WeakSet();
import { copyTokens, positionPopup } from './select-controls.mjs';

function day(year, month, date) {
  const value = new Date(0);
  value.setUTCFullYear(year, month, date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}
function iso(value) {
  return String(value.getUTCFullYear()).padStart(4, '0') + '-'
    + String(value.getUTCMonth() + 1).padStart(2, '0') + '-'
    + String(value.getUTCDate()).padStart(2, '0');
}
function parse(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, date] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || date < 1) return null;
  const result = day(year, month - 1, date);
  return iso(result) === value ? result : null;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const weekdayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function initializeDates(root = document) {
  for (const group of root.querySelectorAll('[data-date-field]')) {
    if (mountedDates.has(group)) continue;
    mountedDates.add(group);
    const lifetime = controlLifetime(group);
    const native = group.querySelector('input[type="date"]');
    const input = group.querySelector('[data-date-text]');
    const trigger = group.querySelector('[data-date-open]');
    const error = document.getElementById(native.id + '-error');
    native.dataset.controlTarget = input.id;
    native.dataset.errorTarget = error.id;
    input.dataset.validationProxyFor = native.id;
    for (const bound of [native.min, native.max]) {
      if (bound && !parse(bound)) throw new Error('Invalid date constraint: ' + bound);
    }
    const panel = element('div', 'k-popover k-select-popup k-calendar');
    panel.hidden = true;
    panel.id = native.id + '-calendar';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', '날짜 선택');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', 'false');
    (group.closest('dialog, [popover]') || document.body).append(panel);
    native.hidden = true;
    input.value = native.value;
    let opened = false;
    lifetime.disposeWith(() => { close(false); panel.remove(); });
    lifetime.listen(document, 'keylog:popup-open', event => { if (event.detail !== trigger && opened) close(false); });
    lifetime.listen(native.form || native, 'reset', () => queueMicrotask(() => { input.value = native.value; setError(''); close(false); }));
    let focusedDay;
    let cursor;
    let opener;

    function allowed(value) {
      return (!native.min || value >= native.min) && (!native.max || value <= native.max);
    }
    function setError(message) {
      error.textContent = message;
      error.hidden = !message;
      input.setCustomValidity(message);
      native.setCustomValidity(message);
      for (const field of [input, native]) {
        if (message) field.setAttribute('aria-invalid', 'true');
        else field.removeAttribute('aria-invalid');
      }
    }
    function commit(value) {
      if (!value && native.required) { setError('날짜를 입력해 주세요.'); return false; }
      if (value && !parse(value)) { setError('실제 존재하는 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.'); return false; }
      if (value && !allowed(value)) { setError('허용된 날짜 범위에서 선택해 주세요.'); return false; }
      const changed = native.value !== value;
      native.value = value;
      input.value = value;
      setError('');
      trigger.setAttribute('aria-label', value ? '날짜 선택, ' + value : '날짜 선택');
      if (changed) {
        native.dispatchEvent(new Event('input', { bubbles: true }));
        native.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    function close(returnFocus = true) {
      opened = false;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) opener?.focus();
    }
    function position() {
      if (opened) positionPopup(group, panel, { matchWidth: false, closeIfOutside: () => close(false) });
    }
    function moveMonth(delta, focusTarget = 'day') {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + delta;
      const last = day(year, month + 1, 0).getUTCDate();
      const next = day(year, month, Math.min(focusedDay.getUTCDate(), last));
      if (next.getUTCFullYear() < 1 || next.getUTCFullYear() > 9999) return;
      cursor = day(next.getUTCFullYear(), next.getUTCMonth(), 1);
      focusedDay = next;
      render(focusTarget);
    }
    function render(focusTarget = 'day') {
      panel.replaceChildren();
      const header = element('div', 'k-calendar-heading');
      const previous = element('button', 'k-button', '‹');
      previous.type = 'button';
      previous.dataset.iconOnly = '';
      previous.dataset.variant = 'quiet';
      previous.dataset.month = 'previous';
      previous.setAttribute('aria-label', '이전 달');
      previous.addEventListener('click', () => moveMonth(-1, 'previous'));
      const heading = element('strong', '', cursor.getUTCFullYear() + '년 ' + (cursor.getUTCMonth() + 1) + '월');
      heading.setAttribute('aria-live', 'polite');
      const next = element('button', 'k-button', '›');
      next.type = 'button';
      next.dataset.iconOnly = '';
      next.dataset.variant = 'quiet';
      next.dataset.month = 'next';
      next.setAttribute('aria-label', '다음 달');
      next.addEventListener('click', () => moveMonth(1, 'next'));
      header.append(previous, heading, next);
      const grid = element('div', 'k-calendar-grid');
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', heading.textContent);
      const weekdays = element('div', 'k-calendar-row');
      weekdays.setAttribute('role', 'row');
      for (const name of weekdayNames) {
        const cell = element('span', 'k-calendar-weekday', name[0]);
        cell.setAttribute('role', 'columnheader');
        cell.setAttribute('aria-label', name);
        weekdays.append(cell);
      }
      grid.append(weekdays);
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const first = day(year, month, 1).getUTCDay();
      const total = day(year, month + 1, 0).getUTCDate();
      let row;
      for (let index = 0; index < Math.ceil((first + total) / 7) * 7; index++) {
        if (index % 7 === 0) {
          row = element('div', 'k-calendar-row');
          row.setAttribute('role', 'row');
          grid.append(row);
        }
        const number = index - first + 1;
        if (number < 1 || number > total) {
          const empty = element('span');
          empty.setAttribute('role', 'gridcell');
          empty.setAttribute('aria-disabled', 'true');
          row.append(empty);
          continue;
        }
        const current = day(year, month, number);
        const value = iso(current);
        const cell = element('button', 'k-button k-calendar-day', String(number));
        cell.type = 'button';
        cell.dataset.calendarDay = '';
        cell.dataset.dateValue = value;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', value + ' ' + weekdayNames[current.getUTCDay()]);
        cell.setAttribute('aria-selected', String(value === native.value));
        cell.tabIndex = value === iso(focusedDay) ? 0 : -1;
        cell.disabled = !allowed(value);
        cell.addEventListener('click', () => { if (commit(value)) close(); });
        cell.addEventListener('keydown', event => {
          let offset;
          if (event.key === 'ArrowRight') offset = 1;
          else if (event.key === 'ArrowLeft') offset = -1;
          else if (event.key === 'ArrowDown') offset = 7;
          else if (event.key === 'ArrowUp') offset = -7;
          else if (event.key === 'Home') offset = -current.getUTCDay();
          else if (event.key === 'End') offset = 6 - current.getUTCDay();
          else if (event.key === 'PageUp' || event.key === 'PageDown') {
            event.preventDefault();
            moveMonth((event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
            return;
          } else return;
          event.preventDefault();
          const candidate = day(year, month, number + offset);
          if (candidate.getUTCFullYear() < 1 || candidate.getUTCFullYear() > 9999 || !allowed(iso(candidate))) return;
          focusedDay = candidate;
          cursor = day(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1);
          render();
        });
        row.append(cell);
      }
      const footer = element('div', 'k-calendar-footer');
      const clear = element('button', 'k-button', '날짜 지우기');
      clear.type = 'button';
      clear.dataset.variant = 'quiet';
      clear.disabled = native.required;
      clear.addEventListener('click', () => { if (commit('')) close(); });
      footer.append(clear, element('small', 'k-hint', '방향키 이동 · Enter 선택 · Esc 닫기'));
      panel.append(header, grid, footer);
      position();
      if (focusTarget) {
        const focus = focusTarget === 'day'
          ? panel.querySelector('[data-date-value="' + iso(focusedDay) + '"]')
          : panel.querySelector('[data-month="' + focusTarget + '"]');
        focus?.focus({ preventScroll: true });
      }
    }
    function open() {
      if (native.disabled || native.readOnly) return;
      announcePopup(trigger);
      opener = document.activeElement;
      const today = new Date();
      focusedDay = parse(native.value) || day(today.getFullYear(), today.getMonth(), today.getDate());
      if (native.min && iso(focusedDay) < native.min) focusedDay = parse(native.min);
      if (native.max && iso(focusedDay) > native.max) focusedDay = parse(native.max);
      cursor = day(focusedDay.getUTCFullYear(), focusedDay.getUTCMonth(), 1);
      copyTokens(group, panel);
      opened = true;
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      render();
    }
    trigger.addEventListener('click', () => opened ? close() : open());
    input.addEventListener('blur', () => commit(input.value.trim()));
    input.addEventListener('input', () => {
      // A pending invalid string must block submission without replacing the committed date.
      const value = input.value.trim();
      const message = value && !parse(value) ? '실제 존재하는 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.'
        : value && !allowed(value) ? '허용된 날짜 범위에서 선택해 주세요.' : '';
      native.setCustomValidity(message);
    });
    native.addEventListener('change', () => { input.value = native.value; });
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); commit(input.value.trim()); }
      else if (event.key === 'ArrowDown' && event.altKey) { event.preventDefault(); open(); }
      else if (event.key === 'Escape' && !opened) { input.value = native.value; setError(''); }
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        const controls = Array.from(panel.querySelectorAll('button:not(:disabled)')).filter(button => button.tabIndex >= 0);
        const boundary = event.shiftKey ? controls[0] : controls.at(-1);
        if (document.activeElement === boundary) close();
      }
    });
    lifetime.listen(document, 'pointerdown', event => {
      if (opened && !panel.contains(event.target) && !group.contains(event.target)) close(false);
    }, { capture: true });
    lifetime.listen(document, 'keydown', event => {
      if (opened && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }, true);
    lifetime.listen(window, 'resize', position);
    lifetime.listen(window, 'scroll', position, { passive: true, capture: true });
    function synchronizeAvailability() {
      input.disabled = native.disabled;
      input.readOnly = native.readOnly;
      trigger.disabled = native.disabled || native.readOnly;
      if (native.hasAttribute('aria-invalid')) input.setAttribute('aria-invalid', native.getAttribute('aria-invalid'));
      else input.removeAttribute('aria-invalid');
      if (trigger.disabled && opened) close(false);
    }
    lifetime.observe(native, synchronizeAvailability, {
      attributes: true, attributeFilter: ['disabled', 'readonly', 'aria-invalid'],
    });
    synchronizeAvailability();
    trigger.setAttribute('aria-label', native.value ? '날짜 선택, ' + native.value : '날짜 선택');
  }
}
