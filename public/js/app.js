function initializeApp() {
    renderPlaylistUI();
    initThree();
    applyTheme(currentTheme, true);
    applyThemeMode(isLightMode);
    initUIEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
