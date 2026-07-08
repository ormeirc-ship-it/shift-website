// שיפט — אינטראקציות עדינות

// אנימציית הלוגו בהירו — שדרוג מלוגו סטטי לווידאו רק בדפדפנים
// שמנגנים WebM עם שקיפות באופן אמין (דסקטופ כרום/פיירפוקס).
// בספארי ובמובייל הווידאו עלול להתנגן על רקע שחור — נשארים עם הלוגו הסטטי.
const heroLogo = document.getElementById('heroLogo');
if (heroLogo) {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const canWebm = document.createElement('video')
    .canPlayType('video/webm; codecs="vp9"') === 'probably';
  if (canWebm && !isSafari && !isMobile) {
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('aria-label', 'אנימציית הלוגו של שיפט');
    const src = document.createElement('source');
    src.src = 'assets/video/logo-anim-1.webm';
    src.type = 'video/webm';
    video.appendChild(src);
    video.addEventListener('canplay', () => {
      heroLogo.replaceChildren(video);
      video.play().catch(() => {});
    }, { once: true });
    video.load();
  }
}

// אנימציות הופעה בגלילה
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('visible'));
}

// ניווט: רקע אטום אחרי גלילה
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// תפריט מובייל
const burger = document.getElementById('navBurger');
const menu = document.getElementById('mobileMenu');
menu.hidden = false;

const setMenu = (open) => {
  menu.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
};

burger.addEventListener('click', () => {
  setMenu(!menu.classList.contains('open'));
});

menu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});
