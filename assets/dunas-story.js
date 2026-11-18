/*
  DUNAS story entrance. Arms the section (hides what will animate) only when scripts run and
  motion is welcome, then plays each part once as it comes into view: the words line by line,
  then the photos wipe up one after the other. Nothing stays hidden without this script.
*/
(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  const init = (section) => {
    if (section.dataset.storyReady || still.matches) return;
    section.dataset.storyReady = 'true';
    const parts = section.querySelectorAll('[data-story-reveal]');
    if (!parts.length || !('IntersectionObserver' in window)) return;

    section.classList.add('is-armed');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );
    parts.forEach((part) => observer.observe(part));
  };

  document.querySelectorAll('.dunas-story--entrance').forEach(init);
  document.addEventListener('shopify:section:load', (event) => {
    const section = event.target.querySelector('.dunas-story--entrance');
    if (section) init(section);
  });
})();
