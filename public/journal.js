
const loginPanel = document.getElementById("loginPanel");
const journalPanel = document.getElementById("journalPanel");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("journalPassword");
const loginMessage = document.getElementById("loginMessage");

const entryForm = document.getElementById("entryForm");
const entryTitle = document.getElementById("entryTitle");
const entryDate = document.getElementById("entryDate");
const entryContent = document.getElementById("entryContent");
const entryMessage = document.getElementById("entryMessage");
const entriesList = document.getElementById("entriesList");

const formHeading = document.getElementById("formHeading");
const saveButton = document.getElementById("saveButton");
const cancelEdit = document.getElementById("cancelEdit");
const lockButton = document.getElementById("lockButton");

let editingId = null;
let busy = false;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function showMessage(element, message) {
  element.textContent = message;
}

function setUnlocked(unlocked) {
  loginPanel.hidden = unlocked;
  journalPanel.hidden = !unlocked;

  if (!unlocked) {
    loginPassword.value = "";
    resetEditor();
    entriesList.replaceChildren();
  }
}

function resetEditor() {
  editingId = null;
  entryForm.reset();
  entryDate.value = new Date().toLocaleDateString("en-CA");
  formHeading.textContent = "Write a memory";
  saveButton.textContent = "Save memory";
  cancelEdit.hidden = true;
  showMessage(entryMessage, "");
}

function makeButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", action);
  return button;
}

function renderEntries(entries) {
  entriesList.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No memories saved yet. Your first little memory can start here ♡";
    entriesList.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const card = document.createElement("article");
    card.className = "entry-card";

    const title = document.createElement("h3");
    title.textContent = entry.title;

    const date = document.createElement("div");
    date.className = "entry-date";
    date.textContent = entry.entry_date
      ? new Date(`${String(entry.entry_date).slice(0, 10)}T00:00:00`).toLocaleDateString(
          undefined,
          { day: "numeric", month: "long", year: "numeric" }
        )
      : "";

    const content = document.createElement("p");
    content.className = "entry-content";
    content.textContent = entry.content;

    const actions = document.createElement("div");
    actions.className = "entry-actions";

    actions.append(
      makeButton("Edit", "secondary", () => startEdit(entry)),
      makeButton("Delete", "secondary", () => deleteEntry(entry.id))
    );

    card.append(title, date, content, actions);
    entriesList.appendChild(card);
  }
}

async function loadEntries() {
  const entries = await api("/api/journal/entries");
  renderEntries(entries);
}

function startEdit(entry) {
  editingId = entry.id;
  entryTitle.value = entry.title;
  entryDate.value = String(entry.entry_date).slice(0, 10);
  entryContent.value = entry.content;
  formHeading.textContent = "Edit your memory";
  saveButton.textContent = "Update memory";
  cancelEdit.hidden = false;
  showMessage(entryMessage, "");

  entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(id) {
  if (!window.confirm("Delete this memory permanently?")) return;

  try {
    await api(`/api/journal/entries/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    if (String(editingId) === String(id)) resetEditor();
    await loadEntries();
  } catch (error) {
    window.alert(error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  busy = true;
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showMessage(loginMessage, "Unlocking...");

  try {
    await api("/api/journal/login", {
      method: "POST",
      body: JSON.stringify({ password: loginPassword.value })
    });

    setUnlocked(true);
    await loadEntries();
  } catch (error) {
    showMessage(loginMessage, error.message);
  } finally {
    busy = false;
    submitButton.disabled = false;
  }
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  busy = true;
  saveButton.disabled = true;
  showMessage(entryMessage, "Saving...");

  const payload = {
    title: entryTitle.value.trim(),
    entry_date: entryDate.value,
    content: entryContent.value.trim()
  };

  try {
    if (editingId !== null) {
      await api(`/api/journal/entries/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showMessage(entryMessage, "Memory updated ♡");
    } else {
      await api("/api/journal/entries", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showMessage(entryMessage, "Memory saved ♡");
    }

    resetEditor();
    await loadEntries();
  } catch (error) {
    showMessage(entryMessage, error.message);
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
});

cancelEdit.addEventListener("click", resetEditor);

lockButton.addEventListener("click", async () => {
  try {
    await api("/api/journal/logout", { method: "POST" });
    setUnlocked(false);
    showMessage(loginMessage, "Journal locked safely.");
  } catch (error) {
    window.alert(error.message);
  }
});

async function initializeJournal() {
  resetEditor();

  try {
    const status = await api("/api/journal/status");
    setUnlocked(status.unlocked);

    if (status.unlocked) {
      await loadEntries();
    }
  } catch {
    setUnlocked(false);
  }
}

initializeJournal();
