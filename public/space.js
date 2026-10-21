
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("noteForm");
    const titleInput = document.getElementById("noteTitle");
    const moodInput = document.getElementById("noteMood");
    const textInput = document.getElementById("noteText");
    const characterCount = document.getElementById("characterCount");
    const formMessage = document.getElementById("formMessage");
    const notesGrid = document.getElementById("notesGrid");
    const emptyState = document.getElementById("emptyState");
    const notesCount = document.getElementById("notesCount");
    const clearNotesButton = document.getElementById("clearNotesButton");
    const promptText = document.getElementById("promptText");
    const newPromptButton = document.getElementById("newPromptButton");

    const prompts = [
        "What's one little thing that made you smile recently?",
        "If today had a colour, what colour would it be?",
        "What is something you wish you could tell your future self?",
        "What helps you feel peaceful when life gets loud?",
        "What's one small thing you're proud of yourself for?",
        "If you could save one moment from today, which would it be?",
        "What song matches your mood right now?",
        "What would you like to give yourself more time for?"
    ];

    let previousPrompt = -1;
    let notes = [];
    let nextId = 1;

    function updateCount() {
        characterCount.textContent = `${textInput.value.length} / 5000`;
    }

    function renderNotes() {
        notesGrid.replaceChildren();
        emptyState.hidden = notes.length > 0;
        notesCount.textContent =
            `${notes.length} ${notes.length === 1 ? "NOTE" : "NOTES"}`;
        clearNotesButton.hidden = notes.length === 0;

        notes.forEach(note => {
            const card = document.createElement("article");
            card.className = "note-card";

            const top = document.createElement("div");
            top.className = "note-card-top";

            const details = document.createElement("div");
            const heading = document.createElement("h3");
            heading.textContent = note.title;

            const date = document.createElement("p");
            date.className = "note-date";
            date.textContent = note.date;

            details.append(heading, date);

            const mood = document.createElement("span");
            mood.className = "note-mood";
            mood.textContent = note.mood;

            top.append(details, mood);

            const body = document.createElement("p");
            body.className = "note-body";
            body.textContent = note.text;

            const deleteButton = document.createElement("button");
            deleteButton.className = "delete-note";
            deleteButton.type = "button";
            deleteButton.textContent = "Delete demo note";

            deleteButton.addEventListener("click", () => {
                notes = notes.filter(item => item.id !== note.id);
                renderNotes();
            });

            card.append(top, body, deleteButton);
            notesGrid.appendChild(card);
        });

        notesGrid.appendChild(emptyState);
    }

    textInput.addEventListener("input", updateCount);

    form.addEventListener("submit", event => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const text = textInput.value.trim();

        if (!title || !text) {
            formMessage.textContent = "Add a title and a little note first. ♡";
            return;
        }

        notes.unshift({
            id: nextId++,
            title,
            mood: moodInput.value,
            text,
            date: new Date().toLocaleString()
        });

        renderNotes();

        form.reset();
        updateCount();
        formMessage.textContent =
            "Demo note added to this page. It isn't securely saved. ♡";
        titleInput.focus();
    });

    newPromptButton.addEventListener("click", () => {
        if (prompts.length < 2) return;

        let index;
        do {
            index = Math.floor(Math.random() * prompts.length);
        } while (index === previousPrompt);

        previousPrompt = index;
        promptText.textContent = prompts[index];
    });

    clearNotesButton.addEventListener("click", () => {
        notes = [];
        renderNotes();
        formMessage.textContent = "Demo notes cleared from this page.";
    });

    updateCount();
    renderNotes();
});
