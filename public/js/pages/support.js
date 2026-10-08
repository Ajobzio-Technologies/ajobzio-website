/* Support page: shows whether the team is available right now (daily, 8am–8pm India time). */
const OPEN_HOUR = 8;
const CLOSE_HOUR = 20;

const status = document.getElementById('supportStatus');

function indiaHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
}

function update() {
  if (!status) return;
  const open = indiaHour() >= OPEN_HOUR && indiaHour() < CLOSE_HOUR;
  status.classList.toggle('is-open', open);
  status.querySelector('span').textContent = open
    ? 'We’re online now · Daily, 8am–8pm IST'
    : 'We’re offline now · Back at 8am IST';
}

update();
setInterval(update, 60 * 1000);
