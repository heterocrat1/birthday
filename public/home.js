
document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.getElementById("menuButton");
    const navigation = document.getElementById("navigation");

    if (menuButton && navigation) {
        menuButton.addEventListener("click", () => {
            const isOpen = navigation.classList.toggle("open");

            menuButton.setAttribute("aria-expanded", String(isOpen));
            menuButton.setAttribute(
                "aria-label",
                isOpen ? "Close navigation" : "Open navigation"
            );
            menuButton.textContent = isOpen ? "×" : "☰";
        });
    }
});
