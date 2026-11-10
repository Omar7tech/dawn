/*
  DUNAS menu behaviour. No libraries: the open/close motion is CSS (see component-dunas-menu.css),
  this file only manages state.

  - open / close with a class, scroll lock on <html> only (locking <body> breaks the sticky header)
  - focus is trapped in the menu, Escape closes, focus returns to the menu button
  - parent rows expand their sub-items inline
  - the search action closes the menu and opens the header search
  - a page restored from the back/forward cache never shows the menu stuck open
*/
(function () {
  'use strict';

  var menu = document.getElementById('DunasMenu');
  var toggle = document.querySelector('.dunas-menu-toggle');
  if (!menu || !toggle) return;

  // Live directly in <body>, so nothing in the header (sticky positioning, glass effects,
  // stacking) can hide or misplace the menu at any scroll position.
  if (menu.parentElement !== document.body) document.body.appendChild(menu);

  var CLOSE_MS = 240;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var closeButton = menu.querySelector('.dunas-menu__close');
  var isOpen = false;
  var closeTimer = null;

  function focusables() {
    return Array.prototype.filter.call(
      menu.querySelectorAll('a[href], button:not([disabled]), summary, select, input'),
      function (element) {
        return element.offsetParent !== null;
      }
    );
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function lockScroll(locked) {
    var root = document.documentElement;
    if (locked) {
      var scrollbar = window.innerWidth - root.clientWidth;
      if (scrollbar > 0) root.style.paddingRight = scrollbar + 'px';
      root.classList.add('dunas-menu-lock');
    } else {
      root.classList.remove('dunas-menu-lock');
      root.style.paddingRight = '';
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    menu.classList.remove('is-closing');
    menu.hidden = false;
    // Next frame, so the transition runs from the hidden state
    void menu.offsetWidth;
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    document.addEventListener('keydown', onKeydown);
    if (closeButton) closeButton.focus({ preventScroll: true });
  }

  function finishClose(returnFocus) {
    if (isOpen) return;
    menu.hidden = true;
    menu.classList.remove('is-closing', 'is-leaving');
    menu.querySelectorAll('.is-chosen').forEach(function (element) {
      element.classList.remove('is-chosen');
    });
    collapseAll();
    var scroller = menu.querySelector('.dunas-menu__scroll');
    if (scroller) scroller.scrollTop = 0;
    lockScroll(false);
    if (returnFocus !== false) toggle.focus({ preventScroll: true });
  }

  function close(options) {
    if (!isOpen) return;
    isOpen = false;
    var returnFocus = !(options && options.returnFocus === false);
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    menu.classList.remove('is-open');
    menu.classList.add('is-closing');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(
      function () {
        finishClose(returnFocus);
        if (options && typeof options.then === 'function') options.then();
      },
      reduceMotion.matches ? 0 : CLOSE_MS
    );
  }

  toggle.addEventListener('click', function () {
    if (isOpen) close();
    else open();
  });
  if (closeButton) closeButton.addEventListener('click', function () { close(); });
  menu.querySelectorAll('[data-dunas-menu-close]').forEach(function (element) {
    element.addEventListener('click', function () { close(); });
  });

  /* ---------- Sub-items expand inline ---------- */

  function setExpanded(button, expanded) {
    var sub = document.getElementById(button.getAttribute('aria-controls'));
    if (!sub) return;
    button.setAttribute('aria-expanded', String(expanded));

    if (reduceMotion.matches || typeof sub.animate !== 'function') {
      sub.hidden = !expanded;
      return;
    }

    sub.getAnimations().forEach(function (animation) { animation.cancel(); });
    if (expanded) {
      sub.hidden = false;
      var height = sub.scrollHeight;
      sub.animate([{ height: '0px', opacity: 0 }, { height: height + 'px', opacity: 1 }], {
        duration: 280,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    } else {
      var from = sub.offsetHeight;
      var animation = sub.animate([{ height: from + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], {
        duration: 200,
        easing: 'ease',
      });
      animation.onfinish = function () {
        if (button.getAttribute('aria-expanded') !== 'true') sub.hidden = true;
      };
    }
  }

  function collapseAll() {
    menu.querySelectorAll('.dunas-menu__row--parent[aria-expanded="true"]').forEach(function (button) {
      button.setAttribute('aria-expanded', 'false');
      var sub = document.getElementById(button.getAttribute('aria-controls'));
      if (sub) sub.hidden = true;
    });
  }

  menu.addEventListener('click', function (event) {
    var button = event.target.closest('.dunas-menu__row--parent');
    if (!button || !menu.contains(button)) return;
    setExpanded(button, button.getAttribute('aria-expanded') !== 'true');
  });

  /* ---------- Links ---------- */

  menu.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link || !menu.contains(link)) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== '_self') return;

    // Search: close the menu, then open the header search (falls back to the search page)
    if (link.hasAttribute('data-dunas-menu-search')) {
      var searchSummary = document.querySelector('.dunas-header .header__search summary');
      if (searchSummary) {
        event.preventDefault();
        close({
          returnFocus: false,
          then: function () {
            searchSummary.click();
          },
        });
      }
      return;
    }

    var url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    // Same page: just close
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      event.preventDefault();
      close();
      return;
    }

    // Another page: instant feedback while it loads
    link.classList.add('is-chosen');
    menu.classList.add('is-leaving');
  });

  /* ---------- Back/forward cache ---------- */

  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    clearTimeout(closeTimer);
    isOpen = false;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    finishClose(false);
  });
})();
