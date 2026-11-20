'use strict';
const studioColor = {
 warm: false, level: -1, envelope: 0, colors: {},
 update(level, force = false) {
  const step = Math.round(level * 32);
  if (!force && this.level === step) return;
  this.level = step;
  const energy = step / 32;
  const hue = this.warm ? 17 - energy * 7 : 210 - energy * 10;
  const tint = (offset, saturation, light, alpha = 1) =>
   `hsla(${hue + offset}, ${saturation}%, ${light}%, ${alpha})`;
  this.colors = {
   ink: tint(0, 69, 84 + energy * 7),
   secondary: tint(2, 40, 67 + energy * 8),
   accent: tint(-3, 92, 69 + energy * 9),
   line: tint(3, 40, 36 + energy * 15, .65),
   edge: tint(0, 65, 44 + energy * 18, .82),
   grid: tint(2, 44, 55, .12 + energy * .07),
   fill: tint(0, 85, 57, .085), selected: tint(0, 85, 61, .15),
   fx: tint(this.warm ? 12 : 14, 87, 65, .15),
   lane: tint(0, 42, 70, .025)
  };
  for (const [name, color] of Object.entries(this.colors))
   document.body.style.setProperty('--studio-' + name, color);
 },
 follow(samples, playing) {
  if (!document.body.classList.contains('tech')) return;
  let sum = 0;
  if (playing) for (const sample of samples) sum += sample * sample;
  const target = Math.min(1, 3 * Math.sqrt(sum / samples.length));
  this.envelope += (target - this.envelope) * (target > this.envelope ? .28 : .08);
  this.update(this.envelope);
 },
 wave() { return this.warm ? '#ff9069' : '#67baff'; }
};
try { studioColor.warm = localStorage.getItem('studio-palette') === 'ember'; } catch {}
studioColor.update(0, true);
function paletteLabel() {
 document.getElementById('palette').textContent = studioColor.warm ? 'Ember → Blue' : 'Blue → Ember';
 document.getElementById('palette').setAttribute('aria-label',studioColor.warm ? 'Switch to blue palette' : 'Switch to orange-red palette');
}
document.getElementById('palette').onclick = () => {
 studioColor.warm = !studioColor.warm;
 studioColor.update(studioColor.envelope, true);
 paletteLabel();refresh();
 try { localStorage.setItem('studio-palette',studioColor.warm ? 'ember' : 'blue'); } catch {}
};
paletteLabel();

