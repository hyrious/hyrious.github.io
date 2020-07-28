void (function () {
  /* Closures are poor man's objects. */
  function useDarkTheme() {
    let prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
    let defaultTheme = () => (prefersDarkTheme.matches ? 'dark' : 'light');
    let theme = localStorage.getItem('theme') || defaultTheme();
    let setTheme = t => document.documentElement.setAttribute('data-theme', t);
    prefersDarkTheme.addEventListener('change', e => {
      if (localStorage.getItem('theme') == null) {
        theme = e.matches ? 'dark' : 'light';
        setTheme(theme);
      }
    });
    setTheme(theme);
    return (clear = false) => {
      if (clear) {
        theme = defaultTheme();
        localStorage.removeItem('theme');
      } else {
        theme = theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
      }
      setTheme(theme);
    };
  }

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  let withoutDefault = callback => e => {
    e.preventDefault();
    callback(e);
  };

  Node.prototype.on = Node.prototype.addEventListener;

  function ready(callback) {
    if (document.readyState !== 'loading') callback();
    else document.addEventListener('DOMContentLoaded', callback);
  }

  let switchTheme = useDarkTheme();

  ready(async () => {
    // prettier-ignore
    for (let e of $$('.switch-theme')) {
      e.on('click', withoutDefault(_ => switchTheme()));
      e.on('contextmenu', withoutDefault(_ => switchTheme(true)));
    }
  });
})();
