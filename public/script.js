
/* ========================================
   SUHANA BIRTHDAY WEBSITE
   PAGE: LANDING SCREEN
   FILE: index.js
======================================== */

document.addEventListener("DOMContentLoaded", () => {

    // Find the Enter button
    const enterButton = document.getElementById("enterButton");

    // Check that the button exists
    if (!enterButton) {
        console.error("Enter button was not found.");
        return;
    }

    // Open the home page when clicked
    enterButton.addEventListener("click", () => {

        // Prevent repeated clicks
        if (enterButton.disabled) return;

        enterButton.disabled = true;
        enterButton.classList.add("is-entering");

        // Change button text
        const buttonText = enterButton.querySelector("span:first-child");
        const originalText = buttonText.textContent;

        buttonText.textContent = "Opening your world...";

        // Small delay for the click animation
        window.setTimeout(() => {
            window.location.href = "home.html";
        }, 450);

        // Restore the button if navigation fails
        window.setTimeout(() => {
            enterButton.disabled = false;
            enterButton.classList.remove("is-entering");
            buttonText.textContent = originalText;
        }, 3000);

    });

});
