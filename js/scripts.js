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

    const revealObserver = new IntersectionObserver(function(entries, observer) {
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

});
