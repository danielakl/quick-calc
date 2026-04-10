(function () {
  try {
    var t = localStorage.getItem("theme");
    if (
      t === "light" ||
      (t == null && window.matchMedia("(prefers-color-scheme: light)").matches)
    ) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {}
})();
