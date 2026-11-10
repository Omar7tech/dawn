/*
  DUNAS search: everything the header search needs on top of Dawn, kept out of Dawn's files.

  1. Placement: publishes the navbar pill's edges (--ds-top / --ds-left / --ds-right) so the
     search opens below the navbar instead of over it.
  2. Popular searches: chips (and the no-results chips) fill the field and run the live search.
  3. Result settings: adds the theme's limit and resource types to Dawn's predictive search
     request. Dawn's getSearchResults() is wrapped, not copied: fetch is swapped only for the
     synchronous duration of that call, so nothing else on the page is affected, and if Dawn
     ever changes the method the search simply falls back to Dawn's defaults.
  4. Polish: bolds the typed text inside each result, swaps Dawn's spinner for skeleton rows,
     and opens search with "/" or Cmd/Ctrl+K from anywhere on the page.
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

  /* ---------- 4a. Bold the typed text inside results ---------- */

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatches(root, term) {
    var words = (term || '').trim().split(/\s+/).filter(function (w) { return w.length > 0; });
    if (!root || !words.length) return;
    var pattern = new RegExp('(' + words.map(escapeRegExp).join('|') + ')', 'gi');

    root.querySelectorAll('.predictive-search__item-heading').forEach(function (heading) {
      if (heading.closest('#predictive-search-results-queries-list')) return; // Dawn marks these itself
      if (heading.querySelector('.dunas-search__match')) return;
      var text = heading.textContent;
      if (!pattern.test(text)) return;
      pattern.lastIndex = 0;
      var fragment = document.createDocumentFragment();
      var last = 0;
      text.replace(pattern, function (match, _group, index) {
        if (index > last) fragment.appendChild(document.createTextNode(text.slice(last, index)));
        var mark = document.createElement('mark');
        mark.className = 'dunas-search__match';
        mark.textContent = match;
        fragment.appendChild(mark);
        last = index + match.length;
        return match;
      });
      if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
      heading.textContent = '';
      heading.appendChild(fragment);
    });
  }

  /* ---------- 4b. Skeleton rows instead of the spinner ---------- */

  var SKELETON_ROWS = 4;

  function addSkeletons(root) {
    (root || document).querySelectorAll('.dunas-search .predictive-search__loading-state').forEach(function (state) {
      if (state.querySelector('.dunas-search__skeleton')) return;
      var wrap = document.createElement('div');
      wrap.className = 'dunas-search__skeleton';
      wrap.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < SKELETON_ROWS; i++) {
        var row = document.createElement('div');
        row.className = 'dunas-search__skeleton-row';
        row.innerHTML =
          '<span class="dunas-search__skeleton-thumb"></span>' +
          '<span class="dunas-search__skeleton-lines"><span></span><span></span></span>';
        wrap.appendChild(row);
      }
      state.appendChild(wrap);
    });
  }

  function initRenderHooks() {
    var PredictiveSearch = window.customElements && customElements.get('predictive-search');
    if (!PredictiveSearch || typeof PredictiveSearch.prototype.renderSearchResults !== 'function') return;
    if (PredictiveSearch.prototype.renderSearchResults.__dunas) return;
    var original = PredictiveSearch.prototype.renderSearchResults;
    function wrapped(markup) {
      var result = original.call(this, markup);
      try {
        highlightMatches(this.predictiveSearchResults, this.searchTerm);
        addSkeletons(this);
      } catch (error) {
        /* cosmetic only: never break search */
      }
      return result;
    }
    wrapped.__dunas = true;
    PredictiveSearch.prototype.renderSearchResults = wrapped;
  }

  /* ---------- 4c. "/" and Cmd/Ctrl+K open search ---------- */

  function isTypingTarget(element) {
    if (!element) return false;
    var tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
  }

  document.addEventListener('keydown', function (event) {
    var isSlash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
    var isCmdK = (event.metaKey || event.ctrlKey) && !event.altKey && (event.key === 'k' || event.key === 'K');
    if (!isSlash && !isCmdK) return;
    if (isSlash && isTypingTarget(document.activeElement)) return;
    var details = document.querySelector('.dunas-header .header__search details');
    var summary = details && details.querySelector('summary');
    if (!summary) return;
    event.preventDefault();
    if (!details.open) summary.click();
    else {
      var input = details.querySelector('input[type="search"]');
      if (input) input.focus();
    }
  });

  function init() {
    initPlacement();
    initResultSettings();
    initRenderHooks();
    addSkeletons(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
