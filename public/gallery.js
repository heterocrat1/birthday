
document.addEventListener("DOMContentLoaded", async () => {
  const galleryGrid = document.querySelector(".gallery-grid");
  const filters = [...document.querySelectorAll(".filter-button")];

  const lightbox = document.getElementById("lightbox");
  const closeButton = document.getElementById("closeLightbox");
  const previousButton = document.getElementById("previousPhoto");
  const nextButton = document.getElementById("nextPhoto");
  const imageWrap = document.getElementById("lightboxImageWrap");
  const caption = document.getElementById("lightboxCaption");
  const counter = document.getElementById("lightboxCounter");

  let items = [];
  let visibleItems = [];
  let currentIndex = 0;
  let lastFocusedElement = null;

  function showMessage(message) {
    const existing = document.getElementById("galleryStatus");
    const status = existing || document.createElement("p");
    status.id = "galleryStatus";
    status.setAttribute("role", "status");
    status.textContent = message;

    if (!existing) {
      galleryGrid?.parentElement?.prepend(status);
    }
  }

  function filterGallery(category) {
    visibleItems = items.filter(item =>
      category === "all" || item.dataset.category === category
    );

    items.forEach(item => {
      item.hidden = !visibleItems.includes(item);
    });

    filters.forEach(button => {
      const active = button.dataset.filter === category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function showPhoto(index) {
    if (!visibleItems.length) return;

    currentIndex = (index + visibleItems.length) % visibleItems.length;

    const item = visibleItems[currentIndex];
    const source = item.dataset.image.trim();

    imageWrap.replaceChildren();

    if (source) {
      const image = document.createElement("img");
      image.src = source;
      image.alt = item.dataset.caption || "Gallery memory";
      imageWrap.appendChild(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "lightbox-placeholder";
      placeholder.textContent = "♡";
      imageWrap.appendChild(placeholder);
    }

    caption.textContent = item.dataset.caption || "A little memory ♡";
    counter.textContent = `${currentIndex + 1} / ${visibleItems.length}`;
  }

  function openLightbox(item) {
    lastFocusedElement = document.activeElement;
    currentIndex = visibleItems.indexOf(item);

    showPhoto(currentIndex);
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    closeButton.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    lastFocusedElement?.focus();
  }

  function createGalleryItem(photo) {
    const item = document.createElement("article");
    item.className = "gallery-item";

    // Preserve the existing filter buttons' category values.
    item.dataset.category = photo.category || "Moments";
    item.dataset.image = photo.image_url || "";
    item.dataset.caption = photo.title || "A little memory ♡";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Open ${photo.title || "gallery photo"}`);

    const source = photo.image_url || "";
    const image = document.createElement("img");
    image.src = source;
    image.alt = photo.title || "Gallery memory";
    image.loading = "lazy";

    image.addEventListener("error", () => {
      image.hidden = true;
      item.classList.add("image-unavailable");
    });

    const captionElement = document.createElement("p");
    captionElement.className = "gallery-caption";
    captionElement.textContent = photo.title || "A little memory ♡";

    item.append(image, captionElement);

    item.addEventListener("click", () => openLightbox(item));
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(item);
      }
    });

    return item;
  }

  filters.forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.classList.contains("active"))
    );

    button.addEventListener("click", () => {
      filterGallery(button.dataset.filter);
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  previousButton.addEventListener("click", () => showPhoto(currentIndex - 1));
  nextButton.addEventListener("click", () => showPhoto(currentIndex + 1));

  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", event => {
    if (lightbox.hidden) return;

    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showPhoto(currentIndex - 1);
    if (event.key === "ArrowRight") showPhoto(currentIndex + 1);
  });

  if (!galleryGrid) {
    showMessage("Gallery grid not found. Check your gallery HTML.");
    return;
  }

  showMessage("Loading memories…");

  try {
    const response = await fetch("/api/gallery");

    if (!response.ok) {
      throw new Error("Unable to load gallery.");
    }

    const photos = await response.json();

    galleryGrid.replaceChildren();
    items = photos.map(createGalleryItem);

    items.forEach(item => galleryGrid.appendChild(item));

    if (!photos.length) {
      showMessage("No memories added yet. Your little gallery will grow here ♡");
    } else {
      document.getElementById("galleryStatus")?.remove();
    }

    filterGallery("all");
  } catch (error) {
    console.error("Gallery loading error:", error);
    showMessage("Couldn't load memories. Please refresh and try again.");
  }
});
