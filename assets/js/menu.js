/* Menu
/* Popover API は top layer に出て Portal のダイアログを前に出せないので、hidden 属性で開閉する */
(function () {
    const menu = document.getElementById('voyage-menu');
    const openButton = document.querySelector('[data-menu-open]');
    if (!menu || !openButton) {
        return;
    }

    function open() {
        menu.hidden = false;
        openButton.setAttribute('aria-expanded', 'true');
        menu.querySelector('[data-menu-close]').focus();
    }

    function close() {
        menu.hidden = true;
        openButton.setAttribute('aria-expanded', 'false');
        openButton.focus();
    }

    openButton.addEventListener('click', open);
    menu.querySelector('[data-menu-close]').addEventListener('click', close);

    document.addEventListener('keydown', function (event) {
        // Portal のダイアログを開いているときの Esc はダイアログを閉じる操作なので、メニューは残す
        if (event.key === 'Escape' && !menu.hidden && document.activeElement && menu.contains(document.activeElement)) {
            close();
        }
    });
})();
