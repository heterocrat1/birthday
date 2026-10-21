
document.addEventListener("DOMContentLoaded", async () => {
  const timeline = document.getElementById("memoryTimeline");
  const count = document.getElementById("memoryCount");

  if (!timeline) return;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    const raw = String(value ?? "").slice(0, 10);
    const parts = raw.split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      return raw || "Date unavailable";
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2]);

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function createMemory(memory, index) {
    const styles = [
      { marker: "♡", card: "memory-rose", label: "A LITTLE MOMENT" },
      { marker: "✧", card: "memory-lilac", label: "KEPT CLOSE TO THE HEART" },
      { marker: "✿", card: "memory-peach", label: "A DAY TO REMEMBER" }
    ];

    const style = styles[index % styles.length];
    const entry = element("article", `timeline-entry ${style.card}`);

    const marker = element("div", "text-timeline-marker", style.marker);
    marker.setAttribute("aria-hidden", "true");

    const content = element("div", "text-memory-card");

    const top = element("div", "text-memory-top");
    top.append(
      element("span", "text-memory-label", style.label),
      element("time", "text-memory-date", formatDate(memory.memory_date))
    );

    const title = element("h3", "text-memory-title", memory.title);
    const description = element("p", "text-memory-description", memory.description);
    const footer = element(
      "span",
      "text-memory-footer",
      `a little piece of our story  ·  ${String(index + 1).padStart(2, "0")}`
    );

    content.append(top, title, description, footer);
    entry.append(marker, content);

    return entry;
  }

  try {
    const response = await fetch("/api/memories");

    if (!response.ok) {
      throw new Error("Could not load saved memories.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid memories response.");
    }

    // Oldest first. If dates match, use the database ID as a stable tie-breaker.
    const memories = data.slice().sort((a, b) => {
      const dateA = String(a.memory_date ?? "").slice(0, 10);
      const dateB = String(b.memory_date ?? "").slice(0, 10);

      return dateA.localeCompare(dateB) ||
        (Number(a.id) - Number(b.id));
    });

    timeline.replaceChildren();

    if (count) {
      count.textContent = `${memories.length} ${memories.length === 1 ? "memory" : "memories"} ♡`;
    }

    if (memories.length === 0) {
      timeline.appendChild(
        element(
          "p",
          "memory-empty-message",
          "Our timeline is waiting for its first little memory. Add one whenever you're ready ♡"
        )
      );
      return;
    }

    memories.forEach((memory, index) => {
      timeline.appendChild(createMemory(memory, index));
    });
  } catch (error) {
    console.error("Memory loading error:", error);

    timeline.replaceChildren(
      element(
        "p",
        "memory-empty-message",
        "Couldn't load our memories just now. Please check the server and refresh the page."
      )
    );

    if (count) count.textContent = "♡";
  }
});
