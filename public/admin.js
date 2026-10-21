
document.addEventListener("DOMContentLoaded", async () => {
  const loginGate = document.getElementById("adminLogin");
  const loginForm = document.getElementById("adminLoginForm");
  const loginError = document.getElementById("loginError");
  const adminShell = document.getElementById("adminShell");
  const logoutButton = document.getElementById("adminLogout");
  const toast = document.getElementById("toast");

  const navButtons = document.querySelectorAll("[data-section]");
  const contentSections = document.querySelectorAll(".content-section");

  const titles = {
    overview: "Overview",
    gallery: "Gallery Manager",
    memories: "Memory Manager",
    playlist: "Playlist Manager",
    letter: "Birthday Letter"
  };

  let toastTimeout;
  let photoPreviewUrl = null;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  async function api(url, options = {}) {
    const isFormData = options.body instanceof FormData;

    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body && !isFormData
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }

  function openSection(name) {
    const selected = titles[name] ? name : "overview";

    contentSections.forEach((section) => {
      section.classList.toggle(
        "active",
        section.id === `${selected}Section`
      );
    });

    navButtons.forEach((button) => {
      const active = button.dataset.section === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    document.getElementById("pageTitle").textContent = titles[selected];

    document.getElementById("sectionHeading").textContent =
      selected === "overview"
        ? "Your website content"
        : titles[selected];

    document.getElementById("overviewStats").hidden =
      selected !== "overview";
  }

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openSection(button.dataset.section);
    });
  });

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      openSection(button.dataset.open);
    });
  });

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  function renderItems(items, containerId, type, onDelete) {
    const container = document.getElementById(containerId);
    container.replaceChildren();

    if (!items.length) {
      container.appendChild(
        makeElement(
          "div",
          "empty-state",
          "Nothing here yet. Add your first item above ♡"
        )
      );
      return;
    }

    items.forEach((item) => {
      const row = makeElement("article", "managed-item");
      const details = makeElement("div");
      const heading = makeElement("h4", "", item.title);
      const description = makeElement("p");

      if (type === "gallery") {
        description.textContent =
          `${item.category || "Moments"} · ${item.image_url}`;

        const image = makeElement("img");
        image.src = item.image_url;
        image.alt = item.title || "Gallery photo";
        image.loading = "lazy";
        image.style.width = "84px";
        image.style.height = "84px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "12px";
        image.style.marginBottom = "8px";

        image.addEventListener("error", () => {
          image.alt = "Image could not be loaded";
        });

        details.appendChild(image);
      } else if (type === "memory") {
        description.textContent =
          `${String(item.memory_date).slice(0, 10)} · ${item.description}`;
      } else {
        description.textContent = item.spotify_url;
      }

      details.append(heading, description);

      const remove = makeElement("button", "delete-button", "Remove");
      remove.type = "button";

      remove.addEventListener("click", async () => {
        if (!confirm(`Remove "${item.title}"?`)) return;

        remove.disabled = true;

        try {
          await onDelete(item.id);
          await loadAllContent();
          showToast("Item removed from the database.");
        } catch (error) {
          showToast(error.message);
          remove.disabled = false;
        }
      });

      row.append(details, remove);
      container.appendChild(row);
    });
  }

  async function loadAllContent() {
    const [gallery, memories, tracks, letter] = await Promise.all([
      api("/api/gallery"),
      api("/api/memories"),
      api("/api/playlist"),
      api("/api/letter")
    ]);

    document.getElementById("galleryCount").textContent = gallery.length;
    document.getElementById("memoryCount").textContent = memories.length;
    document.getElementById("trackCount").textContent = tracks.length;

    renderItems(gallery, "galleryList", "gallery", (id) =>
      api(`/api/gallery/${id}`, { method: "DELETE" })
    );

    renderItems(memories, "memoryList", "memory", (id) =>
      api(`/api/memories/${id}`, { method: "DELETE" })
    );

    renderItems(tracks, "trackList", "track", (id) =>
      api(`/api/playlist/${id}`, { method: "DELETE" })
    );

    document.getElementById("letterTitle").value = letter?.title || "";
    document.getElementById("letterContent").value = letter?.content || "";
  }

  function showDashboard() {
    loginGate.hidden = true;
    adminShell.hidden = false;
  }

  function showLogin() {
    adminShell.hidden = true;
    loginGate.hidden = false;
  }

  // ADMIN LOGIN
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";

    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;

    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      document.getElementById("adminPassword").value = "";

      showDashboard();
      await loadAllContent();
      showToast("Welcome to Admin Studio ♡");
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  // ADMIN LOGOUT
  logoutButton.addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
      showLogin();
      showToast("You have logged out.");
    } catch (error) {
      showToast(error.message);
    }
  });

  // PHOTO PICKER AND PREVIEW
  const photoFileInput = document.getElementById("photoFile");
  const photoPreviewWrap = document.getElementById("photoPreviewWrap");
  const photoPreview = document.getElementById("photoPreview");
  const clearPhotoButton = document.getElementById("clearPhoto");

  function clearSelectedPhoto() {
    photoFileInput.value = "";

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
      photoPreviewUrl = null;
    }

    photoPreview.removeAttribute("src");
    photoPreviewWrap.hidden = true;
  }

  photoFileInput.addEventListener("change", () => {
    const file = photoFileInput.files?.[0];

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
      photoPreviewUrl = null;
    }

    photoPreviewWrap.hidden = true;

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast("Choose a JPG, PNG or WebP image.");
      clearSelectedPhoto();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be 5 MB or smaller.");
      clearSelectedPhoto();
      return;
    }

    photoPreviewUrl = URL.createObjectURL(file);
    photoPreview.src = photoPreviewUrl;
    photoPreviewWrap.hidden = false;
  });

  clearPhotoButton.addEventListener("click", clearSelectedPhoto);

  // GALLERY PHOTO UPLOAD
  const galleryForm = document.getElementById("galleryForm");

  galleryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const title = document.getElementById("photoTitle").value.trim();
    const category = document.getElementById("photoCategory").value;
    const file = photoFileInput.files?.[0];

    if (!file) {
      showToast("Please choose a photo first.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("photo", file);

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      await api("/api/gallery/upload", {
        method: "POST",
        body: formData
      });

      form.reset();
      clearSelectedPhoto();

      await loadAllContent();
      showToast("Photo uploaded and saved to MySQL ♡");
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  // ADD GALLERY IMAGE USING URL
  const galleryUrlForm = document.getElementById("galleryUrlForm");

  if (galleryUrlForm) {
    galleryUrlForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const title = document.getElementById("photoUrlTitle").value.trim();
      const image_url = document.getElementById("photoUrl").value.trim();
      const category = document.getElementById("photoUrlCategory").value;
      const submitButton = form.querySelector('button[type="submit"]');

      try {
        const url = new URL(image_url);

        if (url.protocol !== "https:") {
          throw new Error("Please use a public HTTPS image URL.");
        }

        submitButton.disabled = true;

        await api("/api/gallery", {
          method: "POST",
          body: JSON.stringify({ title, image_url, category })
        });

        form.reset();
        await loadAllContent();
        showToast("Image link saved to MySQL ♡");
      } catch (error) {
        showToast(error.message || "Could not save this image link.");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  // ADD MEMORY
  document.getElementById("memoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const title = document.getElementById("memoryTitle").value.trim();
    const memory_date = document.getElementById("memoryDate").value;
    const description =
      document.getElementById("memoryDescription").value.trim();

    try {
      await api("/api/memories", {
        method: "POST",
        body: JSON.stringify({ title, memory_date, description })
      });

      form.reset();
      await loadAllContent();
      showToast("Memory saved to MySQL ♡");
    } catch (error) {
      showToast(error.message);
    }
  });

  
  // ADD SPOTIFY TRACK
  const trackForm = document.getElementById("trackForm");
  const trackUrlInput = document.getElementById("trackUrl");
  const trackMoodInput = document.getElementById("trackMood");

  trackForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const spotify_url = trackUrlInput.value.trim();
    const mood = trackMoodInput.value;
    const submitButton = trackForm.querySelector('button[type="submit"]');

    try {
      const url = new URL(spotify_url);

      if (
        url.protocol !== "https:" ||
        !["open.spotify.com", "www.open.spotify.com"].includes(url.hostname) ||
        !url.pathname.startsWith("/track/")
      ) {
        throw new Error("Please paste an official Spotify track link.");
      }

      submitButton.disabled = true;

      await api("/api/playlist", {
        method: "POST",
        body: JSON.stringify({
          spotify_url,
          mood
        })
      });

      trackForm.reset();
      await loadAllContent();
      showToast("Song and mood saved to MySQL ♡");
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });


  // SAVE BIRTHDAY LETTER
  document.getElementById("letterForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = document.getElementById("letterTitle").value.trim();
    const content = document.getElementById("letterContent").value.trim();

    try {
      await api("/api/letter", {
        method: "PUT",
        body: JSON.stringify({ title, content })
      });

      showToast("Birthday letter saved to MySQL ♡");
    } catch (error) {
      showToast(error.message);
    }
  });

  // INITIAL SESSION CHECK
  try {
    const status = await api("/api/admin/status");

    if (status.loggedIn) {
      showDashboard();
      await loadAllContent();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    loginError.textContent =
      "Couldn't connect to the server. Make sure npm start is running.";
  }

  openSection("overview");
});
