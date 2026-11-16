import { controlLifetime, announcePopup } from './control-lifecycle.mjs';
// Shared Select. The hidden native select owns value/options.
// Opened options use the same resolved tokens as their field, including inside dialogs.
let nextId = 0;
let activeSelect = null;
const mounted = new WeakSet();
const configurations = new WeakMap();
const controllers = new WeakMap();
export function configureSelect(select, configuration) {
  if (mounted.has(select)) throw new Error('Configure a Select before mounting it.');
  configurations.set(select, configuration);
}
export function openSelect(select) {
  const control = controllers.get(select);
  if (!control) throw new Error('Select has not been initialized.');
  control.synchronize();
  control.trigger.focus();
  control.open();
}
export function closeSelect(select) { controllers.get(select)?.close(false); }

export function copyTokens(source, target) {
  const style = getComputedStyle(source);
  for (const name of style) {
    if (name.startsWith('--k-')) target.style.setProperty(name, style.getPropertyValue(name));
  }
}
function tokenNumber(element, name) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  if (!Number.isFinite(value)) throw new Error('Missing select token: ' + name);
  return value;
}
export function positionPopup(trigger, panel, { matchWidth = true, closeIfOutside, maxWidth = Infinity } = {}) {
  const rect = trigger.getBoundingClientRect();
  const inset = tokenNumber(panel, '--k-popup-inset');
  const gap = tokenNumber(panel, '--k-popup-gap');
  const maximum = tokenNumber(panel, '--k-popup-max-height');
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  if (rect.bottom < inset || rect.top > height - inset) {
    if (closeIfOutside) closeIfOutside();
    else if (activeSelect?.trigger === trigger) activeSelect.close(false);
    return;
  }
  if (matchWidth) panel.style.width = Math.min(rect.width, width - inset * 2) + 'px';
  else panel.style.maxWidth = Math.min(width - inset * 2, maxWidth) + 'px';
  const below = height - rect.bottom - gap - inset;
  const above = rect.top - gap - inset;
  const flip = below < Math.min(maximum, panel.scrollHeight) && above > below;
  panel.style.maxHeight = Math.max(0, Math.min(maximum, flip ? above : below)) + 'px';
  panel.style.left = Math.max(inset, Math.min(rect.left, width - panel.offsetWidth - inset)) + 'px';
  panel.style.top = (flip ? rect.top - gap - panel.offsetHeight : rect.bottom + gap) + 'px';
}

export function initializeSelects(root = document) {
  for (const select of root.querySelectorAll('select.k-select')) {
    if (select.multiple) continue;
    if (mounted.has(select)) continue;
    mounted.add(select);
    const lifetime = controlLifetime(select);
    const id = select.id || 'k-select-' + ++nextId;
    const configuration = configurations.get(select) ?? {};
    const searchable = select.hasAttribute('data-searchable');
    select.id = id;
    const label = select.labels?.[0] || select.closest('label');
    const labelText = label?.querySelector(':scope > span') || label;
    if (labelText && !labelText.id) labelText.id = id + '-label';
    const shell = document.createElement('div');
    shell.className = searchable ? 'k-select-shell k-combobox-shell' : 'k-select-shell';
    if (select.dataset.variant) shell.dataset.variant = select.dataset.variant;
    const trigger = document.createElement(searchable ? 'input' : 'button');
    trigger.type = searchable ? 'text' : 'button';
    trigger.id = id + '-control';
    select.dataset.controlTarget = trigger.id;
    trigger.className = searchable ? 'k-input k-combobox-input' : 'k-select-trigger';
    if (searchable) {
      trigger.dataset.validationProxyFor = id;
      trigger.setAttribute('autocomplete', 'off');
      trigger.setAttribute('aria-autocomplete', 'list');
      trigger.placeholder = select.dataset.placeholder || Array.from(select.options).find(option => !option.value)?.textContent || '입력하여 검색';
    }
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-listbox');
    if (labelText) trigger.setAttribute('aria-labelledby', labelText.id);
    else trigger.setAttribute('aria-label', select.getAttribute('aria-label') || id);
    const valueText = document.createElement('span');
    valueText.className = 'k-select-value';
    const arrow = document.createElement('span');
    arrow.className = 'k-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    if (!searchable) trigger.append(valueText, arrow);
    const panel = document.createElement('div');
    panel.id = id + '-listbox';
    panel.className = 'k-popover k-select-popup';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-labelledby', labelText?.id || trigger.id);
    panel.hidden = true;
    select.before(shell);
    shell.append(trigger, select);
    if (searchable) shell.append(arrow);
    select.hidden = true;
    if (label) label.htmlFor = trigger.id;
    (select.closest('dialog, [popover]') || document.body).append(panel);
    let highlighted = -1;
    let options = [];
    let prefix = '';
    let prefixTime = 0;
    let opened = false;
    lifetime.disposeWith(() => { close(false); panel.remove(); controllers.delete(select); });
    lifetime.listen(document, 'keylog:popup-open', event => { if (event.detail !== trigger && opened) close(false); });
    lifetime.listen(select.form || select, 'reset', () => queueMicrotask(() => select.dispatchEvent(new Event('change'))));
    let query = '';

    function synchronizeValue() {
      const label = select.selectedOptions[0]?.textContent || select.dataset.placeholder || '선택';
      if (searchable) trigger.value = select.value ? label : '';
      else valueText.textContent = label;
      trigger.disabled = select.disabled;
      for (const attribute of ['aria-invalid', 'aria-describedby', 'aria-required']) {
        const value = attribute === 'aria-required' ? (select.required ? 'true' : null) : select.getAttribute(attribute);
        if (value === null) trigger.removeAttribute(attribute);
        else trigger.setAttribute(attribute, value);
      }
      if (opened) {
        if (select.disabled) close(false);
        else { renderOptions(); positionPopup(trigger, panel); setHighlight(highlighted); }
      }
    }
    function setHighlight(index, ensureVisible = true) {
      highlighted = index;
      const nodes = Array.from(panel.querySelectorAll('[role="option"]'));
      nodes.forEach((node, i) => {
        node.toggleAttribute('data-highlighted', i === index);
        node.setAttribute('aria-selected', String(i === index));
      });
      const option = nodes[index];
      if (option) {
        trigger.setAttribute('aria-activedescendant', option.id);
        if (ensureVisible) option.scrollIntoView({ block: 'nearest' });
      } else trigger.removeAttribute('aria-activedescendant');
    }
    function enabledIndices() {
      return options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
    }
    function renderOptions() {
      options = Array.from(select.options).filter(option => !option.hidden && (!searchable || !query
        || option.textContent.normalize('NFC').toLocaleLowerCase().includes(query.normalize('NFC').toLocaleLowerCase())));
      const action = configuration.createAction?.(query.trim());
      if (action) options.push({ textContent: action.label, selected: false, disabled: false, action: action.run });
      panel.replaceChildren();
      options.forEach((option, index) => {
        const row = document.createElement('div');
        row.id = id + '-option-' + index;
        row.className = 'k-option k-select-option';
        row.setAttribute('role', 'option');
        row.toggleAttribute('data-current-value', option.selected);
        row.setAttribute('aria-disabled', String(option.disabled));
        row.textContent = option.textContent;
        row.addEventListener('pointerdown', event => event.preventDefault());
        row.addEventListener('pointermove', () => { if (!option.disabled) setHighlight(index); });
        row.addEventListener('click', () => { if (!option.disabled) choose(index); });
        panel.append(row);
      });
      if (!options.length) {
        const empty = document.createElement('div');
        empty.className = 'k-select-empty';
        empty.setAttribute('role', 'status');
        empty.textContent = query ? '일치하는 항목이 없습니다.' : '선택할 항목이 없습니다.';
        panel.append(empty);
      }
      const current = options.findIndex(option => option.selected && !option.disabled);
      setHighlight(current >= 0 ? current : options.findIndex(option => !option.disabled && !option.action), false);
    }
    function open() {
      if (select.disabled || opened) return;
      announcePopup(trigger);
      activeSelect?.close(false);
      opened = true;
      activeSelect = { trigger, panel, close, position: () => positionPopup(trigger, panel),
        dismiss: () => configuration.commitOnDismiss !== false && highlighted >= 0 && !options[highlighted]?.action ? choose(highlighted, false) : close(false) };
      copyTokens(trigger, panel);
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      renderOptions();
      positionPopup(trigger, panel);
      setHighlight(highlighted);
    }
    function close(returnFocus = true) {
      opened = false;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      prefix = '';
      query = '';
      if (searchable) trigger.value = select.value ? select.selectedOptions[0]?.textContent || '' : '';
      if (activeSelect?.trigger === trigger) activeSelect = null;
      if (returnFocus) trigger.focus();
    }
    function choose(index, returnFocus = true) {
      const option = options[index];
      if (!option || option.disabled) return;
      if (option.action) { close(returnFocus); option.action(); return; }
      const changed = select.value !== option.value;
      select.value = option.value;
      close(returnFocus);
      synchronizeValue();
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function move(delta) {
      const indices = enabledIndices();
      if (!indices.length) return;
      const at = indices.indexOf(highlighted);
      setHighlight(indices[Math.max(0, Math.min(indices.length - 1, at + delta))]);
    }
    trigger.addEventListener('click', () => {
      if (!searchable) { if (opened) close(); else open(); }
      else if (!opened) { query = ''; open(); if (trigger instanceof HTMLInputElement) trigger.select(); }
    });
    if (searchable) {
      trigger.addEventListener('focus', () => { if (!opened) if (trigger instanceof HTMLInputElement) trigger.select(); });
      trigger.addEventListener('input', () => {
        query = trigger.value;
        if (!opened) open();
        else { renderOptions(); positionPopup(trigger, panel); setHighlight(highlighted); }
      });
    }
    trigger.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!opened) open();
        else move(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter' || (!searchable && event.key === ' ')) {
        event.preventDefault();
        if (opened) choose(highlighted);
        else open();
      } else if (event.key === 'Escape' && opened) {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (!searchable && (event.key === 'Home' || event.key === 'End') && opened) {
        event.preventDefault();
        const indices = enabledIndices();
        setHighlight(event.key === 'Home' ? indices[0] ?? -1 : indices.at(-1) ?? -1);
      } else if (event.key === 'Tab' && opened) {
        if (configuration.commitOnDismiss !== false && highlighted >= 0 && !options[highlighted]?.action) choose(highlighted);
        else close(false);
      } else if (!searchable && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (!opened) open();
        const now = performance.now();
        prefix = now - prefixTime > 700 ? event.key : prefix + event.key;
        prefixTime = now;
        const index = options.findIndex(option => !option.disabled
          && option.textContent.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
        if (index >= 0) setHighlight(index);
      }
    });
    controllers.set(select, { trigger, open, close, synchronize: synchronizeValue });
    select.addEventListener('change', synchronizeValue);
    lifetime.observe(select, synchronizeValue, {
      attributes: true, attributeFilter: ['disabled', 'required', 'aria-invalid', 'aria-describedby'],
      childList: true, subtree: true, characterData: true,
    });
    synchronizeValue();
  }
}

export function initializeMultiSelects(root = document) {
  for (const select of root.querySelectorAll('select.k-select[multiple]')) {
    if (mounted.has(select)) continue;
    mounted.add(select);
    const lifetime = controlLifetime(select);
    const id = select.id || 'k-multi-' + ++nextId;
    select.id = id;
    const label = select.labels?.[0] || select.closest('label');
    const labelText = label?.querySelector(':scope > span') || label;
    if (labelText && !labelText.id) labelText.id = id + '-label';
    const shell = document.createElement('div');
    shell.className = 'k-select-shell';
    const trigger = document.createElement('button');
    trigger.id = id + '-control';
    select.dataset.controlTarget = trigger.id;
    trigger.type = 'button';
    trigger.className = 'k-select-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-panel');
    if (labelText) trigger.setAttribute('aria-labelledby', labelText.id);
    else trigger.setAttribute('aria-label', select.getAttribute('aria-label') || '복수 선택');
    const value = document.createElement('span');
    value.className = 'k-select-value';
    const arrow = document.createElement('span');
    arrow.className = 'k-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.append(value, arrow);
    const panel = document.createElement('div');
    panel.id = id + '-panel';
    panel.className = 'k-popover k-select-popup k-multi-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', labelText?.id || trigger.id);
    panel.hidden = true;
    select.before(shell);
    shell.append(trigger, select);
    select.hidden = true;
    if (label) label.htmlFor = trigger.id;
    (select.closest('dialog, [popover]') || document.body).append(panel);
    let opened = false;
    lifetime.disposeWith(() => { close(false); panel.remove(); });
    lifetime.listen(document, 'keylog:popup-open', event => { if (event.detail !== trigger && opened) close(false); });
    lifetime.listen(select.form || select, 'reset', () => queueMicrotask(() => select.dispatchEvent(new Event('change'))));
    function synchronize() {
      value.textContent = Array.from(select.selectedOptions).map(option => option.textContent).join(', ') || '선택';
      trigger.disabled = select.disabled;
      for (const attribute of ['aria-invalid', 'aria-describedby', 'aria-required']) {
        const value = attribute === 'aria-required' ? (select.required ? 'true' : null) : select.getAttribute(attribute);
        if (value === null) trigger.removeAttribute(attribute); else trigger.setAttribute(attribute, value);
      }
      if (select.disabled && opened) close(false);
      if (!opened) return;
      panel.querySelectorAll('input').forEach((checkbox, index) => {
        checkbox.checked = select.options[index].selected;
        checkbox.disabled = select.options[index].disabled && !(select.options[index].selected && select.options[index].hasAttribute('data-removable'));
      });
    }
    function close(returnFocus = true) {
      opened = false;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (activeSelect?.trigger === trigger) activeSelect = null;
      if (returnFocus) trigger.focus();
    }
    function open() {
      if (select.disabled || opened) return;
      announcePopup(trigger);
      activeSelect?.close(false);
      opened = true;
      activeSelect = { trigger, panel, close, position: () => positionPopup(trigger, panel), dismiss: () => close(false) };
      copyTokens(trigger, panel);
      panel.replaceChildren();
      for (const option of select.options) {
        const row = document.createElement('label');
        row.className = 'k-option k-check k-multi-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = option.selected;
        checkbox.disabled = option.disabled && !(option.selected && option.hasAttribute('data-removable'));
        const text = document.createElement('span');
        text.textContent = option.textContent;
        row.append(checkbox, text);
        checkbox.addEventListener('change', () => {
          option.selected = checkbox.checked;
          synchronize();
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        panel.append(row);
      }
      const hint = document.createElement('p');
      hint.className = 'k-multi-hint';
      hint.textContent = select.options.length ? '복수 선택 · Esc로 목록 닫기' : '선택할 항목이 없습니다.';
      panel.append(hint);
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      positionPopup(trigger, panel);
      const first = panel.querySelector('input:not(:disabled)');
      if (first) first.focus({ preventScroll: true });
    }
    trigger.addEventListener('click', () => opened ? close() : open());
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); open(); }
      else if (event.key === 'Tab' && opened) close(false);
    });
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.querySelectorAll('input:not(:disabled)'));
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === boundary) close();
    });
    panel.addEventListener('focusout', event => {
      if (event.relatedTarget && !panel.contains(event.relatedTarget) && event.relatedTarget !== trigger) close(false);
    });
    select.addEventListener('change', synchronize);
    lifetime.observe(select, synchronize, { attributes: true, childList: true, subtree: true, characterData: true, attributeFilter: ['disabled', 'required', 'aria-invalid', 'aria-describedby', 'selected'] });
    synchronize();
  }
}

document.addEventListener('pointerdown', event => {
  if (activeSelect && !activeSelect.trigger.contains(event.target) && !activeSelect.panel.contains(event.target)) {
    activeSelect.dismiss();
  }
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activeSelect) {
    event.preventDefault();
    event.stopPropagation();
    activeSelect.close();
  }
}, true);
window.addEventListener('resize', () => activeSelect?.position());
window.addEventListener('scroll', () => activeSelect?.position(), { passive: true, capture: true });
