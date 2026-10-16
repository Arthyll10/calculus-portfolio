// A short guided tour: a pencil trail runs from a paper note to each thing visitors can use,
// then circles it the way a teacher marks a page. Runs once on the first visit, replayable after.
(() => {
  const steps = [
    {target: '.poster-deck', title: 'Flip through my work', text: 'Swipe the top card, or press the arrow buttons below it, to see each page. Click a card to open it.'},
    {target: '.portfolio-door', title: 'Come on in', text: 'Point at the door to swing it open, then click it to go straight to my coursework.'},
    {target: '.profile-topics', title: 'A bit about me', text: 'Above this, I introduce myself and the portfolio. Click Functions, Derivatives or Integrals to jump straight to that chapter of my work.'},
    {target: '.filters', title: 'Pick a chapter', text: 'Show only Prelims, Midterms or Finals, or all eleven activities at once.'},
    {target: '.activity:not([hidden]) .activity-photo', title: 'Open any folder', text: 'Click a folder to see the full photo of my work, what it is about, my reflection and goals, and what I would do differently.'},
    {target: '#motion-toggle', title: 'Too much movement?', text: 'Press "Pause motion" any time to stop the animations.'}
  ];
  const SEEN = 'guide-seen';
  const svgNS = 'http://www.w3.org/2000/svg';
  const smooth = () => allowed();

  const layer = document.createElementNS(svgNS, 'svg');
  layer.setAttribute('class', 'guide-layer');
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<defs><mask id="guide-reveal" maskUnits="userSpaceOnUse"><path class="guide-reveal" pathLength="1"/></mask></defs>'
    + '<path class="guide-trail" mask="url(#guide-reveal)"/><path class="guide-ring" pathLength="1"/>';
  const [reveal, trail, ring] = ['.guide-reveal', '.guide-trail', '.guide-ring'].map(s => layer.querySelector(s));

  const note = document.createElement('section');
  note.className = 'guide-note';
  note.setAttribute('aria-label', 'Portfolio guide');
  note.innerHTML = '<p class="guide-count" aria-live="polite"></p><h2 class="guide-title"></h2><p class="guide-text"></p>'
    + '<div class="guide-actions"><button type="button" class="guide-skip">Skip tour</button>'
    + '<button type="button" class="guide-back">Back</button><button type="button" class="guide-next">Next</button></div>';
  const $n = s => note.querySelector(s);

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'guide-replay';
  replay.textContent = 'Show me around';
  // The hero's smiley is the guide: it leaves home, rides each trail to the feature, and flies back at the end.
  const buddy = document.createElement('div');
  buddy.className = 'guide-buddy';
  buddy.setAttribute('aria-hidden', 'true');
  buddy.innerHTML = document.querySelector('.floating-smile')?.innerHTML || '';
  document.body.append(layer, note, replay, buddy);
  let buddyAt = null, flight = 0;
  const home = () => {
    const r = document.querySelector('.hero .floating-smile')?.getBoundingClientRect();
    return r && r.width && r.bottom > 0 && r.top < innerHeight ? [r.left + r.width / 2, r.top + r.height / 2] : null;
  };
  const park = p => { buddyAt = p; buddy.style.translate = `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`; };
  // Points along a quadratic curve, as translate keyframes; the timing curve paces the whole glide.
  // `pace` shapes speed along the curve; `from`/`to` place these frames inside a longer animation.
  const curve = (a, c, b, pace = t => t, from = 0, to = 1, n = 18) => Array.from({length: n + 1}, (_, i) => { const t = pace(i / n), u = 1 - t;
    return {offset: from + (to - from) * i / n, translate: `${(u * u * a[0] + 2 * u * t * c[0] + t * t * b[0]).toFixed(1)}px ${(u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]).toFixed(1)}px`}; });
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lifted = (a, b) => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 70];
  const glide = 'cubic-bezier(.45,0,.25,1)';

  let index = -1, live = [], shown = false;

  function liveSteps() {
    return steps.filter(s => { const el = document.querySelector(s.target); return el && !el.closest('[hidden]') && el.getClientRects().length; });
  }
  // A loose, slightly overshooting loop around the target, like a pen circling it.
  // A loose, slightly overshooting loop around the target, starting at angle a0 (where the smiley lands).
  function ringPoints(r, a0) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const rx = r.width / 2 + 16, ry = r.height / 2 + 14;
    return Array.from({length: 65}, (_, i) => {
      const t = a0 + (i / 64) * (Math.PI * 2 + 0.45);
      const wobble = 1 + 0.03 * Math.sin(t * 3) + (i / 64) * 0.05;
      return [cx + Math.cos(t) * rx * wobble, cy + Math.sin(t) * ry * wobble];
    });
  }
  const pathOf = pts => pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
  const along = (pts, from = 0, to = 1) => pts.map((q, i) => ({offset: from + (to - from) * i / (pts.length - 1), translate: `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`}));
  let loop = [];
  function placeNote(r) {
    const gap = 28, w = note.offsetWidth, h = note.offsetHeight, vw = innerWidth, vh = innerHeight;
    if (vw < 640) return {x: (vw - w) / 2, y: vh - h - 12, from: 'top'};
    const below = vh - r.bottom - 14, above = r.top - 14, right = vw - r.right - 16;
    let x, y, from;
    if (right > w + gap + 30) { x = r.right + gap + 30; y = r.top + r.height / 2 - h / 2; from = 'left'; }
    else if (r.left - 16 > w + gap + 30) { x = r.left - gap - 30 - w; y = r.top + r.height / 2 - h / 2; from = 'right'; }
    else if (below > h + gap + 20) { x = r.left + r.width / 2 - w / 2; y = r.bottom + gap + 20; from = 'top'; }
    else if (above > h + gap + 20) { x = r.left + r.width / 2 - w / 2; y = r.top - gap - 20 - h; from = 'bottom'; }
    else { x = r.left + r.width / 2 - w / 2; y = vh - h - 16; from = 'top'; }
    return {x: Math.min(Math.max(x, 16), vw - w - 16), y: Math.min(Math.max(y, 16), vh - h - 16), from};
  }
  function trailPath(p, r) {
    const w = note.offsetWidth, h = note.offsetHeight;
    const start = p.from === 'left' ? [p.x - 6, p.y + h / 2] : p.from === 'right' ? [p.x + w + 6, p.y + h / 2] : p.from === 'bottom' ? [p.x + w / 2, p.y + h + 6] : [p.x + w / 2, p.y - 6];
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // End on the ring's edge, on the line toward the note.
    const ang = Math.atan2(start[1] - cy, start[0] - cx);
    const end = [cx + Math.cos(ang) * (r.width / 2 + 18), cy + Math.sin(ang) * (r.height / 2 + 16)];
    const mx = (start[0] + end[0]) / 2, my = (start[1] + end[1]) / 2;
    const bend = Math.min(90, Math.hypot(end[0] - start[0], end[1] - start[1]) * 0.25);
    return {start, ctrl: [mx + bend, my - bend], end};
  }
  function draw(animate) {
    const step = live[index]; if (!step) return;
    const r = document.querySelector(step.target).getBoundingClientRect();
    // The visitor clicked away (a link jumped, a filter hid it): dock the note in the corner with the smiley on it.
    const onScreen = r.width > 0 && r.bottom > 70 && r.top < innerHeight - 40;
    layer.classList.toggle('is-shown', onScreen);
    if (!onScreen) {
      const x = innerWidth - note.offsetWidth - 16, y = innerHeight - note.offsetHeight - 16;
      note.style.translate = `${Math.max(12, x)}px ${y}px`;
      buddy.getAnimations().forEach(a => a.cancel());
      park([Math.max(12, x) + 10, y + 6]);
      buddy.classList.add('is-shown', 'is-parked');
      return;
    }
    const p = placeNote(r);
    note.style.translate = `${Math.round(p.x)}px ${Math.round(p.y)}px`;
    const {start, ctrl, end: tip} = trailPath(p, r);
    const d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}Q${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`;
    // The circle starts where the trail ends, so the smiley can fly straight on around it.
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    loop = ringPoints(r, Math.atan2((tip[1] - cy) / (r.height / 2 + 16), (tip[0] - cx) / (r.width / 2 + 18)));
    trail.setAttribute('d', d); reveal.setAttribute('d', d); ring.setAttribute('d', pathOf(loop));
    buddy.classList.add('is-shown');
    if (!animate || !smooth()) { buddy.getAnimations().forEach(a => a.cancel()); park(loop.at(-1)); return; }
    // Fly to the note, ride the trail to the feature drawing the dots, then fly around it drawing the circle.
    const id = ++flight, from = buddyAt || home() || start, hop = 560, ride = 700, orbit = 950, total = hop + ride + orbit;
    buddy.getAnimations().forEach(a => a.cancel());
    buddy.classList.remove('is-parked');
    buddy.animate([
      ...curve(from, lifted(from, start), start, easeInOut, 0, hop / total),
      ...curve(start, ctrl, tip, t => t, hop / total, (hop + ride) / total).slice(1),
      ...along(loop, (hop + ride) / total, 1).slice(1)
    ], {duration: total, easing: 'linear'});
    buddy.animate([{scale: 1}, {scale: 1.18, offset: .2}, {scale: 1, offset: .55}, {scale: 1.1, offset: .8}, {scale: 1}], {duration: total, easing: glide});
    park(loop.at(-1));
    setTimeout(() => { if (id === flight) buddy.classList.add('is-parked'); }, total);
    reveal.animate([{strokeDashoffset: 1}, {strokeDashoffset: 0}], {duration: ride, delay: hop, easing: 'linear', fill: 'both'});
    ring.animate([{strokeDashoffset: 1}, {strokeDashoffset: 0}], {duration: orbit, delay: hop + ride, easing: 'linear', fill: 'both'});
    note.animate([{opacity: 0, scale: .94}, {opacity: 1, scale: 1}], {duration: 380, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  // Bring the target fully into view; on phones, into the space above the note docked at the bottom.
  function settle(el) {
    return new Promise(done => {
      const r = el.getBoundingClientRect(), phone = innerWidth < 640;
      const bottom = innerHeight - (phone ? note.offsetHeight + 40 : 40);
      if (r.top > 90 && r.bottom < bottom) return done();
      const top = phone || r.height > bottom - 90 ? scrollY + r.top - 90 : scrollY + r.top - (innerHeight - r.height) / 2;
      scrollTo({top, behavior: smooth() ? 'smooth' : 'auto'});
      if (!smooth()) return done();
      let t = setTimeout(done, 900);
      addEventListener('scrollend', () => { clearTimeout(t); done(); }, {once: true});
    });
  }
  async function go(i) {
    live = liveSteps();
    if (i < 0 || i >= live.length) return end();
    index = i;
    const step = live[i];
    document.body.classList.add('guide-on');
    shown = false;
    note.classList.remove('is-shown'); layer.classList.remove('is-shown');
    $n('.guide-count').textContent = `Step ${i + 1} of ${live.length}`;
    $n('.guide-title').textContent = step.title;
    $n('.guide-text').textContent = step.text;
    $n('.guide-back').hidden = i === 0;
    $n('.guide-next').textContent = i === live.length - 1 ? 'Done' : 'Next';
    await settle(document.querySelector(step.target));
    if (index !== i) return;
    note.classList.add('is-shown'); layer.classList.add('is-shown');
    draw(true); shown = true;
    $n('.guide-next').focus({preventScroll: true});
  }
  function end() {
    index = -1; shown = false;
    note.classList.remove('is-shown'); layer.classList.remove('is-shown');
    try { localStorage.setItem(SEEN, '1'); } catch {}
    const id = ++flight, back = home();
    const done = () => { if (id !== flight) return; buddy.classList.remove('is-shown', 'is-parked'); buddyAt = null; document.body.classList.remove('guide-on'); };
    buddy.getAnimations().forEach(a => a.cancel());
    // Fly home if home is on screen; otherwise just fade away where it is.
    if (!smooth() || !back || !buddyAt) return done();
    buddy.classList.remove('is-parked');
    buddy.animate(curve(buddyAt, lifted(buddyAt, back), back), {duration: 700, easing: glide}).finished.then(done, () => {});
    park(back);
  }

  // Poke the smiley: it winks and does a happy lap of the circle (or just a wiggle while docked).
  buddy.addEventListener('click', () => {
    if (index < 0 || !buddy.classList.contains('is-parked') || !smooth()) return;
    const face = buddy.querySelector('svg'), eye = buddy.querySelectorAll('circle')[2];
    face.animate([{scale: 1}, {scale: '1.25 .8'}, {scale: '.9 1.15'}, {scale: 1}], {duration: 420, easing: 'cubic-bezier(.16,1,.3,1)'});
    eye?.animate([{scale: 1}, {scale: '1 .1', offset: .3}, {scale: '1 .1', offset: .6}, {scale: 1}], {duration: 700});
    if (!layer.classList.contains('is-shown') || !loop.length) return;
    const id = ++flight;
    buddy.classList.remove('is-parked');
    buddy.animate(along([loop.at(-1), ...loop.slice(5)]), {duration: 1100, easing: 'cubic-bezier(.45,0,.25,1)'})
      .finished.then(() => { if (id === flight) buddy.classList.add('is-parked'); }, () => {});
    ring.animate([{strokeWidth: 3.5}, {strokeWidth: 7}, {strokeWidth: 3.5}], {duration: 1100, easing: 'ease-in-out'});
  });
  $n('.guide-next').addEventListener('click', () => go(index + 1));
  $n('.guide-back').addEventListener('click', () => go(index - 1));
  $n('.guide-skip').addEventListener('click', end);
  replay.addEventListener('click', () => go(0));
  addEventListener('keydown', e => { if (e.key === 'Escape' && index >= 0 && !dialog.open) end(); });
  // Keep the trail attached while the page moves; no re-drawing animation.
  let frame = 0;
  const follow = () => { if (index < 0 || !shown) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => draw(false)); };
  addEventListener('scroll', follow, {passive: true});
  addEventListener('resize', follow);

  let seen = false;
  try { seen = localStorage.getItem(SEEN) === '1'; } catch {}
  if (!seen) pageReady.then(() => setTimeout(() => { if (index < 0 && !dialog.open) go(0); }, 1800));
})();
