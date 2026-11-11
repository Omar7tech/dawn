/*
  DUNAS language switcher (snippets/dunas-language-switcher.liquid).
  The options are submit buttons of Shopify's localization form, so the switch itself needs
  no script. This adds: open/close, closing on outside click or Escape, focus on the current
  language when opened, arrow-key movement, and returning focus to the toggle.
*/
(function () {
  'use strict';
  if (customElements.get('dunas-locale')) return;

  class DunasLocale extends HTMLElement {
    connectedCallback() {
      this.toggle = this.querySelector('.dunas-locale__toggle');
      this.panel = this.querySelector('.dunas-locale__panel');
      if (!this.toggle || !this.panel) return;

      this.onDocumentClick = this.onDocumentClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);

      this.toggle.addEventListener('click', () => (this.isOpen() ? this.close() : this.open()));
      this.addEventListener('keydown', this.onKeydown);
      // Submitting shows a calm "loading" state on the chosen option while the page reloads
      this.panel.addEventListener('click', (event) => {
        const option = event.target.closest('.dunas-locale__option');
        if (option) this.classList.add('is-switching');
      });
    }

    isOpen() {
      return this.toggle.getAttribute('aria-expanded') === 'true';
    }

    options() {
      return Array.from(this.panel.querySelectorAll('.dunas-locale__option'));
    }

    open() {
      this.panel.hidden = false;
      this.toggle.setAttribute('aria-expanded', 'true');
      this.classList.add('is-open');
      document.addEventListener('click', this.onDocumentClick);
      const current = this.panel.querySelector('[aria-current="true"]') || this.options()[0];
      if (current) current.focus({ preventScroll: true });
    }

    close(returnFocus) {
      if (!this.isOpen()) return;
      this.panel.hidden = true;
      this.toggle.setAttribute('aria-expanded', 'false');
      this.classList.remove('is-open');
      document.removeEventListener('click', this.onDocumentClick);
      if (returnFocus) this.toggle.focus({ preventScroll: true });
    }

    onDocumentClick(event) {
      if (!this.contains(event.target)) this.close(false);
    }

    onKeydown(event) {
      if (event.key === 'Escape' && this.isOpen()) {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        return;
      }
      if (!this.isOpen() || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
      event.preventDefault();
      const list = this.options();
      const index = list.indexOf(document.activeElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = list[(index + step + list.length) % list.length];
      if (next) next.focus();
    }
  }

  customElements.define('dunas-locale', DunasLocale);
})();
