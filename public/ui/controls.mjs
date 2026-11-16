import { initializeSelects, initializeMultiSelects, copyTokens, positionPopup } from './select-controls.mjs';
import { initializeInputs } from './input-controls.mjs';
import { initializeDates } from './date-controls.mjs';
import { initializeTooltips } from './tooltip-controls.mjs';
import { controlLifetime, announcePopup } from './control-lifecycle.mjs';

let nextId = 0;
const mounted = new WeakSet();
const menus = new WeakSet();
const forms = new WeakSet();
const feedback = new WeakMap();
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function iconButton(label, symbol) {
  const button = element('button', 'k-button');
  const paths = { '×': '<path d="m4 4 8 8m0-8-8 8"/>', '−': '<path d="M3 8h10"/>', '+': '<path d="M3 8h10M8 3v10"/>', '▦': '<rect x="2" y="3" width="12" height="11"/><path d="M5 1v4M11 1v4M2 7h12"/>' };
  button.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + paths[symbol] + '</svg>';
  button.type = 'button';
  button.dataset.variant = 'quiet';
  button.dataset.iconOnly = '';
  button.setAttribute('aria-label', label);
  return button;
}
function groupField(input) {
  const group = element('div', 'k-field-group');
  input.before(group);
  group.append(input);
  input.dataset.fieldFrame = 'none';
  return group;
}
function errorFor(field) {
  if (feedback.has(field)) return feedback.get(field);
  let error = document.getElementById(field.dataset.errorTarget || '');
  if (!error) {
    error = element('span', 'k-error k-field-feedback');
    error.id = field.id + '-error';
    error.hidden = true;
    const visual = field.closest('.k-select-shell, .k-field-group') || field;
    const wrapper = element('span', 'k-field-control');
    visual.before(wrapper);
    wrapper.append(visual, error);
  }
  field.dataset.errorTarget = error.id;
  const described = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  described.add(error.id);
  field.setAttribute('aria-describedby', [...described].join(' '));
  feedback.set(field, error);
  return error;
}
function validationMessage(field) {
  if (field.required && typeof field.value === 'string' && !field.value.trim()) return '필수 항목입니다.';
  const valid = field.validity;
  if (valid.valid) return '';
  if (valid.customError) return field.validationMessage;
  if (valid.valueMissing) return '필수 항목입니다.';
  if (valid.badInput) return '숫자를 입력해 주세요.';
  if (valid.typeMismatch) return field.type === 'url' ? '올바른 URL을 입력해 주세요.' : '입력 형식을 확인해 주세요.';
  if (valid.rangeUnderflow) return field.min + ' 이상의 값을 입력해 주세요.';
  if (valid.rangeOverflow) return field.max + ' 이하의 값을 입력해 주세요.';
  if (valid.stepMismatch) return '허용된 입력 단위를 확인해 주세요.';
  return '입력값을 확인해 주세요.';
}
function validate(field) {
  const message = validationMessage(field);
  const error = errorFor(field);
  error.textContent = message;
  error.hidden = !message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  return !message;
}
export function focusControl(field) {
  (document.getElementById(field.dataset.controlTarget || '') || field).focus();
}
export function validateForm(form) {
  initializeControls(form);
  const fields = [...form.querySelectorAll('input,select,textarea')].filter(field => !field.hasAttribute('data-validation-proxy-for') && field.willValidate);
  const invalid = fields.filter(field => !validate(field));
  form.dataset.validationAttempted = '';
  if (invalid[0]) focusControl(invalid[0]);
  return !invalid.length;
}

function initializeMenus(root) {
  for (const owner of root.querySelectorAll('[data-action-menu]')) {
    if (menus.has(owner)) continue;
    menus.add(owner);
    const trigger = owner.querySelector('summary');
    const panel = owner.querySelector(':scope > div');
    const lifetime = controlLifetime(owner);
    panel.id ||= 'k-menu-' + ++nextId;
    panel.classList.add('k-popover', 'k-select-popup', 'k-action-menu');
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', trigger.getAttribute('aria-label') || '작업');
    trigger.classList.add('k-button');
    trigger.dataset.iconOnly = '';
    trigger.dataset.variant = 'quiet';
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', 'false');
    (owner.closest('dialog, [popover]') || document.body).append(panel);
    panel.hidden = true;
    for (const button of panel.querySelectorAll('button')) {
      button.classList.add('k-button');
      button.dataset.variant = 'menu';
      button.setAttribute('role', 'menuitem');
      button.tabIndex = -1;
    }
    const items = () => [...panel.querySelectorAll('button:not(:disabled)')];
    function close(focus = true) {
      panel.hidden = true;
      owner.open = false;
      trigger.setAttribute('aria-expanded', 'false');
      if (focus && trigger.isConnected) trigger.focus();
    }
    function position() {
      if (!panel.hidden) positionPopup(trigger, panel, { matchWidth: false, closeIfOutside: () => close(false) });
    }
    function open(last = false) {
      announcePopup(trigger);
      copyTokens(trigger, panel);
      owner.open = true;
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      position();
      (last ? items().at(-1) : items()[0])?.focus({ preventScroll: true });
    }
    trigger.addEventListener('click', event => { event.preventDefault(); panel.hidden ? open() : close(); });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(event.key === 'ArrowUp'); }
    });
    panel.addEventListener('click', event => { if (event.target.closest('button:not(:disabled)')) close(); }, true);
    panel.addEventListener('keydown', event => {
      const choices = items(), current = choices.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      else if (event.key === 'Tab') close();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
        choices[index]?.focus();
      }
    });
    lifetime.listen(document, 'pointerdown', event => { if (!owner.contains(event.target) && !panel.contains(event.target)) close(false); }, { capture: true });
    lifetime.listen(document, 'keylog:popup-open', event => { if (event.detail !== trigger) close(false); });
    lifetime.listen(window, 'resize', position);
    lifetime.listen(window, 'scroll', position, { capture: true, passive: true });
    lifetime.observe(owner, () => { if (owner.hidden || !owner.open) close(false); }, { attributes: true, attributeFilter: ['hidden', 'open'] });
    lifetime.disposeWith(() => { close(false); panel.remove(); });
  }
}

export function initializeControls(root = document) {
  for (const button of root.querySelectorAll('button:not([data-ui="media"]):not([role="tab"]):not([data-ui="navigation"]):not([data-ui="disclosure"])')) button.classList.add('k-button');
  for (const button of root.querySelectorAll('.k-button[data-variant="danger"]:not(:has(svg))')) {
    const template = document.createElement('template');
    template.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M6 4V2h4v2M4 4l.5 10h7L12 4M6.5 6.5v5M9.5 6.5v5"/></svg>';
    button.prepend(template.content);
  }
  for (const tab of root.querySelectorAll('[role="tab"]')) { tab.classList.remove('k-button'); tab.classList.add('k-tab'); }
  for (const disclosure of root.querySelectorAll('details:not([data-action-menu])')) disclosure.classList.add('k-disclosure');
  for (const form of root.querySelectorAll('form')) {
    form.noValidate = true;
    if (forms.has(form)) continue;
    forms.add(form);
    form.addEventListener('submit', event => {
      if (!validateForm(form)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    form.addEventListener('input', event => {
      if (form.hasAttribute('data-validation-attempted') && event.target.willValidate && !event.target.hasAttribute('data-validation-proxy-for')) validate(event.target);
    });
  }
  for (const field of root.querySelectorAll('input,select,textarea')) {
    if (mounted.has(field) || field.hasAttribute('data-validation-proxy-for') || field.closest('.k-select-popup')) continue;
    mounted.add(field);
    field.id ||= 'k-field-' + ++nextId;
    const labelText = field.labels?.[0]?.querySelector(':scope > span');
    if (labelText && !field.hasAttribute('aria-labelledby')) {
      labelText.id ||= field.id + '-label';
      field.setAttribute('aria-labelledby', labelText.id);
    }
    if (field.tagName === 'SELECT') { field.classList.add('k-select'); if (!field.multiple && field.options.length > 12) field.dataset.searchable = ''; }
    else if (field.tagName === 'TEXTAREA') field.classList.add('k-textarea');
    else if (['checkbox', 'radio'].includes(field.type)) field.classList.add('k-choice');
    else if (!['file', 'hidden', 'submit', 'button'].includes(field.type)) {
      field.classList.add('k-input');
      if (field.type === 'search') {
        const group = groupField(field);
        group.dataset.searchField = '';
        const clear = iconButton('검색 지우기', '×');
        clear.classList.add('k-search-clear'); clear.dataset.searchClear = '';
        group.append(clear);
      } else if (field.type === 'number' && field.step !== 'any') {
        const group = groupField(field); group.dataset.numberField = '';
        for (const [step, label, symbol] of [[-1,'줄이기','−'],[1,'늘리기','+']]) {
          const control = iconButton(label, symbol); control.dataset.step = step; group.append(control);
        }
      } else if (field.type === 'date') {
        const group = groupField(field); group.dataset.dateField = '';
        const input = element('input', 'k-input'); input.type = 'text'; input.inputMode = 'numeric';
        input.id = field.id + '-control'; input.dataset.dateText = ''; input.dataset.fieldFrame = 'none';
        input.dataset.validationProxyFor = field.id; input.placeholder = 'YYYY-MM-DD';
        const label = field.labels?.[0];
        if (label) { label.id ||= field.id + '-label'; input.setAttribute('aria-labelledby', label.id); label.htmlFor = input.id; }
        else input.setAttribute('aria-label', field.getAttribute('aria-label') || '날짜');
        const trigger = iconButton('날짜 선택', '▦'); trigger.dataset.dateOpen = '';
        group.append(input, trigger); errorFor(field);
        input.setAttribute('aria-describedby', field.dataset.errorTarget);
      }
    }
    if (field.form && field.willValidate && !['search', 'radio', 'checkbox'].includes(field.type)) errorFor(field);
  }
  initializeSelects(root); initializeMultiSelects(root); initializeInputs(root); initializeDates(root);
  initializeMenus(root); initializeTooltips(root);
}

const busyButtons = new WeakMap();
export function setButtonBusy(button, busy) {
  if (busy) {
    if (busyButtons.has(button)) return;
    busyButtons.set(button, { disabled: button.disabled, minWidth: button.style.minWidth });
    button.style.minWidth = button.getBoundingClientRect().width + 'px';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    const previous = busyButtons.get(button);
    if (!previous) return;
    button.disabled = previous.disabled;
    button.style.minWidth = previous.minWidth;
    button.removeAttribute('aria-busy');
    busyButtons.delete(button);
  }
}

export function confirmAction({ message, confirmLabel = '확인', title = '변경 확인' }) {
  return new Promise(resolve => {
    const opener = document.activeElement;
    const dialog = element('dialog', 'k-dialog'); dialog.dataset.dialogProfile = 'confirmation';
    const heading = element('h2', '', title); heading.id = 'k-confirm-' + ++nextId;
    dialog.setAttribute('aria-labelledby', heading.id);
    const description = element('p', '', message); description.id = heading.id + '-description';
    dialog.setAttribute('aria-describedby', description.id);
    const footer = element('footer', 'k-actions');
    const cancel = element('button', 'k-button', '취소'); cancel.type = 'button'; cancel.autofocus = true;
    const confirm = element('button', 'k-button', confirmLabel); confirm.type = 'button'; confirm.dataset.variant = 'primary';
    footer.append(cancel, confirm); dialog.append(heading, description, footer); document.body.append(dialog);
    cancel.addEventListener('click', () => dialog.close('cancel'));
    confirm.addEventListener('click', () => dialog.close('confirm'));
    dialog.addEventListener('close', () => { const accepted = dialog.returnValue === 'confirm'; dialog.remove(); if (opener?.isConnected) opener.focus(); resolve(accepted); }, { once: true });
    dialog.showModal(); cancel.focus();
  });
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  const dialog = event.target.closest('dialog[open]');
  if (!dialog) return;
  const controls = [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
    .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length && !control.closest('[hidden]'));
  const boundary = event.shiftKey ? controls[0] : controls.at(-1);
  if (document.activeElement === boundary) { event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus(); }
});

document.addEventListener('close', () => announcePopup(null), true);
initializeControls();
new MutationObserver(records => {
  if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) initializeControls();
}).observe(document, { childList: true, subtree: true });
