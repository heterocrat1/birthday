
document.addEventListener("DOMContentLoaded", () => {
  // Avoid inserting the menu twice.
  if (document.querySelector(".site-menu")) return;

  const pages = [
    { label: "Welcome", file: "index.html", icon: "✨" },
    { label: "Home", file: "home.html", icon: "🏡" },
    { label: "A Letter", file: "letter.html", icon: "💌" },
    { label: "Memories", file: "memories.html", icon: "🕰️" },
    { label: "Gallery", file: "gallery.html", icon: "📸" },
    { label: "Our Playlist", file: "playlist.html", icon: "🎧" },
    { label: "Your Space", file: "journal.html", icon: "🌷" },
  ];

  const currentFile =
    window.location.pathname.split("/").pop().toLowerCase() ||
    "index.html";

  const menu = document.createElement("div");
  menu.className = "site-menu";

  const button = document.createElement("button");
  button.className = "site-menu-button";
  button.type = "button";
  button.setAttribute("aria-label", "Open website navigation");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "siteMenuPanel");

  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor"
         aria-hidden="true">
      <circle cx="12" cy="5" r="1.8"></circle>
      <circle cx="12" cy="12" r="1.8"></circle>
      <circle cx="12" cy="19" r="1.8"></circle>
    </svg>
  `;

  const panel = document.createElement("nav");
  panel.className = "site-menu-panel";
  panel.id = "siteMenuPanel";
  panel.setAttribute("aria-label", "Explore the website");
  panel.setAttribute("inert", "");

  const heading = document.createElement("div");
  heading.className = "site-menu-heading";
  heading.innerHTML = `
    <span>YOUR LITTLE WORLD</span>
    <strong>Explore ♡</strong>
  `;

  const links = document.createElement("div");
  links.className = "site-menu-links";

  pages.forEach((page) => {
    const link = document.createElement("a");
    link.className = "site-menu-link";
    link.href = page.file;

    const icon = document.createElement("span");
    icon.className = "site-menu-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = page.icon;

    const label = document.createElement("span");
    label.textContent = page.label;

    link.append(icon, label);

    if (currentFile === page.file) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }

    links.appendChild(link);
  });

  const footer = document.createElement("div");
  footer.className = "site-menu-footer";
  footer.textContent = "a little world, made with care ♡";

  panel.append(heading, links, footer);
  menu.append(button, panel);
  document.body.appendChild(menu);

  function setMenuOpen(open) {
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute(
      "aria-label",
      open ? "Close website navigation" : "Open website navigation"
    );

    if (open) {
      panel.removeAttribute("inert");
    } else {
      panel.setAttribute("inert", "");
    }
  }

  button.addEventListener("click", () => {
    setMenuOpen(!menu.classList.contains("is-open"));
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      button.focus();
    }
  });
});
