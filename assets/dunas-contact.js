/*
  DUNAS contact: the open now pill (only when the real hours and time zone are set), the
  copy-email button, the message counter, and the form check on send: an error under its own
  field, the focus on the first field that failed, then the sending state of the button.
  Each part does nothing when its markup is absent.
*/
(() => {
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const initStatus = (root) => {
    const pill = root.querySelector('[data-ct-status]');
    if (!pill || !pill.dataset.tz) return;

    const { tz, days, openText, closedText, city } = pill.dataset;
    const open = Number(pill.dataset.open);
    const close = Number(pill.dataset.close);
    const text = pill.querySelector('[data-ct-status-text]');
    const clock = pill.querySelector('[data-ct-clock]');

    let parts;
    let display;
    try {
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      });
      display = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch (error) {
      return; // unknown time zone: the pill stays hidden
    }

    const tick = () => {
      const now = new Date();
      const p = {};
      parts.formatToParts(now).forEach((part) => (p[part.type] = part.value));
      const hour = (Number(p.hour) % 24) + Number(p.minute) / 60;
      const weekend = p.weekday === 'Sat' || p.weekday === 'Sun';
      const dayOpen = days === 'all' || (days === 'mon_sat' ? p.weekday !== 'Sun' : !weekend);
      const isOpen = dayOpen && hour >= open && hour < close;

      pill.dataset.state = isOpen ? 'open' : 'closed';
      if (text) text.textContent = isOpen ? openText : closedText;
      if (clock) clock.textContent = `${city ? `${city} ` : ''}${display.format(now)}`;
    };

    tick();
    pill.hidden = false;
    clearInterval(pill._ctTimer);
    pill._ctTimer = setInterval(tick, 30000);
  };

  const initCopy = (root) => {
    root.querySelectorAll('[data-ct-copy]').forEach((button) => {
      const label = button.querySelector('span');
      const original = label.textContent;
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.ctCopy);
        } catch (error) {
          window.location.href = `mailto:${button.dataset.ctCopy}`;
          return;
        }
        button.classList.add('is-copied');
        label.textContent = button.dataset.copied || original;
        clearTimeout(button._ctTimer);
        button._ctTimer = setTimeout(() => {
          button.classList.remove('is-copied');
          label.textContent = original;
        }, 1800);
      });
    });
  };

  const initCounter = (root) => {
    const area = root.querySelector('[data-ct-count-for]');
    const count = root.querySelector('[data-ct-count]');
    if (!area || !count) return;
    const max = Number(area.getAttribute('maxlength')) || 0;
    const update = () => {
      count.textContent = area.value.length;
      count.parentElement.classList.toggle('is-near', Boolean(max) && area.value.length > max * 0.9);
    };
    area.addEventListener('input', update);
    update();
  };

  const initForm = (root) => {
    const form = root.querySelector('form');
    const button = form && form.querySelector('[type="submit"]');
    const email = form && form.querySelector('input[type="email"]');
    if (!button || !email) return;
    const error = form.querySelector('[data-ct-error]');
    const message = root.dataset.emailError || email.validationMessage;

    const setError = (text) => {
      if (text) email.setAttribute('aria-invalid', 'true');
      else email.removeAttribute('aria-invalid');
      if (error) error.textContent = text;
    };

    // checked on send, then again as the visitor corrects the field
    email.addEventListener('input', () => {
      if (email.getAttribute('aria-invalid') === 'true' && EMAIL.test(email.value.trim())) setError('');
    });

    form.addEventListener('submit', (event) => {
      if (!EMAIL.test(email.value.trim())) {
        event.preventDefault();
        setError(message);
        email.focus();
        return;
      }
      setError('');
      button.classList.add('is-sending');
      button.setAttribute('aria-busy', 'true');
      const label = button.querySelector('[data-ct-label]');
      if (label && button.dataset.sending) label.textContent = `${button.dataset.sending}…`;
    });
  };

  const init = (root) => {
    initStatus(root);
    initCopy(root);
    initCounter(root);
    initForm(root);
  };

  document.querySelectorAll('[data-dunas-contact]').forEach(init);
  document.addEventListener('shopify:section:load', (event) => {
    const root = event.target.querySelector('[data-dunas-contact]');
    if (root) init(root);
  });
})();
