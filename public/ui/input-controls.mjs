import { controlLifetime } from './control-lifecycle.mjs';
const mountedInputs = new WeakSet();

export function initializeInputs(root = document) {
  for (const group of root.querySelectorAll('[data-search-field]')) {
    if (mountedInputs.has(group)) continue;
    mountedInputs.add(group);
    const lifetime = controlLifetime(group);
    const input = group.querySelector('input[type="search"]');
    const clear = group.querySelector('[data-search-clear]');
    function synchronize() {
      const available = Boolean(input.value) && !input.disabled && !input.readOnly;
      clear.toggleAttribute('data-empty', !available);
      clear.disabled = !available;
      clear.setAttribute('aria-hidden', String(!available));
    }
    function clearQuery() {
      input.value = '';
      synchronize();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
    }
    clear.addEventListener('click', clearQuery);
    input.addEventListener('input', synchronize);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && input.value && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        clearQuery();
      }
    });
    lifetime.observe(input, synchronize, {
      attributes: true, attributeFilter: ['disabled', 'readonly'],
    });
    lifetime.listen(input.form || input, 'reset', () => queueMicrotask(synchronize));
    synchronize();
  }
  for (const group of root.querySelectorAll('[data-number-field]')) {
    if (mountedInputs.has(group)) continue;
    mountedInputs.add(group);
    const lifetime = controlLifetime(group);
    const input = group.querySelector('input[type="number"]');
    const buttons = Array.from(group.querySelectorAll('[data-step]'));
    function synchronize() {
      const numeric = input.valueAsNumber;
      for (const button of buttons) {
        const down = button.dataset.step === '-1';
        const bound = down ? input.min : input.max;
        button.disabled = input.disabled || input.readOnly || input.validity.badInput
          || input.step === 'any'
          || (bound !== '' && Number.isFinite(numeric)
            && (down ? numeric <= Number(bound) : numeric >= Number(bound)));
      }
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      const previous = input.value;
      if (button.dataset.step === '-1') input.stepDown();
      else input.stepUp();
      synchronize();
      if (input.value !== previous) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }));
    input.addEventListener('input', synchronize);
    input.addEventListener('change', synchronize);
    lifetime.observe(input, synchronize, {
      attributes: true, attributeFilter: ['min', 'max', 'step', 'disabled', 'readonly', 'value'],
    });
    lifetime.listen(input.form || input, 'reset', () => queueMicrotask(synchronize));
    synchronize();
  }
  for (const textarea of root.querySelectorAll('textarea.k-textarea')) {
    if (mountedInputs.has(textarea)) continue;
    mountedInputs.add(textarea);
    const lifetime = controlLifetime(textarea);
    function resize() {
      const style = getComputedStyle(textarea);
      const minimum = Number.parseFloat(style.getPropertyValue('--k-textarea-min'));
      const maximum = Number.parseFloat(style.getPropertyValue('--k-textarea-max'));
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) throw new Error('Missing textarea size tokens.');
      textarea.style.height = 'auto';
      const content = textarea.scrollHeight + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
      textarea.style.height = Math.min(maximum, Math.max(minimum, content)) + 'px';
      textarea.style.overflowY = content > maximum ? 'auto' : 'hidden';
    }
    textarea.addEventListener('input', resize);
    lifetime.listen(window, 'resize', resize);
    resize();
  }
}
