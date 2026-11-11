/*
  DUNAS products page: marks the sticky filter bar as "stuck" while it rests under the navbar,
  so it gains its glass only then and stays flat in its normal place.
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
