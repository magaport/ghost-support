/**
 * Hamburger menu toggle.
 * The expanded design has not been delivered yet, so this only opens and
 * closes a plain navigation overlay.
 */
(function () {
    const toggle = document.querySelector('.raiden-burger');
    const menu = document.querySelector('.raiden-menu');
    const close = document.querySelector('.raiden-menu-close');

    if (!toggle || !menu) {
        return;
    }

    function setOpen(isOpen) {
        menu.classList.toggle('is-open', isOpen);
        menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    toggle.addEventListener('click', function () {
        setOpen(!menu.classList.contains('is-open'));
    });

    if (close) {
        close.addEventListener('click', function () {
            setOpen(false);
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.classList.contains('is-open')) {
            setOpen(false);
        }
    });
})();
