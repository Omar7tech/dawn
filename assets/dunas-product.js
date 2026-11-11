/*
  DUNAS sticky add-to-cart bar (phones), from sections/main-product.liquid.
  - Shows once the real "Add to cart" button has scrolled out of view, hides near the footer.
  - Mirrors the real button: its label ("Add to cart" / "Sold out") and disabled state, and the
    current price, so variant changes are reflected (Dawn re-renders those elements).
  - Pressing it presses the real button, so Dawn's cart pop-up / drawer works as usual.
*/
(function () {
  'use strict';

  function init() {
    var bar = document.querySelector('.dunas-sticky-atc');
    if (!bar) return;
    var sectionId = bar.getAttribute('data-section');
    var root = document.getElementById('MainProduct-' + sectionId) || document;
    var button = bar.querySelector('.dunas-sticky-atc__button');
    var priceEl = bar.querySelector('[data-dunas-sticky-price]');
    var phone = window.matchMedia('(max-width: 749px)');
    var footer = document.querySelector('.footer');
    var footerInView = false;
    var ticking = false;

    function realButton() {
      return root.querySelector('.product-form__submit');
    }

    function realPrice() {
      var price = root.querySelector('#price-' + sectionId);
      if (!price) return '';
      var current =
        price.querySelector('.price__sale .price-item--sale') && price.querySelector('.price--on-sale')
          ? price.querySelector('.price__sale .price-item--sale')
          : price.querySelector('.price__regular .price-item--regular');
      return current ? current.textContent.trim() : '';
    }

    function mirror() {
      var real = realButton();
      if (real) {
        var label = real.querySelector('span') ? real.querySelector('span').textContent.trim() : real.textContent.trim();
        if (label && button.textContent.trim() !== label) button.textContent = label;
        var disabled = real.hasAttribute('disabled') || real.getAttribute('aria-disabled') === 'true';
        button.disabled = disabled;
      }
      var price = realPrice();
      if (price && priceEl.textContent.trim() !== price) priceEl.textContent = price;
    }

    function update() {
      ticking = false;
      var real = realButton();
      var visible = false;
      if (phone.matches && real && !footerInView) {
        visible = real.getBoundingClientRect().bottom < 0;
      }
      if (visible !== bar.classList.contains('is-visible')) {
        bar.classList.toggle('is-visible', visible);
        bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
        button.tabIndex = visible ? 0 : -1;
      }
      mirror();
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    button.addEventListener('click', function () {
      var real = realButton();
      if (!real || real.disabled) return;
      real.click();
    });

    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        footerInView = entries[0].isIntersecting;
        requestUpdate();
      }).observe(footer);
    }

    // variant changes re-render the price and the button: keep the bar in step
    if ('MutationObserver' in window) {
      new MutationObserver(requestUpdate).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
