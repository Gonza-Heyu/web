/*    
     	1. Promo bar
     	2. Hamburger / drawer toggle
     	3. Navbar Shadow en scroll + Hero Gradient
     	4. Cierra drawer
     	5. Activa nav section en scroll
     	6. Animaciones en scroll 
     	7. Validar Formulario y simular envío
*/

document.addEventListener('DOMContentLoaded', () => {

  /* Promo bar */
  const promoBar   = document.getElementById('promo-bar');
  const promoClose = document.getElementById('promo-close');

  if (promoBar && promoClose) {
    if (sessionStorage.getItem('promo-dismissed') === '1') {
      promoBar.classList.add('hidden');
    }

    promoClose.addEventListener('click', () => {
      promoBar.classList.add('hidden');
      sessionStorage.setItem('promo-dismissed', '1');
    });
  }


  /* Hamburger / drawer toggle */
  const menuToggle     = document.getElementById('menu-toggle');
  const mobileDrawer   = document.getElementById('mobile-nav-drawer');

  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }


  /* Navbar Shadow en scroll */
  const siteHeader = document.querySelector('.site-header');

  if (siteHeader) {
    const onScroll = () => {
      siteHeader.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }


  /* Hero Gradient */
  const heroSection  = document.querySelector('.hero-section');
  const heroLogoEl   = document.querySelector('.hero-logo-display');

  if (heroSection && heroLogoEl) {
    const updateGradient = () => {
      const heroRect = heroSection.getBoundingClientRect();
      const logoRect = heroLogoEl.getBoundingClientRect();
      const x = ((logoRect.left + logoRect.width  / 2 - heroRect.left) / heroRect.width)  * 100;
      const y = ((logoRect.top  + logoRect.height / 2 - heroRect.top)  / heroRect.height) * 100;
      heroSection.style.setProperty('--grad-x', `${x.toFixed(1)}%`);
      heroSection.style.setProperty('--grad-y', `${y.toFixed(1)}%`);
    };

    updateGradient();
    window.addEventListener('resize', updateGradient, { passive: true });
  }


  /* Cierra drawer */
  const allNavLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

  allNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileDrawer && mobileDrawer.classList.contains('open')) {
        mobileDrawer.classList.remove('open');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });


  /* Activa nav section en scroll  */
  const sections  = document.querySelectorAll('main section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  if (sections.length && navLinks.length) {
    const activateLink = (id) => {
      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        const matches = href === `#${id}` || href.endsWith(`#${id}`);
        link.classList.toggle('active', matches);
      });
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) activateLink(entry.target.id);
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(section => sectionObserver.observe(section));
  }


  /* Animaciones en scroll */
  const revealElements = document.querySelectorAll('.reveal-on-scroll');

  if (revealElements.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealElements.forEach(el => revealObserver.observe(el));
  }


  /* Validar Formulario y simular envío */
  const contactForm    = document.getElementById('contact-form');
  const formSuccess    = document.getElementById('form-success');
  const formReset      = document.getElementById('form-reset');

  if (contactForm && formSuccess) {

    const validateField = (input) => {
      const group = input.closest('.form-group');
      if (!group) return true;

      let valid = true;

      if (input.required && !input.value.trim()) {
        valid = false;
      } else if (input.type === 'email' && input.value.trim()) {
        valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      }

      group.classList.toggle('has-error', !valid);
      return valid;
    };

    contactForm.querySelectorAll('.form-input, .form-textarea').forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        if (input.closest('.form-group').classList.contains('has-error')) {
          validateField(input);
        }
      });
    });

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const inputs = contactForm.querySelectorAll('.form-input, .form-textarea');
      let allValid = true;

      inputs.forEach(input => {
        if (!validateField(input)) allValid = false;
      });

      if (!allValid) {
        const firstError = contactForm.querySelector('.form-group.has-error .form-input, .form-group.has-error .form-textarea');
        if (firstError) firstError.focus();
        return;
      }

      const submitBtn = contactForm.querySelector('.form-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     contactForm.querySelector('#form-name').value.trim(),
            email:    contactForm.querySelector('#form-email').value.trim(),
            phone:    contactForm.querySelector('#form-phone').value.trim(),
            business: contactForm.querySelector('#form-business').value.trim(),
            message:  contactForm.querySelector('#form-message').value.trim(),
          })
        });

        if (!res.ok) throw new Error('Server error');

        contactForm.hidden = true;
        formSuccess.hidden = false;
        formSuccess.focus();

      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar consulta';
        alert('Hubo un error al enviar el mensaje. Por favor intentá de nuevo.');
      }
    });

    if (formReset) {
      formReset.addEventListener('click', () => {
        contactForm.reset();
        contactForm.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
        contactForm.hidden = false;
        formSuccess.hidden = true;
        contactForm.querySelector('.form-input')?.focus();
      });
    }
  }

});


/* Lightbox & Video Modal */

document.addEventListener('DOMContentLoaded', () => {

  /* LIGHTBOX */
  const galleryFigures   = document.querySelectorAll('.gallery-figure');
  const lightboxModal    = document.getElementById('lightbox-modal');
  const lightboxImage    = document.getElementById('lightbox-image');
  const lightboxTitle    = document.getElementById('lightbox-title');
  const lightboxDesc     = document.getElementById('lightbox-desc');
  const lightboxCounter  = document.getElementById('lightbox-counter');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const lightboxPrevBtn  = document.getElementById('lightbox-prev-btn');
  const lightboxNextBtn  = document.getElementById('lightbox-next-btn');

  if (!lightboxModal || !galleryFigures.length) return;

  let currentIndex = 0;
  const galleryItems = [];

  galleryFigures.forEach((fig, i) => {
    const img    = fig.querySelector('img');
    const title  = fig.querySelector('.figcaption-title');
    const desc   = fig.querySelector('.figcaption-desc');

    galleryItems.push({
      src:   img?.src   || '',
      alt:   img?.alt   || '',
      title: title?.textContent || `Captura ${i + 1}`,
      desc:  desc?.textContent  || ''
    });

    fig.setAttribute('tabindex', '0');
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', `Ampliar: ${title?.textContent || ''}`);

    fig.addEventListener('click',   () => openLightbox(i));
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); }
    });
  });

  const updateLightbox = () => {
    const item = galleryItems[currentIndex];
    if (lightboxImage)  { lightboxImage.src = item.src; lightboxImage.alt = item.alt; }
    if (lightboxTitle)  lightboxTitle.textContent  = item.title;
    if (lightboxDesc)   lightboxDesc.textContent   = item.desc;
    if (lightboxCounter) lightboxCounter.textContent = `${currentIndex + 1} de ${galleryItems.length}`;
  };

  const openLightbox = (i) => {
    currentIndex = (i + galleryItems.length) % galleryItems.length;
    updateLightbox();
    lightboxModal.classList.add('active');
    lightboxModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightboxCloseBtn?.focus();
  };

  const closeLightbox = () => {
    lightboxModal.classList.remove('active');
    lightboxModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  lightboxCloseBtn?.addEventListener('click', closeLightbox);
  lightboxPrevBtn?.addEventListener('click',  () => { currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length; updateLightbox(); });
  lightboxNextBtn?.addEventListener('click',  () => { currentIndex = (currentIndex + 1) % galleryItems.length; updateLightbox(); });

  lightboxModal.addEventListener('click', (e) => { if (e.target === lightboxModal) closeLightbox(); });

  document.addEventListener('keydown', (e) => {
    if (!lightboxModal.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % galleryItems.length; updateLightbox(); }
    if (e.key === 'ArrowLeft')  { currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length; updateLightbox(); }
  });


  /* VIDEO MODAL */
  const videoStage     = document.querySelector('.video-interactive-stage');
  const videoModal     = document.getElementById('video-modal');
  const videoClose     = document.getElementById('video-modal-close');
  const videoModalCta  = document.getElementById('video-modal-cta');

  if (videoStage && videoModal) {
    const openVideo  = () => { videoModal.classList.add('active');    document.body.style.overflow = 'hidden'; videoClose?.focus(); };
    const closeVideo = () => { videoModal.classList.remove('active'); document.body.style.overflow = ''; };

    videoStage.addEventListener('click',   openVideo);
    videoStage.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVideo(); }});
    videoClose?.addEventListener('click',  closeVideo);
    videoModal.addEventListener('click',   (e) => { if (e.target === videoModal) closeVideo(); });
    videoModalCta?.addEventListener('click', closeVideo);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && videoModal.classList.contains('active')) closeVideo();
    });
  }

});
