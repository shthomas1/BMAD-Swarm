// debounced-textarea.js — paper-styled textarea component with autoresize and
// debounced onChange. Pure factory, no framework.

export function debounce(fn, ms) {
  let t = null;
  let lastArgs = null;
  const wrapped = function (...args) {
    lastArgs = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...lastArgs);
    }, ms);
  };
  wrapped.flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
      fn(...lastArgs);
    }
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return wrapped;
}

// createDebouncedTextarea({ value, placeholder, onChange, debounceMs, className })
//   → { el, getValue, setValue, flush }
//
// `el` is the textarea DOM node (caller appends it). `onChange(value)` fires
// after `debounceMs` of quiet typing. Autoresizes by setting height = scrollHeight.
export function createDebouncedTextarea({
  value = '',
  placeholder = '',
  onChange = () => {},
  debounceMs = 500,
  className = '',
  rows = 3,
} = {}) {
  const el = document.createElement('textarea');
  el.className = ('writer-textarea ' + (className || '')).trim();
  el.placeholder = placeholder;
  el.rows = rows;
  el.value = value;
  // Track last value emitted to avoid no-op events.
  let lastEmitted = value;

  const debounced = debounce((v) => {
    if (v === lastEmitted) return;
    lastEmitted = v;
    try {
      onChange(v);
    } catch (e) {
      console.error('debounced-textarea onChange threw', e);
    }
  }, debounceMs);

  function autoresize() {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }

  el.addEventListener('input', () => {
    autoresize();
    debounced(el.value);
  });
  // Flush on blur so the user doesn't lose the tail of their typing.
  el.addEventListener('blur', () => debounced.flush());

  // Initial resize on next tick (after attached).
  requestAnimationFrame(autoresize);

  return {
    el,
    getValue() {
      return el.value;
    },
    setValue(v) {
      el.value = v == null ? '' : v;
      lastEmitted = el.value;
      autoresize();
    },
    flush() {
      debounced.flush();
    },
    cancel() {
      debounced.cancel();
    },
    autoresize,
  };
}
