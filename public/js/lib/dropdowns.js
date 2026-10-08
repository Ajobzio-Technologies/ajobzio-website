/* Popup menus attached to a button inside a form field.
   Only one is open at a time, and a click anywhere else closes them all. */
const dropdowns = new Set();

export function createDropdown({ button, menu, field }) {
  const dropdown = {
    setOpen(open) {
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      field.classList.toggle('open', open);
    },
    /* Opens it if closed (closing the others) or closes it. Returns whether it is now open. */
    toggle() {
      const open = menu.hidden;
      closeDropdowns(dropdown);
      dropdown.setOpen(open);
      return open;
    }
  };
  /* The whole field is the tap target, not just the small button inside it. */
  field.addEventListener('click', (event) => {
    if (button.contains(event.target) || menu.contains(event.target)) return;
    event.stopPropagation();
    button.click();
  });
  dropdowns.add(dropdown);
  return dropdown;
}

export function closeDropdowns(except) {
  dropdowns.forEach((dropdown) => {
    if (dropdown !== except) dropdown.setOpen(false);
  });
}

document.addEventListener('click', () => closeDropdowns());
