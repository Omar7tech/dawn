/*
  DUNAS products page.
  1. Marks the sticky filter bar as "stuck" while it rests under the navbar, so it gains its
     glass only then and stays flat in its normal place.
  2. On phones, shows the floating filter badge (see initFab below).
  A 1px sentinel sits just above the bar. On scroll (at most once per frame) the sentinel's
  position is compared with the bar's sticky offset: above it means the bar is stuck.
*/
(function () {
  'use strict';

  function init() {
    var grid = document.querySelector('.dunas-collection-grid--toolbar-sticky');
    var bar = grid && grid.querySelector('#main-collection-filters');
    if (!bar) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    // display:block is explicit: Dawn hides every empty div (div:empty { display: none })
    sentinel.style.cssText = 'display:block;height:1px;margin-bottom:-1px;pointer-events:none;';
    bar.parentNode.insertBefore(sentinel, bar);

    var ticking = false;

    // The bar's own sticky "top" (it follows the "Distance below navbar" setting and the
    // header's height), so the stuck state always matches where the bar actually floats.
    function stickyTop() {
      if (getComputedStyle(bar).position !== 'sticky') return -Infinity;
      return parseFloat(getComputedStyle(bar).top) || 0;
    }

    function update() {
      ticking = false;
      var stuck = sentinel.getBoundingClientRect().top < stickyTop() - 1;
      if (stuck !== bar.classList.contains('is-stuck')) bar.classList.toggle('is-stuck', stuck);
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();

    initFab(grid, bar);
  }

  /*
    Phone filter badge (.dunas-filter-fab): floats at the bottom of the screen while the filter
    bar is scrolled away above the navbar, hides near the footer and while the sheet is open,
    shows how many filters are active, and opens the same "Filter and sort" sheet.
  */
  function initFab(grid, bar) {
    var fab = grid.querySelector('.dunas-filter-fab');
    if (!fab) return;
    var phone = window.matchMedia('(max-width: 749px)');
    var countEl = fab.querySelector('.dunas-filter-fab__count');
    var footer = document.querySelector('.footer');
    var footerInView = false;
    var ticking = false;

    function sheetSummary() {
      return bar.querySelector('.mobile-facets__disclosure > summary');
    }

    function sheetOpen() {
      var details = bar.querySelector('.mobile-facets__disclosure');
      return !!(details && details.open);
    }

    function activeCount() {
      return bar.querySelectorAll('.active-facets-mobile .active-facets__button').length;
    }

    function headerBottom() {
      var header = document.querySelector('.header--dunas');
      return header ? header.getBoundingClientRect().bottom : 0;
    }

    function update() {
      ticking = false;
      var visible =
        phone.matches &&
        !sheetOpen() &&
        !footerInView &&
        bar.getBoundingClientRect().bottom < headerBottom();

      if (visible !== fab.classList.contains('is-visible')) {
        fab.classList.toggle('is-visible', visible);
        fab.setAttribute('aria-hidden', visible ? 'false' : 'true');
        fab.tabIndex = visible ? 0 : -1;
      }

      var count = activeCount();
      countEl.hidden = count === 0;
      if (count > 0 && countEl.textContent !== String(count)) countEl.textContent = count;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    // Dawn moves focus to the "Filter and sort" button in the bar when the sheet opens and
    // closes, which scrolls the page back up to it. Opened from the badge, the page must stay
    // exactly where the customer was: the position is saved and restored on open and on close.
    var savedY = null;

    function holdScroll() {
      if (savedY === null) return;
      var y = savedY;
      window.scrollTo(0, y);
      requestAnimationFrame(function () {
        window.scrollTo(0, y);
      });
    }

    fab.addEventListener('click', function () {
      var summary = sheetSummary();
      if (!summary) return;
      savedY = window.scrollY;
      fab.classList.remove('is-visible');
      summary.click();
      holdScroll();
      setTimeout(holdScroll, 50);
    });

    // Closing starts when Dawn removes "menu-opening" (and moves focus at that same moment),
    // so the position is put back right then, again after the 400ms close animation, then cleared.
    var disclosure = bar.querySelector('.mobile-facets__disclosure');
    if (disclosure && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (savedY === null || disclosure.classList.contains('menu-opening')) return;
        holdScroll();
        setTimeout(holdScroll, 0);
        setTimeout(function () {
          holdScroll();
          savedY = null;
        }, 450);
      }).observe(disclosure, { attributes: true, attributeFilter: ['class'] });
    }

    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        footerInView = entries[0].isIntersecting;
        requestUpdate();
      }).observe(footer);
    }

    // the sheet opening/closing and filters re-rendering both change what the badge shows
    bar.addEventListener('toggle', requestUpdate, true);
    if ('MutationObserver' in window) {
      new MutationObserver(requestUpdate).observe(bar, { childList: true, subtree: true });
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
