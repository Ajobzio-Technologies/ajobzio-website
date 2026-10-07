/* Local-service timing: the "When" menu and the date menu (immediate, or a preferred date plus a backup within 7 days). */
import { createDropdown } from '../lib/dropdowns.js';

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date, count) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + count);
  return next;
}
function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatDay(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function createSchedulePicker() {
  const $ = (id) => document.getElementById(id);
  const whenMenu = $('whenMenu');
  const whenValue = $('whenValue');
  const dateMenu = $('dateMenu');
  const dateValue = $('dateValue');
  const datePickers = $('datePickers');
  const prefCal = $('prefCal');
  const backupDays = $('backupDays');
  const backupHint = $('backupHint');
  const when = createDropdown({ button: $('whenBtn'), menu: whenMenu, field: $('whenField') });
  const date = createDropdown({ button: $('dateBtn'), menu: dateMenu, field: $('dateField') });

  const today = startOfDay(new Date());
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let pref = null;
  let backup = null;
  let dateKind = 'immediate';

  function updateDateLabel() {
    if (dateKind === 'immediate') dateValue.textContent = 'Immediate';
    else if (pref && backup) dateValue.textContent = formatDay(pref) + ' · backup ' + formatDay(backup);
    else if (pref) dateValue.textContent = formatDay(pref) + ' preferred · pick a backup';
    else dateValue.textContent = 'Choose dates';
  }

  function renderPrefCal() {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const label = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxMonth = new Date(today.getFullYear(), today.getMonth() + 6, 1);
    let html = '<div class="cal-head"><button type="button" data-nav="-1"' + (view <= minMonth ? ' disabled' : '') + ' aria-label="Previous month">‹</button><b>' + label + '</b><button type="button" data-nav="1"' + (view >= maxMonth ? ' disabled' : '') + ' aria-label="Next month">›</button></div><div class="cal-grid">';
    ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((day) => { html += '<span>' + day + '</span>'; });
    for (let i = 0; i < startPad; i += 1) html += '<span></span>';
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const disabled = date < today;
      html += '<button type="button" data-pref="' + date.getTime() + '"' + (disabled ? ' disabled' : '') + (sameDay(date, pref) ? ' class="on"' : '') + '>' + day + '</button>';
    }
    prefCal.innerHTML = html + '</div>';
  }

  function renderBackup() {
    if (!pref) {
      backupHint.textContent = 'Choose the preferred date first. The backup has to be within the next 7 days.';
      backupDays.innerHTML = '';
      return;
    }
    const last = addDays(pref, 7);
    backupHint.textContent = 'If ' + formatDay(pref) + ' isn’t possible, the worker can come on another day up to ' + formatDay(last) + '.';
    let html = '';
    for (let i = 1; i <= 7; i += 1) {
      const day = addDays(pref, i);
      const name = day.toLocaleDateString('en-IN', { weekday: 'short' });
      html += '<button type="button" data-backup="' + day.getTime() + '"' + (sameDay(day, backup) ? ' class="on"' : '') + '><b>' + day.getDate() + '</b><small>' + name + '</small></button>';
    }
    backupDays.innerHTML = html;
    dateMenu.scrollTop = Math.max(0, backupHint.offsetTop - 12);
  }

  $('whenBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    when.toggle();
  });
  whenMenu.addEventListener('click', (event) => {
    const option = event.target.closest('button');
    if (!option) return;
    event.stopPropagation();
    whenValue.textContent = option.dataset.value;
    whenMenu.querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === option));
    when.setOpen(false);
  });

  $('dateBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    if (date.toggle() && dateKind === 'dates') {
      renderPrefCal();
      renderBackup();
    }
  });
  dateMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    const choice = event.target.closest('.date-choice');
    if (choice) {
      dateKind = choice.dataset.kind;
      dateMenu.querySelectorAll('.date-choice').forEach((item) => item.classList.toggle('on', item === choice));
      datePickers.hidden = dateKind !== 'dates';
      updateDateLabel();
      if (dateKind === 'immediate') {
        date.setOpen(false);
        return;
      }
      renderPrefCal();
      renderBackup();
      return;
    }
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      if (nav.disabled) return;
      view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1);
      renderPrefCal();
      return;
    }
    const prefBtn = event.target.closest('[data-pref]');
    if (prefBtn) {
      if (prefBtn.disabled) return;
      pref = startOfDay(new Date(Number(prefBtn.dataset.pref)));
      if (backup) {
        const earliest = addDays(pref, 1).getTime();
        const latest = addDays(pref, 7).getTime();
        if (backup.getTime() < earliest || backup.getTime() > latest) backup = null;
      }
      updateDateLabel();
      renderPrefCal();
      renderBackup();
      return;
    }
    const backupBtn = event.target.closest('[data-backup]');
    if (!backupBtn || !pref) return;
    backup = startOfDay(new Date(Number(backupBtn.dataset.backup)));
    updateDateLabel();
    renderBackup();
    date.setOpen(false);
  });

  return {
    /* The labels shown in the form, for the quote summary. */
    summary: () => ({ when: whenValue.textContent, date: dateValue.textContent })
  };
}
