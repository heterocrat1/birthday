
document.addEventListener("DOMContentLoaded", () => {
    const readButton = document.getElementById("readButton");
    const readMessage = document.getElementById("readMessage");

    if (!readButton) return;

    // Browser ko previous scroll position restore karne se roko
    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }

    readButton.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth"
        });

        if (readMessage) {
            readMessage.textContent = "Let's read it again, from the beginning. ♡";
        }
    });
});
