// Progressive enhancement: navigation stays visible if JavaScript is unavailable.
export function initializeMobileNavigation() {
  const header = document.querySelector(".header");
  const toggle = document.getElementById("mobile-menu-toggle");
  const navigation = document.getElementById("main-navigation");
  if (!header || !toggle || !navigation) return;
  const mobile = window.matchMedia("(max-width: 700px)");
  const setOpen = (open, restoreFocus = false) => {
    header.classList.toggle("mobile-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.getElementById("mobile-tabbar-more")?.setAttribute("aria-expanded", String(open));
    if (restoreFocus) toggle.focus();
  };
  header.classList.add("mobile-nav-ready");
  toggle.hidden = false;
  // Bottom tab bar: the main sections within thumb reach; "Más" opens the full menu.
  const tabbar = document.getElementById("mobile-tabbar");
  const more = document.getElementById("mobile-tabbar-more");
  if (tabbar && more) {
    tabbar.hidden = false;
    document.body.classList.add("has-mobile-tabbar");
    more.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setOpen(open);
      if (open) window.scrollTo({top: 0, behavior: "instant"});
    });
  }
  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  navigation.addEventListener("click", (event) => {
    if (!mobile.matches || !event.target.closest("a[data-nav]")) return;
    setOpen(false);
    // Move focus out of the collapsed menu into the newly selected page.
    window.requestAnimationFrame(() => {
      const main = document.getElementById("main");
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobile.matches && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false, true);
    }
  });
  document.addEventListener("click", (event) => {
    if (mobile.matches && !header.contains(event.target) && !event.target.closest("#mobile-tabbar-more")) setOpen(false);
  });
  window.addEventListener("hashchange", () => setOpen(false));
  mobile.addEventListener("change", () => {
    const focusedControl = header.contains(document.activeElement) && document.activeElement !== toggle;
    setOpen(false, mobile.matches && focusedControl);
  });
}
