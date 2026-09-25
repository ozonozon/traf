/**
 * Ранний скрипт темы (вставляется в <head> до отрисовки UI).
 * Порядок приоритетов: localStorage -> Telegram colorScheme -> prefers-color-scheme -> light.
 * Благодаря этому нет «вспышки» светлого экрана перед тёмной темой.
 */
export const THEME_STORAGE_KEY = "voxy-theme";

export const THEME_INIT_SCRIPT = [
  "(function(){try{",
  `var KEY='${THEME_STORAGE_KEY}';`,
  "var stored=null;",
  "try{stored=window.localStorage.getItem(KEY)}catch(e){}",
  "var mode=(stored==='light'||stored==='dark'||stored==='system')?stored:'system';",
  "var theme=mode;",
  "if(mode==='system'){",
  "var tg=window.Telegram&&window.Telegram.WebApp;",
  "if(tg&&(tg.colorScheme==='dark'||tg.colorScheme==='light')){theme=tg.colorScheme}",
  "else{theme=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}",
  "}",
  "var root=document.documentElement;",
  "root.classList.toggle('dark',theme==='dark');",
  "root.dataset.theme=theme;",
  "root.dataset.themeMode=mode;",
  "root.style.colorScheme=theme;",
  "}catch(e){}})();",
].join("");
