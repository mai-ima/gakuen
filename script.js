/* script.js - 高機能・アクセシブルなフロントエンド動作
   機能：
   - フェードスライダー（自動再生・ドット・前後ボタン・タッチスワイプ）
   - キーボード操作（左右矢印でスライド）
   - アコーディオン（ARIA更新、キーボード対応）
   - レスポンシブ・ナビ（ハンバーガー）
   - フォーム検証（クライアント側）、Formspree対応想定
   - パフォーマンス：デバウンス、prefers-reduced-motion 対応
*/

(function () {
  'use strict';

  // ---- util: debounce ----
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ---- DOMContentLoaded ----
  document.addEventListener('DOMContentLoaded', () => {
    // set footer year
    const yElem = document.getElementById('year');
    if (yElem) yElem.textContent = new Date().getFullYear();

    // nav toggle
    const navToggle = document.querySelector('.nav-toggle');
    const mainNav = document.getElementById('main-nav');
    if (navToggle && mainNav) {
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
        mainNav.style.display = expanded ? '' : 'block';
        navToggle.setAttribute('aria-label', expanded ? 'メニューを開く' : 'メニューを閉じる');
      });
      // close nav on resize > 900px
      window.addEventListener('resize', debounce(() => {
        if (window.innerWidth > 900) {
          mainNav.style.display = '';
          navToggle.setAttribute('aria-expanded', 'false');
        }
      }, 200));
    }

    // ---- Slider implementation ----
    const slidesWrap = document.querySelector('.slides');
    const slides = Array.from(document.querySelectorAll('.slide'));
    const dots = Array.from(document.querySelectorAll('.dot'));
    const btnPrev = document.querySelector('.prev');
    const btnNext = document.querySelector('.next');
    const autoplayMs = Number(slidesWrap?.dataset?.autoplay) || 7000;
    let current = slides.findIndex(s => s.classList.contains('active')) || 0;
    let timer = null;
    let isPaused = false;

    function setActive(index) {
      slides.forEach((s, i) => {
        if (i === index) {
          s.classList.add('active');
          s.setAttribute('aria-hidden', 'false');
        } else {
          s.classList.remove('active');
          s.setAttribute('aria-hidden', 'true');
        }
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
      current = index;
    }

    function next() { setActive((current + 1) % slides.length); }
    function prev() { setActive((current - 1 + slides.length) % slides.length); }

    function startAuto() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stopAuto();
      timer = setInterval(() => { if (!isPaused) next(); }, autoplayMs);
    }
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }

    // dot click
    dots.forEach(d => {
      d.addEventListener('click', (e) => {
        const to = Number(e.currentTarget.dataset.to);
        setActive(to);
        startAuto();
      });
    });

    if (btnNext) btnNext.addEventListener('click', () => { next(); startAuto(); });
    if (btnPrev) btnPrev.addEventListener('click', () => { prev(); startAuto(); });

    // mouse enter/leave pause
    if (slidesWrap) {
      slidesWrap.addEventListener('mouseenter', () => { isPaused = true; });
      slidesWrap.addEventListener('mouseleave', () => { isPaused = false; });
    }

    // touch swipe
    (function addTouch() {
      if (!slidesWrap) return;
      let startX = 0, startTime = 0;
      slidesWrap.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startTime = Date.now();
        isPaused = true;
      }, { passive: true });
      slidesWrap.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dt = Date.now() - startTime;
        if (Math.abs(dx) > 40 && dt < 1000) {
          if (dx < 0) next(); else prev();
        }
        isPaused = false;
      });
    })();

    // keyboard left/right
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { prev(); startAuto(); }
      if (e.key === 'ArrowRight') { next(); startAuto(); }
    });

    // init
    setActive(current);
    startAuto();

    // ---- Accessible accordion (single-open per group) ----
    const accordions = document.querySelectorAll('.accordion');
    accordions.forEach((ac) => {
      const items = ac.querySelectorAll('.accordion-item');
      items.forEach((item, idx) => {
        const btn = item.querySelector('.accordion-btn');
        const panel = item.querySelector('.accordion-panel');

        // ensure ARIA
        const panelId = `panel-${Math.random().toString(36).slice(2,9)}`;
        panel.id = panelId;
        btn.setAttribute('aria-controls', panelId);
        btn.setAttribute('aria-expanded', 'false');

        btn.addEventListener('click', () => {
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          // close all in this accordion
          items.forEach(it => {
            const b = it.querySelector('.accordion-btn');
            const p = it.querySelector('.accordion-panel');
            b.setAttribute('aria-expanded', 'false');
            p.hidden = true;
          });
          if (!expanded) {
            btn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });

        // keyboard
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
          // arrow navigation among accordion buttons
          if (e.key === 'ArrowDown') { e.preventDefault(); const nextBtn = items[(idx+1)%items.length].querySelector('.accordion-btn'); nextBtn.focus(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); const prevBtn = items[(idx-1+items.length)%items.length].querySelector('.accordion-btn'); prevBtn.focus(); }
        });
      });
    });

    // ---- Form validation (client-side) ----
    const form = document.getElementById('contact-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        // let browser handle required, but add stronger checks
        const tel = form.querySelector('input[name="tel"]') || form.querySelector('input[name="tel"]') ;
        const email = form.querySelector('input[type="email"]');
        // phone basic check
        if (tel && tel.value && !/^[\d\-\s]+$/.test(tel.value)) {
          e.preventDefault();
          alert('電話番号の形式が正しくありません。半角数字とハイフンで入力してください。');
          tel.focus();
          return false;
        }
        if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
          e.preventDefault();
          alert('メールアドレスの形式が正しくありません。');
          email.focus();
          return false;
        }
        // confirmation flow: show confirm dialog before submit
        const ok = confirm('送信してよろしいですか？内容を確認のうえ「OK」を押してください。');
        if (!ok) { e.preventDefault(); return false; }
        // allow submission (Formspree will process)
      });
    }

    // ---- reduce work on idle: stop timers when page hidden ----
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    // ---- accessibility: ensure focus styles visible when tabbing only ----
    (function focusVisiblePolyfill() {
      let mouseDown = false;
      document.addEventListener('mousedown', () => mouseDown = true);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') mouseDown = false;
      });
      document.addEventListener('focusin', (e) => {
        if (!mouseDown && e.target) e.target.classList.add('focus-visible');
      });
      document.addEventListener('focusout', (e) => {
        if (e.target) e.target.classList.remove('focus-visible');
      });
    })();

  }); // DOMContentLoaded end
})();
