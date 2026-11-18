/*
  DUNAS reviews deck.

  The cards are stacked; data-pos says where each sits (0 front, 1 and 2 behind, 3 waiting,
  'hidden' beyond). Next: the front card leaves to the side with a tilt while the others step
  forward, then it slips in at the back. Previous: the last card flies back in from the left.
  Drag or swipe the front card past a short distance to send it away; a shorter drag springs
  back. Arrows, Left/Right keys on the focused deck, a counter, and a screen-reader status.
  Optional auto-advance pauses on hover, focus, touch and off screen, never for reduced motion.
*/
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const LEAVE_MS = 600;

  const init = (root) => {
    if (root.dataset.rvReady) return;
    root.dataset.rvReady = 'true';

    const deck = root.querySelector('[data-rv-deck]');
    const cards = Array.from(root.querySelectorAll('[data-rv-card]'));
    if (!deck || cards.length < 2) return;

    const prevButton = root.querySelector('[data-rv-prev]');
    const nextButton = root.querySelector('[data-rv-next]');
    const current = root.querySelector('[data-rv-current]');
    const status = root.querySelector('[data-rv-status]');
    let order = cards.slice();
    let busy = false;

    const pad = (n) => String(n).padStart(2, '0');

    const place = (card, index) => {
      card.dataset.pos = index < 4 ? String(index) : 'hidden';
      const front = index === 0;
      card.toggleAttribute('inert', !front);
      if (front) card.removeAttribute('aria-hidden');
      else card.setAttribute('aria-hidden', 'true');
    };

    const render = (announce) => {
      order.forEach((card, index) => place(card, index));
      const number = cards.indexOf(order[0]) + 1;
      if (current) current.textContent = pad(number);
      if (announce && status) status.textContent = `${number} / ${cards.length}`;
    };

    // put a card somewhere without animating the move, then give the transitions back
    const jump = (card, fn) => {
      card.style.transition = 'none';
      fn();
      void card.offsetWidth;
      card.style.transition = '';
    };

    const next = (side = 'left') => {
      if (busy) return;
      busy = true;
      const front = order[0];
      front.style.transform = '';
      front.classList.remove('is-dragging');
      front.classList.add(`is-leaving-${side}`);
      order = order.slice(1).concat(front);
      // everyone else steps forward while the front card leaves
      order.slice(0, -1).forEach((card, index) => place(card, index));
      setTimeout(() => {
        jump(front, () => {
          front.classList.remove('is-leaving-left', 'is-leaving-right');
          place(front, order.length - 1);
        });
        render(true);
        busy = false;
      }, still.matches ? 0 : LEAVE_MS);
    };

    const prev = () => {
      if (busy) return;
      busy = true;
      const last = order[order.length - 1];
      // bring it in from the left
      jump(last, () => {
        last.classList.add('is-leaving-left');
        last.dataset.pos = '0';
      });
      order = [last].concat(order.slice(0, -1));
      requestAnimationFrame(() => {
        last.classList.remove('is-leaving-left');
        render(true);
        setTimeout(() => (busy = false), still.matches ? 0 : 450);
      });
    };

    if (nextButton) nextButton.addEventListener('click', () => next('left'));
    if (prevButton) prevButton.addEventListener('click', prev);

    deck.addEventListener('keydown', (event) => {
      const rtl = document.documentElement.dir === 'rtl';
      if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next(rtl ? 'right' : 'left');
      else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) prev();
      else return;
      event.preventDefault();
    });

    // drag or swipe the front card
    let start = null;
    let moved = false;

    deck.addEventListener('pointerdown', (event) => {
      const front = order[0];
      if (busy || !front.contains(event.target) || (event.pointerType === 'mouse' && event.button !== 0)) return;
      start = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId };
      moved = false;
    });

    deck.addEventListener('pointermove', (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!moved) {
        // a vertical gesture is a page scroll, not a swipe
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          start = null;
          return;
        }
        if (Math.abs(dx) < 6) return;
        moved = true;
        order[0].classList.add('is-dragging');
        deck.setPointerCapture(event.pointerId);
      }
      order[0].style.transform = `translate(${dx}px, ${Math.abs(dx) * 0.06}px) rotate(${dx * 0.03}deg)`;
    });

    const release = (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const speed = Math.abs(dx) / Math.max(performance.now() - start.t, 1);
      start = null;
      if (!moved) return;
      const front = order[0];
      if (Math.abs(dx) > Math.min(120, deck.clientWidth * 0.22) || speed > 0.6) {
        next(dx < 0 ? 'left' : 'right');
      } else {
        front.classList.remove('is-dragging');
        front.style.transform = '';
      }
    };
    deck.addEventListener('pointerup', release);
    deck.addEventListener('pointercancel', release);

    // a drag is not a click on the product link
    deck.addEventListener(
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

    render(false);

    // optional auto-advance
    const seconds = Number(root.dataset.autoplay) || 0;
    if (seconds && !still.matches) {
      let timer = 0;
      let paused = false;
      let onScreen = false;
      const tick = () => {
        clearTimeout(timer);
        if (paused || !onScreen) return;
        timer = setTimeout(() => {
          next('left');
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
      deck.addEventListener('touchstart', pause, { passive: true });
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
