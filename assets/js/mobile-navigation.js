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
    if (restoreFocus) toggle.focus();
  };
  header.classList.add("mobile-nav-ready");
  toggle.hidden = false;
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
    if (mobile.matches && !header.contains(event.target)) setOpen(false);
  });
  window.addEventListener("hashchange", () => setOpen(false));
  mobile.addEventListener("change", () => {
    const focusedControl = header.contains(document.activeElement) && document.activeElement !== toggle;
    setOpen(false, mobile.matches && focusedControl);
  });
}
