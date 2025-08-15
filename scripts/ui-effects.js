(function(){
  let ticking = false;

  function updateParallax() {
    const y = Math.min(window.scrollY, 20);
    document.documentElement.style.setProperty('--parallax', y + 'px');
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateParallax);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  updateParallax();
})();
