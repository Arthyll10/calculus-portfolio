const $ = selector => document.querySelector(selector);
const dialog = $('#activity-dialog');
const cards = [...document.querySelectorAll('.activity')];
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const motion = window.Motion;
let paused = false;
const allowed = () => motion && !preference.matches && !paused;
const transitions = new Set();
const feedback = new WeakMap();
const resetInteractions = [];
// Replace an interrupted hover from its current visual position, never queue it.
function respond(element, frames, options = {}) {
  if (!allowed()) return;
  const previous = feedback.get(element);
  if (previous) { previous.stop(); transitions.delete(previous); }
  if (!allowed()) return;
  const control = motion.animate(element, frames, {type:'spring',stiffness:320,damping:28,mass:.65,...options});
  feedback.set(element,control);transitions.add(control);
  Promise.resolve(control).then(()=>{transitions.delete(control);if(feedback.get(element)===control)feedback.delete(element);});
}

function animate(element, frames, options = {}) {
  if (!allowed()) {
    Object.entries(frames).forEach(([key, value]) => element.style[key] = Array.isArray(value) ? value.at(-1) : value);
    return Promise.resolve();
  }
  const control = motion.animate(element, frames, {...(options.type === 'spring' ? {} : {duration:.48, ease:[.22,1,.36,1]}), ...options});
  transitions.add(control);
  return Promise.resolve(control).then(() => transitions.delete(control));
}
const formatDate = value => new Intl.DateTimeFormat('en-US', {month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
let visibleActivities = activities, modalActivities = activities, selectedIndex = 0, opener;
$('.filters').hidden = false;
const captions = {All:'From functions to integrals, one page at a time.',Prelims:'Building the foundations.',Midterms:'Finding the rate of change.',Finals:'Bringing it all together.'};
$('.filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  const term = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  visibleActivities = activities.filter(a => term === 'All' || a.term === term);
  let shown = 0;
  cards.forEach(card => {
    const hide = term !== 'All' && card.dataset.term !== term;
    card.hidden = hide;
    if (!hide && card.dataset.revealed) animate(card,{opacity:[0,1],translate:['0 12px','0 0']},{duration:.4,delay:Math.min(shown++,8)*.04});
  });
  $('#collection-description').textContent = captions[term];
  $('#result-count').textContent = `${visibleActivities.length} activities`;
});
document.querySelectorAll('[data-term-link]').forEach(link => link.addEventListener('click', () => $(`[data-filter="${link.dataset.termLink}"]`).click()));
const learningNotes = {
  operations: [['Functions','Algebra','Domain'], 'Combine functions carefully and check which inputs are allowed.'],
  derivatives: [['Power rule','Exponents','Constants'], 'Multiply by the exponent, subtract one, and differentiate constants as zero.'],
  'prelim-quiz': [['Prelims','Quiz','Review'], 'Write intermediate steps clearly and check the algebra in each solution.'],
  infographics: [['Functions','Limits','Applications'], 'Connect calculus ideas to changes in real-world situations.'],
  'prelim-exam': [['Prelims','Exam','Foundations'], 'Review the reasoning behind each answer and check the work consistently.'],
  differentiation: [['Derivatives','Formulas','Power rule'], 'Identify the rule that fits each term before simplifying.'],
  'chain-rule': [['Composite functions','Chain rule'], 'Differentiate the outer function, then multiply by the inner derivative.'],
  implicit: [['Implicit differentiation','Exponentials','Trigonometry'], 'Identify the function type and apply its differentiation rule.'],
  'integral-drills': [['Integration','Antiderivatives','Constant C'], 'Differentiate an antiderivative to check the result.'],
  'trig-integration': [['Trigonometric integrals','Identities'], 'Look for a useful identity before choosing an integration approach.'],
  'finals-quiz': [['Finals','Quiz','Integration'], 'Review each solution and keep the integration steps organized.']
};
function setZoom(zoomed) {
  $('#scan-viewport').classList.toggle('is-zoomed',zoomed);
  $('#zoom-fit').setAttribute('aria-pressed',String(!zoomed));
  $('#zoom-in').setAttribute('aria-pressed',String(zoomed));
  $('#scan-viewport').scrollTo(0,0);
}
$('#zoom-fit').addEventListener('click',()=>setZoom(false));
$('#zoom-in').addEventListener('click',()=>setZoom(true));
function renderActivity() {
  const a = modalActivities[selectedIndex];
  $('#modal-title').textContent = a.title;
  $('#modal-chapter').textContent = a.term;
  const [topics] = learningNotes[a.id];
  $('#modal-topics').replaceChildren(...topics.map(text=>{const tag=document.createElement('span');tag.textContent=text;return tag;}));
  setZoom(false);
  $('#modal-term').textContent = a.term;
  $('#modal-date').dateTime = a.date;
  $('#modal-date').textContent = formatDate(a.date);
  $('#modal-image').src = a.image;
  $('#modal-image').alt = `${a.title} — original submitted work`;
  $('#original-link').href = a.image;
  $('#modal-description').textContent = a.description;
  $('#modal-reflection').textContent = a.reflection;
  $('#modal-goal-short').textContent = a.goals.short;
  $('#modal-goal-long').textContent = a.goals.long;
  $('#modal-critique').textContent = a.critique.issue;
  $('#modal-alternative').textContent = a.critique.alternative;
  $('#modal-position').textContent = `Activity ${selectedIndex+1} of ${modalActivities.length}`;
  $('#pdf-link').hidden = a.id !== 'infographics';
  $('#previous').disabled = selectedIndex === 0;
  $('#next').disabled = selectedIndex === modalActivities.length-1;
  dialog.scrollTop = 0;
}
// The popup opens like a file: the folder flap lifts, the sheet grows out of the folder you picked,
// then its contents settle in one by one. Closing tucks it back into the folder you're viewing.
const curve={out:'cubic-bezier(.16,1,.3,1)',pop:'cubic-bezier(.32,.72,0,1)',in:'cubic-bezier(.5,0,.75,0)',inOut:'cubic-bezier(.6,0,.2,1)'};
function play(el,frames,options){
  if(!allowed())return Promise.resolve();
  return el.animate(frames,{fill:'backwards',...options}).finished.catch(()=>{});
}
// Only the effects started here; the CSS floating loops inside the popup keep running.
const clearPlayed=()=>dialog.getAnimations({subtree:true}).filter(a=>!(a instanceof CSSAnimation)&&!(a instanceof CSSTransition)).forEach(a=>a.cancel());
const contentParts=(withToolbar=true)=>[...dialog.querySelectorAll(`${withToolbar?'.modal-toolbar,':''}.scan-frame,.scan-note,.modal-meta,#modal-title,.title-stroke,.modal-topics span,.about-work,.reflection,.goal,.critique,#pdf-link:not([hidden]),.modal-navigation`)];
function revealContent(baseDelay=0,dir=0,withToolbar=true){
  contentParts(withToolbar).forEach((el,i)=>{
    const delay=baseDelay+i*45;
    if(el.matches('.title-stroke'))play(el,[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:620,delay:delay+120,easing:curve.out});
    else play(el,[{opacity:0,translate:`${dir*22}px 14px`},{opacity:1,translate:'0 0'}],{duration:540,delay,easing:curve.out});
  });
}
// Where the popup comes from or returns to: the deck card if that's what was opened, otherwise the activity's folder.
function originOf(id,via){
  const folder=document.getElementById(id);
  const candidates=[via?.classList?.contains('work-card')&&featured[deckIndex]?.id===id?via:null,folder&&!folder.hidden?folder.querySelector('.activity-photo'):null];
  for(const el of candidates){
    if(!el)continue;const r=el.getBoundingClientRect();
    if(r.width&&r.bottom>0&&r.top<innerHeight)return {folder:el.closest('.activity'),r};
  }
  return null;
}
function flipFrom(r){
  const to=dialog.getBoundingClientRect();
  return `translate(${r.left+r.width/2-(to.left+to.width/2)}px,${r.top+r.height/2-(to.top+to.height/2)}px) scale(${r.width/to.width},${r.height/to.height})`;
}
function liftFlap(folder,ms){if(!folder||!allowed())return;folder.classList.add('is-opening');setTimeout(()=>folder.classList.remove('is-opening'),ms);}
function openActivity(id, trigger, list) {
  if (!dialog.showModal) return false;
  modalActivities = list;
  selectedIndex = list.findIndex(a => a.id === id);
  if (selectedIndex < 0) return false;
  opener = trigger;
  const origin=originOf(id,trigger);
  liftFlap(origin?.folder,750);
  renderActivity(); clearPlayed(); dialog.showModal();
  document.body.classList.add('modal-open');
  $('#close-modal').focus({preventScroll:true});
  play(dialog,[{opacity:0},{opacity:1}],{duration:420,pseudoElement:'::backdrop',easing:'ease-out'});
  play(dialog,[{transform:origin?flipFrom(origin.r):'translateY(28px) scale(.92)',opacity:0},{opacity:1,offset:.18},{transform:'none',opacity:1}],{duration:720,delay:origin?.folder?90:0,easing:curve.pop});
  revealContent(origin?.folder?330:240);
  updateIdle();
  return true;
}
cards.forEach(card => card.querySelector('summary').addEventListener('click', event => {
  if (openActivity(card.id, event.currentTarget, visibleActivities)) event.preventDefault();
}));
let closing = false;
async function closeDialog() {
  if (!dialog.open || closing) return;
  closing = true;
  if(allowed()){
    const origin=originOf(modalActivities[selectedIndex].id,opener);
    contentParts().forEach(el=>el.animate([{opacity:1},{opacity:0}],{duration:170,easing:'ease-in',fill:'forwards'}));
    liftFlap(origin?.folder,700);
    dialog.animate([{opacity:1},{opacity:0}],{duration:460,pseudoElement:'::backdrop',easing:'ease-in',fill:'forwards'});
    await dialog.animate([{transform:'none',opacity:1},{opacity:1,offset:.75},{transform:origin?flipFrom(origin.r):'translateY(24px) scale(.94)',opacity:0}],{duration:460,easing:curve.inOut,fill:'forwards'}).finished.catch(()=>{});
  }
  dialog.close();
  clearPlayed();
  closing = false;
}
$('#close-modal').addEventListener('click', closeDialog);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('close', () => {document.body.classList.remove('modal-open');opener?.focus({preventScroll:true});updateIdle();});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) closeDialog();
});
// Turning to the next file: the current page slides away, the next one deals in from the other side.
let stepping = false;
async function step(delta) {
  const next = selectedIndex+delta;
  if (next<0 || next>=modalActivities.length || stepping || closing) return;
  stepping = true;
  if(allowed())await Promise.all(contentParts(false).map((el,i)=>el.animate([{opacity:1,translate:'0 0'},{opacity:0,translate:`${-delta*26}px 0`}],{duration:190,delay:i*14,easing:curve.in,fill:'forwards'}).finished.catch(()=>{})));
  selectedIndex = next; renderActivity(); clearPlayed();
  revealContent(0,delta,false);
  play($('#modal-position'),[{scale:.85},{scale:1.08},{scale:1}],{duration:420,easing:curve.out});
  stepping = false;
}
$('#previous').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
dialog.addEventListener('keydown', e => {if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});

// Real coursework is the carousel's content; there is no automatic page change.
const featuredIds = ['infographics','chain-rule','trig-integration'];
const featured = [...featuredIds.map(id => activities.find(a => a.id === id)), ...activities.filter(a => !featuredIds.includes(a.id))];
const deckRoot=$('.deck-float');
const template=$('.deck-front').cloneNode(true);
const deckCards=featured.map(a=>{
  const card=template.cloneNode(true);
  card.href='#'+a.id;card.dataset.activityId=a.id;
  card.setAttribute('aria-label',`Open ${a.title}`);
  card.querySelector('img').src=a.thumb;card.querySelector('img').alt=a.title;
  card.querySelector('.deck-term').textContent=a.term;
  const caption=card.querySelector('.work-card-caption');caption.replaceChildren();
  const title=document.createElement('strong');title.textContent=a.title;
  const date=document.createElement('span');date.textContent=formatDate(a.date);caption.append(title,date);
  return card;
});
deckRoot.replaceChildren(...deckCards);
let front=deckCards[0];
let deckIndex = 0, busy = false, gesture = null, suppressClick = false;
let idle, deckVisible = true, deckHovered = false;
function updateIdle() {
  const shouldPlay = allowed() && deckVisible && !document.hidden && !dialog.open && !gesture && !busy && !deckHovered;
  if (!allowed()) { idle?.stop();idle=null;$('.deck-float').style.transform='translateY(0)';return; }
  if (shouldPlay && !idle) idle = motion.animate($('.deck-float'), {transform:['translateY(0px) rotate(0deg)','translateY(-9px) rotate(-.8deg)','translateY(0px) rotate(0deg)','translateY(-5px) rotate(.6deg)','translateY(0px) rotate(0deg)']}, {duration:10,repeat:Infinity,ease:'easeInOut'});
  if (shouldPlay) idle?.play(); else idle?.pause();
}
// The deck runs its own small animator: each card's pose is plain numbers we always know,
// so a drag, a hover tilt and a deal can hand off to each other mid-motion without jumps.
const KEYS=['x','y','r','s','rx','ry'];
const P=(x,y,r,s=1,rx=0,ry=0)=>({x,y,r,s,rx,ry});
const restPose=[P(0,0,0),P(10,7,6,.98),P(-9,13,-5,.96)];
// On hover the deck fans out and the front card lifts, tilting toward the pointer (tx, ty run -0.5 to 0.5).
const hoverPose=(position,tx=0,ty=0)=>[P(0,-12,-1,1.04,-ty*10,tx*14),P(40,2,12,.98),P(-38,10,-11,.96)][position];
const cardPose=position=>restPose[Math.min(position,2)];
const deckState=new Map(deckCards.map(card=>[card,{p:{...restPose[2]},v:P(0,0,0,0),run:null,finish:null}]));
function paint(card){const{p}=deckState.get(card);card.style.transform=`perspective(900px) translate(${p.x}px,${p.y}px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotate(${p.r}deg) scale(${p.s})`;}
// Taking over a card settles any timed move still waiting on it, so nothing awaiting it hangs.
function takeOver(st){const finish=st.finish;st.finish=null;st.run=null;finish?.();}
function place(card,to){const st=deckState.get(card);takeOver(st);st.p={...to};st.v=P(0,0,0,0);paint(card);}
const easeOut=t=>1-Math.pow(1-t,4), easeIn=t=>t*t*t, easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
let deckFrame=0;
function deckLoop(now){
  deckFrame=0;let active=false;
  deckState.forEach((st,card)=>{if(st.run){active=true;if(st.run(now,st)===false)st.run=null;paint(card);}});
  if(active)deckFrame=requestAnimationFrame(deckLoop);
}
const wake=()=>{if(!deckFrame)deckFrame=requestAnimationFrame(deckLoop);};
// Timed move, starting from wherever the card is right now.
function tween(card,to,duration=.5,ease=easeOut,delay=0){
  if(!allowed()){place(card,to);return Promise.resolve();}
  const st=deckState.get(card);const from={...st.p};let start=null;
  takeOver(st);
  return new Promise(done=>{
    st.v=P(0,0,0,0);st.finish=done;
    st.run=(now,s)=>{start??=now+delay*1000;const t=Math.min(1,Math.max(0,(now-start)/(duration*1000)));const k=ease(t);
      KEYS.forEach(key=>s.p[key]=from[key]+(to[key]-from[key])*k);if(t>=1){s.finish=null;done();return false;}};
    wake();
  });
}
// Spring that keeps its velocity when retargeted, for hover and tilt.
function spring(card,to,stiffness=260,damping=24){
  if(!allowed()){place(card,to);return;}
  let last=null;const st=deckState.get(card);takeOver(st);
  st.run=(now,s)=>{const dt=Math.min(.032,last===null?.016:(now-last)/1000);last=now;let moving=false;
    KEYS.forEach(key=>{const a=stiffness*(to[key]-s.p[key])-damping*s.v[key];s.v[key]+=a*dt;s.p[key]+=s.v[key]*dt;
      if(Math.abs(to[key]-s.p[key])>.01||Math.abs(s.v[key])>.01)moving=true;});
    if(!moving){s.p={...to};s.v=P(0,0,0,0);return false;}};
  wake();
}
const stackCards=()=>[0,1,2].map(position=>deckCards[(deckIndex+position)%featured.length]);
function renderDeck(keepPoses=false) {
  deckCards.forEach((card,index)=>{
    const position=(index-deckIndex+featured.length)%featured.length;
    card.className='work-card '+(position===0?'deck-front':position===1?'deck-middle':'deck-back');
    card.style.zIndex=String(featured.length-position);
    card.style.visibility=position<3?'visible':'hidden';
    if(!keepPoses||position>2)place(card,cardPose(position));
    card.tabIndex=position===0?0:-1;
    card.setAttribute('aria-hidden',String(position!==0));
  });
  front=deckCards[deckIndex];
  $('#deck-position').textContent=`${deckIndex+1} / ${featured.length}`;
}
// A flick keeps its momentum; a button or key press eases the card in from rest.
async function changeDeck(direction, advance=direction, flung=false) {
  if(busy)return;
  busy=true;updateIdle();cancelAnimationFrame(tiltFrame);
  front.classList.remove('is-hovered');
  const outgoing=front;
  const nextIndex=(deckIndex+advance+featured.length)%featured.length;
  const incoming=deckCards[nextIndex];
  const side=-direction;
  const travel=Math.max(outgoing.offsetWidth*.95,Math.abs(deckState.get(outgoing).p.x)+40);
  const arc=P(side*travel,-16,side*14,1);
  const toss=flung?easeOut:easeInOut, tossTime=flung?.3:.42;
  if(advance===1){
    // The top card is tossed aside while the next one rises, then it tucks in at the bottom.
    const middle=deckCards[(nextIndex+1)%featured.length];
    const lag=flung?0:.14;
    const rising=Promise.all([tween(incoming,cardPose(0),.6,easeOut,.08+lag),tween(middle,cardPose(1),.6,easeOut,.12+lag)]);
    await tween(outgoing,arc,tossTime,toss);
    outgoing.style.zIndex='0';
    await Promise.all([tween(outgoing,cardPose(2),.45,easeInOut),rising]);
  }else{
    // Previous reverses the deal: the bottom card slides out from the side and lands on top.
    incoming.style.visibility='visible';incoming.style.zIndex='0';
    place(incoming,cardPose(2));
    const settling=Promise.all([tween(outgoing,cardPose(1),.5,easeOut,.12),tween(deckCards[(deckIndex+1)%featured.length],cardPose(2),.5,easeOut,.12)]);
    await tween(incoming,arc,tossTime,toss);
    incoming.style.zIndex=String(featured.length+1);
    await Promise.all([tween(incoming,cardPose(0),.45,easeInOut),settling]);
  }
  deckIndex=nextIndex;
  renderDeck(true);busy=false;
  if(front.matches(':hover'))hoverDeck(true);
  updateIdle();
}
let tiltFrame=0;
function hoverDeck(on) {
  deckHovered=on;
  if(busy||gesture||!allowed()){updateIdle();return;}
  front.classList.toggle('is-hovered',on);
  stackCards().forEach((card,position)=>spring(card,on?hoverPose(position):cardPose(position),position?200:240,position?20:22));
  updateIdle();
}
function tiltFront(e) {
  if(!deckHovered||busy||gesture||!allowed())return;
  const box=$('#work-deck').getBoundingClientRect();
  const tx=Math.max(-.5,Math.min(.5,(e.clientX-box.left)/box.width-.5));
  const ty=Math.max(-.5,Math.min(.5,(e.clientY-box.top)/box.height-.5));
  front.style.setProperty('--gx',`${(tx+.5)*100}%`);front.style.setProperty('--gy',`${(ty+.5)*100}%`);
  cancelAnimationFrame(tiltFrame);
  tiltFrame=requestAnimationFrame(()=>{if(!busy&&!gesture)spring(front,hoverPose(0,tx,ty),300,26);});
}
resetInteractions.push(()=>{deckCards.forEach(card=>card.classList.remove('is-hovered'));if(!busy)renderDeck();});
$('.deck-controls').hidden=false;
$('#deck-next').addEventListener('click', () => changeDeck(1));
$('#deck-previous').addEventListener('click', () => changeDeck(-1));
deckCards.forEach(front=>{
front.addEventListener('keydown', e => {if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();changeDeck(e.key==='ArrowLeft'?-1:1);}});
front.addEventListener('pointerenter', e => {if(e.pointerType==='touch'){deckHovered=true;updateIdle();}else hoverDeck(true);});
front.addEventListener('pointerleave', e => {if(e.pointerType==='touch'){deckHovered=false;updateIdle();}else hoverDeck(false);});
front.addEventListener('pointermove', e => {if(e.pointerType!=='touch')tiltFront(e);});
front.addEventListener('dragstart', e => e.preventDefault());
front.addEventListener('click', e => {
  if(suppressClick || busy){e.preventDefault();return;}
  if(openActivity(featured[deckIndex].id,front,activities)) e.preventDefault();
});
front.addEventListener('pointerdown', e => {
  if(e.button!==0 || busy || !e.isPrimary || front!==deckCards[deckIndex])return;
  suppressClick=false;
  const p=deckState.get(front).p;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,locked:false,time:performance.now(),from:{...p}};updateIdle();
});
front.addEventListener('pointermove', e => {
  if(!gesture || e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x, dy=e.clientY-gesture.y;
  if(!gesture.locked && Math.abs(dy)>12 && Math.abs(dy)>Math.abs(dx)){gesture=null;updateIdle();return;}
  if(!gesture.locked && Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)*1.2){gesture.locked=true;front.setPointerCapture(e.pointerId);front.classList.remove('is-hovered');}
  if(!gesture.locked)return;
  gesture.dx=dx;suppressClick=true;
  // The card follows the finger directly, keeping the lift it had when the drag began.
  if(allowed())place(front,P(gesture.from.x+dx,gesture.from.y+dy*.1,dx/22,gesture.from.s));
});
function finishGesture(e, cancelled=false) {
  if(!gesture || gesture.id!==e.pointerId)return;
  const g=gesture;gesture=null;
  const velocity=Math.abs(g.dx)/Math.max(1,performance.now()-g.time);
  if(!cancelled && g.locked && (Math.abs(g.dx)>60 || (Math.abs(g.dx)>25 && velocity>.5)))changeDeck(g.dx<0?1:-1,1,true);
  else if(deckHovered&&e.pointerType!=='touch')hoverDeck(true);
  else {spring(front,cardPose(0),240,26);updateIdle();}
}
front.addEventListener('pointerup', e => finishGesture(e));
front.addEventListener('pointercancel', e => finishGesture(e,true));
front.addEventListener('lostpointercapture', e => finishGesture(e,true));
});
renderDeck();
new IntersectionObserver(entries => {deckVisible=entries[0].isIntersecting;updateIdle();}).observe($('#work-deck'));
document.addEventListener('visibilitychange',updateIdle);
const door = $('.portfolio-door');
function hinge(open) {respond($('.door-front'), {transform:`rotateY(${open ? 76 : 0}deg)`},{stiffness:120,damping:23,mass:.85});}
door.addEventListener('pointerenter',()=>hinge(true));door.addEventListener('pointerleave',()=>hinge(false));
door.addEventListener('focus',()=>hinge(true));door.addEventListener('blur',()=>hinge(false));
// Items that scroll in together arrive as a short cascade instead of all at once.
const revealObserver = new IntersectionObserver(entries => {
  const arriving=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top||a.boundingClientRect.left-b.boundingClientRect.left);
  arriving.forEach((entry,i)=>{
    revealObserver.unobserve(entry.target);entry.target.dataset.revealed='1';
    const delay=Number(entry.target.dataset.delay||0)+Math.min(i,6)*.08;
    animate(entry.target,{opacity:[0,1],translate:['0 24px','0 0']},{duration:.9,delay,ease:[.16,1,.3,1]});
  });
},{threshold:.08,rootMargin:'0px 0px -6% 0px'});
// Start the entrance once the fonts are in (or after a short wait), so nothing re-flows mid-animation.
const pageReady=Promise.race([document.fonts?.ready??Promise.resolve(),new Promise(done=>setTimeout(done,1200))]);
pageReady.then(()=>{
  document.querySelectorAll('.cutout-letter').forEach((letter,i)=>{
    animate(letter,{opacity:[0,1],translate:['0 0.32em','0 0']},{duration:.9,delay:.05+i*.028,ease:[.16,1,.3,1]});
  });
  document.querySelectorAll('.reveal,.activity').forEach(el=>revealObserver.observe(el));
});
function updateMotion() {
  document.body.classList.toggle('motion-paused',paused || preference.matches);
  $('#motion-toggle').hidden=!motion || preference.matches;
  $('#motion-toggle').textContent=paused?'Resume motion':'Pause motion';
  $('#motion-toggle').setAttribute('aria-pressed',String(paused));
  if(!allowed()){transitions.forEach(control=>{control.complete();control.stop();});transitions.clear();$('.door-front').getAnimations().forEach(a=>a.cancel());$('.door-front').style.transform='rotateY(0deg)';resetInteractions.forEach(reset=>reset());}
  updateIdle();
}
$('#motion-toggle').addEventListener('click',()=>{paused=!paused;updateMotion();});
preference.addEventListener('change',updateMotion);
updateMotion();

// Only short headings get playful letters; paragraphs and controls stay easy to read.
document.querySelectorAll('.about-word,.section-heading h2,.featured-intro h2,.footer-line,.footer-line-accent').forEach(heading=>{
  if(!heading.hasAttribute('aria-label')&&!heading.parentElement.closest('[aria-label]'))heading.setAttribute('aria-label',heading.textContent.trim());
  [...heading.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>{
    const fragment=document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach(word=>{
      if(!word.trim()){fragment.append(document.createTextNode(word));return;}
      const group=document.createElement('span');group.className='playful-word';group.setAttribute('aria-hidden','true');
      [...word].forEach((character,index)=>{const letter=document.createElement('span');letter.className='playful-letter';letter.textContent=character;letter.style.transform=`rotate(${index%3===0?-2:index%3===1?2:0}deg)`;group.append(letter);});
      fragment.append(group);
    });
    node.replaceWith(fragment);
  });
});
document.querySelectorAll('.cutout-letter,.playful-letter').forEach(letter => {
  const resting=getComputedStyle(letter).transform;
  resetInteractions.push(()=>{letter.getAnimations().forEach(a=>a.cancel());letter.style.transform=resting;});
  const enter=()=>respond(letter,{transform:'rotate(0deg) translateY(-3px) scale(1.1)'},{stiffness:360,damping:25,mass:.6});
  const leave=()=>respond(letter,{transform:resting},{stiffness:240,damping:24,mass:.7});
  letter.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')enter();});
  letter.addEventListener('pointerleave',leave);
  letter.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')enter();});
  letter.addEventListener('pointerup',leave);
  letter.addEventListener('pointercancel',leave);
});

// The header lifts once the page scrolls, and its links follow the section in view.
const header=$('#site-header');
const markScrolled=()=>header.classList.toggle('is-scrolled',scrollY>8);
addEventListener('scroll',markScrolled,{passive:true});markScrolled();
const navLinks=[...document.querySelectorAll('.site-header nav a')];
const sectionObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;
  navLinks.forEach(link=>link.setAttribute('aria-current',String(link.hash==='#'+entry.target.id)));
}),{rootMargin:'-45% 0px -50% 0px'});
document.querySelectorAll('#home,#about,#activities').forEach(section=>sectionObserver.observe(section));
