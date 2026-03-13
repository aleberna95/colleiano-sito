/**
 * Sito Colleiano - Main JavaScript
 * Handles smooth scrolling, nav mutation, reveal animations, and mobile menu.
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ============================================================
       1. NAV MUTATION ON SCROLL
       ============================================================ */
    const header = document.getElementById('site-header');

    // We already moved the scroll logic from index.html to here for better modularity
    const handleNavScroll = () => {
        if (!header) return;

        if (window.scrollY > 50) {
            header.style.backgroundColor = 'var(--glass-bg-dark)';
            header.style.borderBottom = '1px solid var(--glass-border)';
            header.style.boxShadow = '0 1px 20px -8px rgba(0, 0, 0, 0.30)';
            header.style.backdropFilter = 'var(--glass-blur)';
            header.classList.add('is-scrolled');
        } else {
            header.style.backgroundColor = 'transparent';
            header.style.borderBottom = 'none';
            header.style.boxShadow = 'none';
            header.style.backdropFilter = 'none';
            header.classList.remove('is-scrolled');
        }
    };

    window.addEventListener('scroll', handleNavScroll, { passive: true });
    // Initialize state on load
    handleNavScroll();


    /* ============================================================
       2. SMOOTH SCROLLING FOR ANCHOR LINKS
       ============================================================ */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return; // Ignore empty hashes

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                // Offset for fixed header height
                const headerOffset = 72;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });


    /* ============================================================
       3. INTERSECTION OBSERVER - REVEAL ANIMATIONS
       ============================================================ */
    // Select elements to animate
    const revealElements = document.querySelectorAll('.card, .section h2, .section p, .divider, .card__media');

    // Initial state: hidden and translated slightly down
    revealElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity var(--duration-xslow) var(--ease-standard), transform var(--duration-xslow) var(--ease-standard)';
    });

    const revealOptions = {
        threshold: 0.15, // Trigger when 15% of element is visible
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            } else {
                // Remove inline styles to allow CSS to take over, or explicitly set to visible
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                // Stop observing once revealed
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });


    /* ============================================================
       4. MOBILE MENU (OFF-CANVAS)
       ============================================================ */
    const mobileMenuBtn = document.querySelector('button[aria-label="Apri menu"]');

    // Create the mobile menu DOM structure injecting it dynamically
    if (mobileMenuBtn) {
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'fixed inset-0 z-[100] bg-colleiano-forest/95 backdrop-blur-md flex flex-col items-center justify-center transition-opacity duration-500 opacity-0 pointer-events-none hidden';

        mobileMenu.innerHTML = `
            <button class="absolute top-6 right-6 p-2 text-colleiano-linen/80 hover:text-white transition-colors" aria-label="Chiudi menu">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <nav class="text-center w-full px-8">
                <ul class="space-y-8">
                    <li style="transform: translateY(20px); opacity: 0; transition: all 0.4s ease 0.1s;"><a href="#" class="mobile-link text-3xl font-serif text-colleiano-linen hover:text-colleiano-rust transition-colors block">Home</a></li>
                    <li style="transform: translateY(20px); opacity: 0; transition: all 0.4s ease 0.2s;"><a href="#programma" class="mobile-link text-3xl font-serif text-colleiano-linen hover:text-colleiano-rust transition-colors block">Programma</a></li>
                    <li style="transform: translateY(20px); opacity: 0; transition: all 0.4s ease 0.3s;"><a href="https://paypal.me/sitocolleiano" target="_blank" rel="noopener noreferrer" class="mobile-link text-3xl font-serif text-colleiano-rust hover:text-white transition-colors block">Sostienici Ora</a></li>
                </ul>
            </nav>
            <div class="absolute bottom-10 flex gap-6 text-colleiano-linen/50">
                <a href="#" class="hover:text-colleiano-linen transition-colors">IG</a>
                <a href="#" class="hover:text-colleiano-linen transition-colors">FB</a>
            </div>
        `;

        document.body.appendChild(mobileMenu);
        const closeBtn = mobileMenu.querySelector('button[aria-label="Chiudi menu"]');
        const links = mobileMenu.querySelectorAll('li');
        const anchorLinks = mobileMenu.querySelectorAll('.mobile-link');

        const toggleMenu = (isOpen) => {
            if (isOpen) {
                // Open
                document.body.style.overflow = 'hidden';
                mobileMenu.classList.remove('hidden');
                // Small delay to allow display:block to take effect before opacity animates
                setTimeout(() => {
                    mobileMenu.classList.remove('opacity-0', 'pointer-events-none');
                    links.forEach(link => {
                        link.style.transform = 'translateY(0)';
                        link.style.opacity = '1';
                    });
                }, 10);
            } else {
                // Close
                document.body.style.overflow = '';
                mobileMenu.classList.add('opacity-0', 'pointer-events-none');
                links.forEach(link => {
                    link.style.transform = 'translateY(20px)';
                    link.style.opacity = '0';
                });
                // Wait for fade out to hide element
                setTimeout(() => {
                    mobileMenu.classList.add('hidden');
                }, 500); // matches duration-500
            }
        };

        mobileMenuBtn.addEventListener('click', () => toggleMenu(true));
        closeBtn.addEventListener('click', () => toggleMenu(false));

        // Close menu when a link is clicked
        anchorLinks.forEach(link => {
            link.addEventListener('click', () => {
                toggleMenu(false);
            });
        });
    }

    /* ============================================================
       5. HERO CAROUSEL
       ============================================================ */
    const heroCarouselContainer = document.getElementById('hero-carousel');
    const heroPaginationContainer = document.getElementById('hero-pagination');

    if (heroCarouselContainer && heroPaginationContainer) {
        // PER L'UTENTE: Aggiungi qui i nomi dei file presenti in src/assets/carosello.
        // Purtroppo Javascript nel client non può leggere dinamicamente i file di 
        // una cartella senza un backend, quindi dovrai aggiornare questo array!
        const mediaFiles = [
            'drone_pt1.mp4',
            'drone_pt2.mp4'
            // Esempio foto: 'paesaggio.jpg'
        ];

        const mediaBasePath = 'src/assets/carosello/';
        const intervalTime = 6000; // Tempo display per le foto (6 secondi)
        const videoPlaybackRate = 0.7; // <-- VELOCITÀ VIDEO (1.0 = normale, 0.5 = metà velocità)

        let currentIndex = 0;
        let mediaElements = [];
        let dotElements = [];
        let carouselInterval;

        // Initialize Carousel
        mediaFiles.forEach((file, index) => {
            const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');

            // Create Media Element
            let mediaEl;
            if (isVideo) {
                mediaEl = document.createElement('video');
                // Aggiungiamo './' davanti per sicurezza per alcune configurazioni server
                mediaEl.src = './' + mediaBasePath + file;
                
                // Muted & Playsinline sono OBBLIGATORI come attributi su molti dispositivi mobile (iOS) per l'autoplay
                mediaEl.muted = true;
                mediaEl.defaultMuted = true;
                mediaEl.setAttribute('muted', '');
                
                mediaEl.playsInline = true;
                mediaEl.setAttribute('playsinline', '');
                
                mediaEl.loop = false; // Gestiamo il loop passando alla slide successiva
                
                mediaEl.defaultPlaybackRate = videoPlaybackRate;
                mediaEl.playbackRate = videoPlaybackRate;
                mediaEl.classList.add('absolute', 'inset-0', 'w-full', 'h-full', 'object-cover', 'transition-opacity', 'duration-1000', 'opacity-0');
                
                // Aiuta col debug
                mediaEl.addEventListener('error', (e) => {
                    console.error('Errore caricamento video online:', file, e);
                });

                // When video ends, go to next
                mediaEl.addEventListener('ended', () => {
                    nextSlide();
                });
            } else {
                mediaEl = document.createElement('img');
                mediaEl.src = './' + mediaBasePath + file;
                mediaEl.alt = 'Colleiano Hero Carousel media ' + (index + 1);
                mediaEl.classList.add('absolute', 'inset-0', 'w-full', 'h-full', 'object-cover', 'transition-opacity', 'duration-1000', 'opacity-0');
            }

            if (index === 0) {
                mediaEl.classList.remove('opacity-0');
                mediaEl.classList.add('opacity-100');
                mediaEl.style.zIndex = '1';
            } else {
                mediaEl.style.zIndex = '0';
            }

            mediaElements.push(mediaEl);
            heroCarouselContainer.appendChild(mediaEl);

            // Create Dot Element
            const dot = document.createElement('button');
            dot.classList.add('w-3', 'h-3', 'rounded-full', 'bg-colleiano-linen/50', 'transition-all', 'duration-300', 'hover:bg-colleiano-linen');
            dot.setAttribute('aria-label', `Vai al contenuto multimediale ${index + 1}`);

            if (index === 0) {
                dot.classList.remove('bg-colleiano-linen/50');
                dot.classList.add('bg-colleiano-linen', 'scale-125');
            }

            dot.addEventListener('click', () => {
                if (currentIndex !== index) {
                    goToSlide(index);
                }
            });

            dotElements.push(dot);
            heroPaginationContainer.appendChild(dot);
        });

        const updateCarouselDOM = (newIndex) => {
            const oldIndex = currentIndex;
            currentIndex = newIndex;

            // Fade out old
            mediaElements[oldIndex].classList.remove('opacity-100');
            mediaElements[oldIndex].classList.add('opacity-0');
            mediaElements[oldIndex].style.zIndex = '0';

            // Pause old video and rewind slightly after fade out
            if (mediaElements[oldIndex].tagName === 'VIDEO') {
                setTimeout(() => {
                    if (currentIndex !== oldIndex) { // double check we didn't go back
                        mediaElements[oldIndex].pause();
                        mediaElements[oldIndex].currentTime = 0;
                    }
                }, 1000); // 1s sync with css duration-1000
            }

            dotElements[oldIndex].classList.remove('bg-colleiano-linen', 'scale-125');
            dotElements[oldIndex].classList.add('bg-colleiano-linen/50');

            // Fade in new
            mediaElements[currentIndex].classList.remove('opacity-0');
            mediaElements[currentIndex].classList.add('opacity-100');
            mediaElements[currentIndex].style.zIndex = '1';

            dotElements[currentIndex].classList.remove('bg-colleiano-linen/50');
            dotElements[currentIndex].classList.add('bg-colleiano-linen', 'scale-125');

            if (mediaElements[currentIndex].tagName === 'VIDEO') {
                mediaElements[currentIndex].play().catch(e => console.log('Autoplay prevented:', e));
            }
        };

        const nextSlide = () => {
            let nextIndex = (currentIndex + 1) % mediaFiles.length;
            updateCarouselDOM(nextIndex);
            manageInterval();
        };

        const goToSlide = (index) => {
            updateCarouselDOM(index);
            manageInterval();
        };

        const manageInterval = () => {
            clearInterval(carouselInterval);
            if (mediaElements[currentIndex].tagName !== 'VIDEO') {
                // Solo per le foto serve il timer automatico, i video terminando chiamano nextSlide()
                carouselInterval = setInterval(nextSlide, intervalTime);
            }
        };

        // Start prima riproduzione/intervallo
        setTimeout(() => {
            if (mediaElements[currentIndex].tagName === 'VIDEO') {
                mediaElements[currentIndex].play().catch(e => console.log('Autoplay prevented:', e));
            } else {
                manageInterval();
            }
        }, 300); // Piccolo delay per sicurezza autoplay su certi browser
    }

});
