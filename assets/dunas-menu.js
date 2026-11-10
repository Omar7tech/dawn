/*
  DUNAS branded menu.

  Open:  a cream panel grows in a circle from the menu button, the top bar fades in,
         headline links rise out of their masks with their numbers, divider rules draw in,
         the giant wordmark drifts up, and the footer settles last.
  Close: the same timeline plays in reverse, faster.

  GSAP is loaded in the background once the page has finished loading (and again on the
  first touch of the button), so opening is instant and never delays the page. If GSAP is
  not available yet, or the visitor prefers reduced motion, the menu simply fades in.
*/
(function () {
  var menu = document.getElementById('DunasMenu');
  var toggle = document.querySelector('.dunas-menu-toggle');
  if (!menu || !toggle) return;

  var GSAP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var closeButton = menu.querySelector('.dunas-menu__close');
  var timeline = null;
  var isOpen = false;
  var gsapPromise = null;

  function loadGsap() {
    if (window.gsap) return Promise.resolve(window.gsap);
    if (gsapPromise) return gsapPromise;
    gsapPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = GSAP_SRC;
      script.async = true;
      script.onload = function () {
        resolve(window.gsap);
      };
      script.onerror = function () {
        gsapPromise = null;
        reject();
      };
      document.head.appendChild(script);
    });
    return gsapPromise;
  }

  // Warm GSAP up without competing with the page
  function warm() {
    loadGsap().catch(function () {});
  }
  window.addEventListener('load', function () {
    (window.requestIdleCallback || function (cb) { return setTimeout(cb, 1200); })(warm);
  });
  toggle.addEventListener('pointerenter', warm, { once: true });
  toggle.addEventListener('touchstart', warm, { once: true, passive: true });

  // Circle origin = centre of the toggle; radius = distance to the farthest corner
  function setOrigin() {
    var box = toggle.getBoundingClientRect();
    var x = box.left + box.width / 2;
    var y = box.top + box.height / 2;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var radius = Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)));
    menu.style.setProperty('--menu-x', x + 'px');
    menu.style.setProperty('--menu-y', y + 'px');
    menu.dataset.radius = radius;
  }

  function buildTimeline(gsap) {
    var panel = menu.querySelector('.dunas-menu__panel');
    var top = menu.querySelectorAll('.dunas-menu__top > *');
    var labels = menu.querySelectorAll('.dunas-menu__label');
    var numbers = menu.querySelectorAll('.dunas-menu__num');
    var expands = menu.querySelectorAll('.dunas-menu__expand');
    var rules = menu.querySelectorAll('.dunas-menu__rule');
    var mark = menu.querySelector('.dunas-menu__mark');
    var foot = menu.querySelectorAll('.dunas-menu__foot > *');

    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: 'expo.out', duration: 0.9 },
      onReverseComplete: afterClose,
    });

    tl.addLabel('reveal', 0)
      .fromTo(
        panel,
        { '--menu-r': '0px' },
        {
          '--menu-r': function () {
            return menu.dataset.radius + 'px';
          },
          duration: 0.75,
          ease: 'expo.inOut',
        },
        'reveal'
      )
      .fromTo(mark, { yPercent: 14, opacity: 0 }, { yPercent: 0, opacity: 0.09, duration: 1.4 }, 'reveal+=0.25')
      .addLabel('content', 'reveal+=0.34')
      .fromTo(top, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04 }, 'content')
      .fromTo(closeButton, { rotate: -90 }, { rotate: 0, duration: 0.7, ease: 'back.out(1.6)' }, 'content')
      .fromTo(labels, { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, stagger: 0.065 }, 'content+=0.04')
      .fromTo(numbers, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.065 }, 'content+=0.12')
      .fromTo(rules, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'expo.inOut', stagger: 0.065 }, 'content+=0.02')
      .fromTo(expands, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.065 }, 'content+=0.2')
      .fromTo(foot, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 'content+=0.28');

    return tl;
  }

  function focusables() {
    return Array.prototype.filter.call(
      menu.querySelectorAll('a[href], button:not([disabled]), summary, select, input'),
      function (element) {
        return element.offsetParent !== null || element === closeButton;
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
    setOrigin();
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    document.addEventListener('keydown', onKeydown);

    if (window.gsap && !reduceMotion.matches) {
      menu.classList.remove('is-static');
      if (!timeline) timeline = buildTimeline(window.gsap);
      if (timeline.reversed() && timeline.isActive()) {
        timeline.timeScale(1).play();
      } else {
        timeline.invalidate().timeScale(1).play(0);
      }
    } else {
      menu.classList.add('is-static');
      warm();
    }

    closeButton.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    collapseAll();

    if (timeline && !menu.classList.contains('is-static')) {
      timeline.timeScale(1.8).reverse();
    } else {
      afterClose();
    }
  }

  function afterClose() {
    if (isOpen) return;
    menu.hidden = true;
    menu.classList.remove('is-static');
    lockScroll(false);
    toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', function () {
    if (isOpen) close();
    else open();
  });
  closeButton.addEventListener('click', close);

  // Accordion for links with sub-items
  function setExpanded(button, expanded) {
    var sub = document.getElementById(button.getAttribute('aria-controls'));
    if (!sub) return;
    button.setAttribute('aria-expanded', String(expanded));
    var gsap = window.gsap;

    if (!gsap || reduceMotion.matches) {
      sub.hidden = !expanded;
      return;
    }

    gsap.killTweensOf(sub);
    if (expanded) {
      sub.hidden = false;
      gsap.fromTo(sub, { height: 0 }, { height: 'auto', duration: 0.55, ease: 'expo.out' });
      gsap.fromTo(
        sub.children,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.04, delay: 0.05 }
      );
    } else {
      gsap.to(sub, {
        height: 0,
        duration: 0.35,
        ease: 'power2.inOut',
        onComplete: function () {
          sub.hidden = true;
          sub.style.height = '';
        },
      });
    }
  }

  function collapseAll() {
    menu.querySelectorAll('.dunas-menu__expand[aria-expanded="true"]').forEach(function (button) {
      button.setAttribute('aria-expanded', 'false');
      var sub = document.getElementById(button.getAttribute('aria-controls'));
      if (sub) {
        sub.hidden = true;
        sub.style.height = '';
      }
    });
  }

  menu.querySelectorAll('.dunas-menu__expand').forEach(function (button) {
    button.addEventListener('click', function () {
      setExpanded(button, button.getAttribute('aria-expanded') !== 'true');
    });
  });

  // A page restored from the back/forward cache must never show the menu stuck open
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted || menu.hidden) return;
    if (timeline) timeline.pause(0);
    isOpen = false;
    menu.hidden = true;
    menu.classList.remove('is-static');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    collapseAll();
    lockScroll(false);
  });

  // Keep the circle origin right if the screen rotates while open
  window.addEventListener('resize', function () {
    if (isOpen) setOrigin();
  });
})();
