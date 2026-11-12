/*
  DUNAS reviews track: native horizontal scrolling with snap (so swipe, trackpad and the
  keyboard all work on their own), plus the round arrows (one card per press), dragging with the
  mouse, and the hairline that shows where you are. Arrows and the hairline only appear when
  the cards overflow. Optional auto-advance pauses while pointed at, focused or off screen, and
  never runs for reduced motion.
*/
(() => {
  const init = (root) => {
    if (root.dataset.rvReady) return;
    root.dataset.rvReady = 'true';

    const track = root.querySelector('[data-rv-track]');
    if (!track) return;
    const controls = root.querySelector('[data-rv-controls]');
    const prev = root.querySelector('[data-rv-prev]');
    const next = root.querySelector('[data-rv-next]');
    const progress = root.querySelector('[data-rv-progress]');
    const rtl = () => getComputedStyle(track).direction === 'rtl';

    const step = () => {
      const item = track.querySelector('.dunas-rv__item');
      if (!item) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    };

    const max = () => track.scrollWidth - track.clientWidth;
    const position = () => Math.abs(track.scrollLeft); // negative in right-to-left

    const update = () => {
      const overflow = max() > 2;
      if (controls) controls.hidden = !overflow;
      if (progress) progress.hidden = !overflow;
      if (!overflow) return;
      const at = position();
      if (prev) prev.disabled = at <= 2;
      if (next) next.disabled = at >= max() - 2;
      root.style.setProperty('--rv-visible', (track.clientWidth / track.scrollWidth).toFixed(4));
      root.style.setProperty('--rv-progress', (at / max()).toFixed(4));
    };

    const go = (direction) => {
      track.scrollBy({ left: direction * step() * (rtl() ? -1 : 1), behavior: 'smooth' });
    };

    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    new ResizeObserver(update).observe(track);
    update();

    // drag with the mouse (touch and trackpads already scroll natively)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      track.classList.add('is-draggable');
      let startX = 0;
      let startScroll = 0;
      let moved = false;
      let pointer = null;

      track.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || max() <= 2) return;
        pointer = event.pointerId;
        startX = event.clientX;
        startScroll = track.scrollLeft;
        moved = false;
      });

      track.addEventListener('pointermove', (event) => {
        if (pointer !== event.pointerId) return;
        const dx = event.clientX - startX;
        if (!moved && Math.abs(dx) < 6) return;
        if (!moved) {
          moved = true;
          track.classList.add('is-dragging');
          track.setPointerCapture(pointer);
        }
        track.scrollLeft = startScroll - dx;
      });

      const end = () => {
        if (pointer === null) return;
        pointer = null;
        if (!moved) return;
        // let snapping settle the nearest card
        const before = track.scrollLeft;
        track.classList.remove('is-dragging');
        const snap = Math.round(before / step()) * step();
        track.scrollTo({ left: snap, behavior: 'smooth' });
      };
      track.addEventListener('pointerup', end);
      track.addEventListener('pointercancel', end);

      // a drag is not a click on the product link inside a card
      track.addEventListener(
        'click',
        (event) => {
          if (moved) {
            event.preventDefault();
            event.stopPropagation();
            moved = false;
          }
        },
        true
      );
    }

    // optional auto-advance, one card at a time, back to the start at the end
    const seconds = Number(root.dataset.autoplay) || 0;
    if (seconds && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let timer = 0;
      let paused = false;
      let onScreen = false;
      const tick = () => {
        clearTimeout(timer);
        if (paused || !onScreen || max() <= 2) return;
        timer = setTimeout(() => {
          if (position() >= max() - 2) track.scrollTo({ left: 0, behavior: 'smooth' });
          else go(1);
          tick();
        }, seconds * 1000);
      };
      const pause = () => {
        paused = true;
        clearTimeout(timer);
      };
      const resume = () => {
        paused = false;
        tick();
      };
      root.addEventListener('pointerenter', pause);
      root.addEventListener('pointerleave', resume);
      root.addEventListener('focusin', pause);
      root.addEventListener('focusout', (event) => {
        if (!root.contains(event.relatedTarget)) resume();
      });
      track.addEventListener('touchstart', pause, { passive: true });
      new IntersectionObserver(
        (entries) => {
          onScreen = entries[0].isIntersecting;
          tick();
        },
        { threshold: 0.4 }
      ).observe(root);
    }
  };

  document.querySelectorAll('[data-dunas-reviews]').forEach(init);
  document.addEventListener('shopify:section:load', (event) => {
    const root = event.target.querySelector('[data-dunas-reviews]');
    if (root) init(root);
  });
})();
