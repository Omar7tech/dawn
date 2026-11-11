/*
  DUNAS nav lens: a drop of liquid glass that lives behind the desktop menu links.

  It rests on the current page's link. On hover or keyboard focus it glides to the link under
  the pointer on a spring, stretching with its speed and settling with a small wobble, and the
  word under it shows a faint colour fringe while the glass is moving, as real glass disperses
  light. Pressing a link lifts the glass like a lens. A highlight follows the pointer across it.
  When the pointer leaves the menu it glides back to the current page (or fades away when the
  page is not in the menu).

  Settings live on the header element: data-nav-lens (glass | green | off) and
  data-nav-motion (liquid | calm). Reduced motion: it moves without the spring or the stretch.
*/
(() => {
  const header = document.querySelector('.header--dunas[data-nav-lens]');
  if (!header || header.dataset.navLens === 'off') return;

  const list = header.querySelector('.header__inline-menu > .list-menu--inline');
  if (!list || list.querySelector('.dunas-lens')) return;

  const liquid = header.dataset.navMotion !== 'calm';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 990px)');

  const items = Array.from(
    list.querySelectorAll(':scope > li > .header__menu-item, :scope > li > header-menu > details > .header__menu-item')
  );
  if (!items.length) return;

  const lens = document.createElement('li');
  lens.className = 'dunas-lens';
  lens.setAttribute('aria-hidden', 'true');
  lens.setAttribute('role', 'presentation');
  lens.innerHTML = '<span class="dunas-lens__body"><span class="dunas-lens__shine"></span></span>';
  list.prepend(lens);
  list.classList.add('has-lens', `has-lens--${header.dataset.navLens}`);
  if (header.hasAttribute('data-nav-no-fringe')) list.classList.add('has-lens--no-fringe');

  const isCurrent = (item) =>
    item.getAttribute('aria-current') === 'page' || Boolean(item.querySelector('.header__active-menu-item'));
  const current = () => items.find(isCurrent) || null;

  // spring state: position and width, each with its own velocity
  const s = { x: 0, w: 0, y: 0, h: 0, vx: 0, vw: 0 };
  const t = { x: 0, w: 0, y: 0, h: 0 };
  const K = { slow: 150, normal: 260, fast: 420 }[header.dataset.navSpeed] || 260; // stiffness
  const C = (liquid ? 1.3 : 2) * Math.sqrt(K); // damping: liquid wobbles once, calm settles straight
  const maxStretch = Math.max(0, Math.min(Number(header.dataset.navStretch ?? 30), 60)) / 100;
  const canLift = header.dataset.navLift !== 'false';
  let target = null;
  let frame = 0;
  let last = 0;
  let placed = false;

  const measure = (item) => {
    const a = item.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  };

  const render = () => {
    let sx = 1;
    let sy = 1;
    if (liquid && !still.matches) {
      const stretch = Math.min((Math.abs(s.vx) / 2600) * (maxStretch / 0.3), maxStretch);
      sx = 1 + stretch;
      sy = 1 - stretch * 0.42;
    }
    lens.style.width = `${s.w}px`;
    lens.style.height = `${s.h}px`;
    lens.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) scale(${sx}, ${sy})`;
    list.classList.toggle('is-moving', Math.abs(s.vx) > 90);
  };

  const step = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const ax = K * (t.x - s.x) - C * s.vx;
    const aw = K * (t.w - s.w) - C * s.vw;
    s.vx += ax * dt;
    s.vw += aw * dt;
    s.x += s.vx * dt;
    s.w += s.vw * dt;
    s.y = t.y;
    s.h = t.h;
    render();

    const settled =
      Math.abs(t.x - s.x) < 0.2 && Math.abs(t.w - s.w) < 0.2 && Math.abs(s.vx) < 4 && Math.abs(s.vw) < 4;
    if (settled) {
      Object.assign(s, { x: t.x, w: t.w, vx: 0, vw: 0 });
      render();
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(step);
  };

  const go = (item, jump = false) => {
    items.forEach((el) => el.classList.toggle('is-lensed', el === item));
    target = item;
    if (!item) {
      lens.classList.remove('is-on');
      return;
    }
    Object.assign(t, measure(item));
    lens.classList.add('is-on');

    if (jump || !placed || still.matches) {
      Object.assign(s, { x: t.x, w: t.w, y: t.y, h: t.h, vx: 0, vw: 0 });
      placed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      render();
      return;
    }
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(step);
    }
  };

  // where the glass belongs when nothing is pointed at: an open dropdown, else the current page
  const home = () => {
    const open = items.find((el) => el.parentElement.matches('details[open]'));
    return open || current();
  };

  items.forEach((item) => {
    item.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') go(item);
    });
    item.addEventListener('focus', () => {
      if (item.matches(':focus-visible')) go(item);
    });
    item.addEventListener('pointerdown', () => {
      go(item);
      if (canLift) lens.classList.add('is-lifted');
    });
  });

  const drop = () => lens.classList.remove('is-lifted');
  window.addEventListener('pointerup', drop);
  window.addEventListener('pointercancel', drop);

  list.addEventListener('pointerleave', () => {
    drop();
    go(home());
  });
  list.addEventListener('focusout', (event) => {
    if (!list.contains(event.relatedTarget)) go(home());
  });

  // the highlight follows the pointer across the glass
  list.addEventListener('pointermove', (event) => {
    if (!target) return;
    const b = list.getBoundingClientRect();
    const px = ((event.clientX - b.left - s.x) / Math.max(s.w, 1)) * 100;
    lens.style.setProperty('--mx', `${Math.max(-20, Math.min(120, px)).toFixed(1)}%`);
  });

  // a dropdown that closes while the pointer is elsewhere sends the glass home
  list.querySelectorAll('details').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!list.matches(':hover')) go(home());
    });
  });

  const replace = () => {
    if (!desktop.matches) return;
    if (target) go(target, true);
    else go(home(), true);
  };

  new ResizeObserver(replace).observe(list);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
  go(home(), true);
})();
