/*
  DUNAS search: everything the header search needs on top of Dawn, kept out of Dawn's files.

  1. Placement: publishes the navbar pill's edges (--ds-top / --ds-left / --ds-right) so the
     search opens below the navbar instead of over it.
  2. Popular searches: chips (and the no-results chips) fill the field and run the live search.
  3. Result settings: adds the theme's limit and resource types to Dawn's predictive search
     request. Dawn's getSearchResults() is wrapped, not copied: fetch is swapped only for the
     synchronous duration of that call, so nothing else on the page is affected, and if Dawn
     ever changes the method the search simply falls back to Dawn's defaults.
*/
(function () {
  'use strict';

  /* ---------- 1. Placement ---------- */

  function initPlacement() {
    var header = document.querySelector('.header--dunas');
    var layer = document.querySelector('.dunas-search');
    if (!header || !layer) return;

    function place() {
      var r = header.getBoundingClientRect();
      layer.style.setProperty('--ds-top', Math.round(r.bottom) + 'px');
      layer.style.setProperty('--ds-left', Math.round(r.left) + 'px');
      layer.style.setProperty('--ds-right', Math.round(document.documentElement.clientWidth - r.right) + 'px');
    }

    place();
    window.addEventListener('resize', place, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(header);

    header.addEventListener(
      'click',
      function (event) {
        if (event.target.closest('.header__icon--search')) place();
      },
      true
    );

    // Opening locks page scroll, which removes the scrollbar and shifts the pill: measure again.
    var details = layer.closest('details');
    if (details) {
      details.addEventListener('toggle', function () {
        if (details.open) requestAnimationFrame(place);
      });
    }
  }

  /* ---------- 2. Popular search chips ---------- */

  document.addEventListener('click', function (event) {
    var chip = event.target.closest('[data-dunas-search-term]');
    if (!chip) return;
    var panel = chip.closest('.search-modal__content');
    var input = panel && panel.querySelector('input[type="search"]');
    if (!input || !panel.querySelector('predictive-search')) return; // plain link fallback
    event.preventDefault();
    input.value = chip.getAttribute('data-dunas-search-term');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });

  /* ---------- 3. Result limit + resource types ---------- */

  function initResultSettings() {
    var PredictiveSearch = window.customElements && customElements.get('predictive-search');
    if (!PredictiveSearch || typeof PredictiveSearch.prototype.getSearchResults !== 'function') return;
    if (PredictiveSearch.prototype.getSearchResults.__dunas) return;

    var original = PredictiveSearch.prototype.getSearchResults;

    function wrapped(searchTerm) {
      var params = '';
      if (this.dataset.dunasLimit) params += '&resources[limit]=' + encodeURIComponent(this.dataset.dunasLimit);
      if (this.dataset.dunasTypes) params += '&resources[type]=' + encodeURIComponent(this.dataset.dunasTypes);
      if (!params) return original.call(this, searchTerm);

      var base = window.routes && window.routes.predictive_search_url;
      var nativeFetch = window.fetch;
      window.fetch = function (input, init) {
        if (typeof input === 'string' && base && input.indexOf(base + '?') === 0) input += params;
        return nativeFetch.call(window, input, init);
      };
      try {
        return original.call(this, searchTerm);
      } finally {
        window.fetch = nativeFetch;
      }
    }

    wrapped.__dunas = true;
    PredictiveSearch.prototype.getSearchResults = wrapped;
  }

  function init() {
    initPlacement();
    initResultSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
