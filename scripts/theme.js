(function() {
  const root = document.documentElement;
  // Enable Aurora theme by default
  root.classList.add('theme-aurora');

  // Expose global toggle for future theme switching
  window.toggleTheme = function() {
    root.classList.toggle('theme-aurora');
  };
})();

