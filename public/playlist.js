
document.addEventListener("DOMContentLoaded", () => {
  const moodButtons = document.querySelectorAll("[data-mood]");
  const title = document.getElementById("playlistTitle");
  const kicker = document.getElementById("playlistKicker");
  const description = document.getElementById("playlistDescription");
  const songCount = document.getElementById("songCount");
  const songList = document.getElementById("songList");
  const nowPlayingTitle = document.getElementById("nowPlayingTitle");
  const nowPlayingArtist = document.getElementById("nowPlayingArtist");
  const frameWrap = document.getElementById("spotifyFrameWrap");
  const playerArt = document.getElementById("playerArt");
  const playerArtImage = document.getElementById("playerArtImage");

  const moodInfo = {
    miss: {
      title: "When you'll miss me",
      kicker: "YOUR SOFTER SIDE",
      description: "Some songs say the things we don't always know how to."
    },
    happy: {
      title: "When you're happy",
      kicker: "A LITTLE SUNSHINE",
      description: "For the smiles, the silly dances, and the good days."
    }
  };

  let activeMood = "miss";
  let tracks = [];

  function spotifyEmbedUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);

      if (
        url.protocol !== "https:" ||
        !["open.spotify.com", "www.open.spotify.com"].includes(url.hostname)
      ) {
        return null;
      }

      const match = url.pathname.match(
        /^\/track\/([A-Za-z0-9]+)\/?$/
      );

      if (!match) return null;

return `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator&autoplay=1&theme=0`;    } catch {
      return null;
    }
  }

  function updatePlayerArt(track) {
    if (playerArtImage && track.image_url) {
      playerArtImage.src = track.image_url;
      playerArtImage.hidden = false;
      playerArt.style.background = "none";
      return;
    }

    if (playerArtImage) {
      playerArtImage.removeAttribute("src");
      playerArtImage.hidden = true;
    }

    playerArt.style.background =
      "linear-gradient(145deg,#e7c0cb,#c2a9ca 54%,#e8b7a6)";
  }

  function chooseTrack(track, row) {
    document.querySelectorAll(".song-row").forEach((item) => {
      item.classList.remove("active");
    });

    if (row) row.classList.add("active");

    nowPlayingTitle.textContent = track.title || "Selected song";
    nowPlayingArtist.textContent =
      track.artist || "Picked with love ♡";

    updatePlayerArt(track);

    const embed = spotifyEmbedUrl(track.spotify_url || "");
    frameWrap.replaceChildren();

    if (!embed) {
      const note = document.createElement("div");
      note.className = "player-placeholder";
      note.textContent = "Please add a valid Spotify track link.";
      frameWrap.appendChild(note);
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = embed;
    iframe.width = "100%";
    iframe.height = "152";
    iframe.loading = "eager";
    iframe.allow =
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.title = `Spotify player: ${track.title || "selected song"}`;

    frameWrap.appendChild(iframe);

    // Bring the player into view after the user selects a song.
    frameWrap.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function renderSongs() {
    const filtered = tracks.filter((track) => {
      return (track.mood || track.category || "miss") === activeMood;
    });

    songList.replaceChildren();

    songCount.textContent =
      `${filtered.length} ${filtered.length === 1 ? "song" : "songs"}`;

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-playlist";

      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.textContent = "♫";

      const heading = document.createElement("strong");
      heading.textContent = "Your songs will live here.";

      const copy = document.createElement("p");
      copy.textContent =
        "Songs added from Admin Studio will appear here in their selected mood.";

      empty.append(icon, heading, copy);
      songList.appendChild(empty);

      nowPlayingTitle.textContent = "Choose a song";
      nowPlayingArtist.textContent = "Your little soundtrack awaits.";

      frameWrap.replaceChildren();

      const placeholder = document.createElement("div");
      placeholder.className = "player-placeholder";
      placeholder.textContent = "Choose a song to load its Spotify player.";
      frameWrap.appendChild(placeholder);

      updatePlayerArt({});
      return;
    }

    filtered.forEach((track, index) => {
      const row = document.createElement("div");
      row.className = "song-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Play ${track.title || "song"}`);

      const number = document.createElement("span");
      number.className = "song-index";
      number.textContent = String(index + 1).padStart(2, "0");

      const cover = document.createElement("img");
      cover.className = "song-cover";
      cover.alt = track.title ? `Cover art for ${track.title}` : "Song cover";
      cover.loading = "lazy";

      if (track.image_url) {
        cover.src = track.image_url;
      } else {
        cover.src =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' rx='12' fill='%23d9b6c5'/%3E%3Ctext x='40' y='50' font-size='27' text-anchor='middle' fill='white'%3E%26%239835%3B%3C/text%3E%3C/svg%3E";
      }

      const meta = document.createElement("span");
      meta.className = "song-meta";

      const songTitle = document.createElement("strong");
      songTitle.textContent = track.title || "Untitled song";

      const artist = document.createElement("span");
      artist.textContent = track.artist || "Picked with love ♡";

      meta.append(songTitle, artist);

      const play = document.createElement("button");
      play.className = "song-play";
      play.type = "button";
      play.setAttribute("aria-label", `Play ${track.title || "song"}`);
      play.textContent = "▶";

      play.addEventListener("click", (event) => {
        event.stopPropagation();
        chooseTrack(track, row);
      });

      row.append(number, cover, meta, play);

      row.addEventListener("click", () => chooseTrack(track, row));

      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseTrack(track, row);
        }
      });

      songList.appendChild(row);
    });
  }

  moodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeMood = button.dataset.mood;

      moodButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });

      const info = moodInfo[activeMood];
      if (!info) return;

      title.textContent = info.title + " ♡";
      kicker.textContent = info.kicker;
      description.textContent = info.description;

      renderSongs();

      document.getElementById("playlistSection")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  async function loadTracks() {
    try {
      const response = await fetch("/api/playlist", {
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Playlist API is not available.");
      }

      const data = await response.json();
      if (Array.isArray(data)) tracks = data;
    } catch (error) {
      console.error("Could not load playlist:", error.message);
    }

    renderSongs();
  }

  loadTracks();
});
