
require("dotenv").config();

const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const session = require("express-session");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const uploadDirectory = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const photoStorage = process.env.PHOTO_STORAGE || "local";

if (!["local", "cloudinary"].includes(photoStorage)) {
  throw new Error("PHOTO_STORAGE must be local or cloudinary.");
}

if (photoStorage === "cloudinary") {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary environment variables are missing.");
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (!allowed.has(file.mimetype)) {
      return callback(new Error("Only JPG, PNG and WebP images are allowed."));
    }

    callback(null, true);
  }
});

function saveCloudinaryImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "birthday-gallery",
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

app.post(
  "/api/gallery/upload",
  requireAdmin,
  photoUpload.single("photo"),
  async (req, res) => {
    let localFilePath;

    try {
      const { title, category = "Moments" } = req.body || {};

      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Photo caption is required." });
      }

      if (title.trim().length > 100) {
        return res.status(400).json({ error: "Caption must be 100 characters or fewer." });
      }

      if (!["Moments", "Suhana", "Little things"].includes(category)) {
        return res.status(400).json({ error: "Invalid photo category." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Please select a photo." });
      }

      // Check actual file signatures rather than trusting MIME type alone.
      const bytes = req.file.buffer;
      const isJpeg =
        bytes.length >= 3 &&
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng =
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        );
      const isWebp =
        bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";

      if (!isJpeg && !isPng && !isWebp) {
        return res.status(400).json({ error: "The selected file is not a valid JPG, PNG or WebP image." });
      }

      let imageUrl;

      if (photoStorage === "cloudinary") {
        const uploaded = await saveCloudinaryImage(req.file.buffer);
        imageUrl = uploaded.secure_url;
      } else {
        const extension = isJpeg ? ".jpg" : isPng ? ".png" : ".webp";
        const filename = `${require("crypto").randomUUID()}${extension}`;
        localFilePath = path.join(uploadDirectory, filename);

        await fs.promises.writeFile(localFilePath, req.file.buffer, {
          flag: "wx"
        });

        imageUrl = `/uploads/${filename}`;
      }

      const [result] = await db.execute(
        "INSERT INTO gallery (title, image_url, category) VALUES (?, ?, ?)",
        [title.trim(), imageUrl, category]
      );

      res.status(201).json({
        success: true,
        photo: {
          id: result.insertId,
          title: title.trim(),
          image_url: imageUrl,
          category
        }
      });
    } catch (error) {
      // Avoid leaving a local file behind if the database insert fails.
      if (localFilePath) {
        await fs.promises.unlink(localFilePath).catch(() => {});
      }

      console.error("Photo upload failed:", error.message);
      res.status(500).json({ error: "Photo upload failed. Please try again." });
    }
  }
);
app.use("/uploads", express.static(uploadDirectory, {
  dotfiles: "deny",
  index: false,
  fallthrough: false
}));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5 MB or smaller."
        : "Unable to process the selected image.";

    return res.status(400).json({ error: message });
  }

  if (err.message?.startsWith("Only JPG")) {
    return res.status(400).json({ error: err.message });
  }

  console.error("Request error:", err.message);
  res.status(500).json({ error: "Something went wrong." });
});

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use(session({
  name: "birthday_admin_session",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 2 * 60 * 60 * 1000
  }
}));


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

const journalLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});


function requireJournal(req, res, next) {
  if (req.session?.journalUnlocked === true) {
    return next();
  }

  return res.status(401).json({
    error: "Please unlock the private journal first."
  });
}



function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  return res.status(401).json({
    error: "Please log in as admin first."
  });
}


// Serve the website files
app.use(express.static(path.join(__dirname, "public"), {
  index: "index.html",
  dotfiles: "deny"
}));

app.post("/api/admin/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD_HASH ||
    !process.env.SESSION_SECRET
  ) {
    return res.status(400).json({
      error: "Invalid login configuration or credentials."
    });
  }

  const passwordMatches = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH
  );

  if (
    username !== process.env.ADMIN_USERNAME ||
    !passwordMatches
  ) {
    return res.status(401).json({
      error: "Incorrect username or password."
    });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({
        error: "Could not start admin session."
      });
    }

    req.session.isAdmin = true;

    req.session.save((saveErr) => {
      if (saveErr) {
        return res.status(500).json({
          error: "Could not save admin session."
        });
      }

      res.json({ success: true, message: "Admin logged in." });
    });
  });
});

app.get("/api/admin/status", (req, res) => {
  res.json({
    loggedIn: req.session?.isAdmin === true
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: "Could not log out."
      });
    }

    res.clearCookie("birthday_admin_session", {
      httpOnly: true,
      sameSite: "strict",
      secure: false
    });

    res.json({ success: true, message: "Logged out." });
  });
});

app.post(
  "/api/journal/login",
  journalLoginLimiter,
  async (req, res) => {
    try {
      const { password } = req.body || {};

      if (
        typeof password !== "string" ||
        !password ||
        password.length > 72
      ) {
        return res.status(400).json({
          error: "Please enter a valid password."
        });
      }

      const [rows] = await db.execute(
        "SELECT password_hash FROM journal_settings WHERE id = 1"
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: "Journal has not been set up yet."
        });
      }

      const matches = await bcrypt.compare(
        password,
        rows[0].password_hash
      );

      if (!matches) {
        return res.status(401).json({
          error: "Incorrect journal password."
        });
      }

      // Keep the existing admin session intact.
      req.session.journalUnlocked = true;

      req.session.save((error) => {
        if (error) {
          return res.status(500).json({
            error: "Could not save journal session."
          });
        }

        return res.json({
          success: true,
          message: "Private journal unlocked."
        });
      });
    } catch (error) {
      console.error("Journal login failed:", error.message);

      return res.status(500).json({
        error: "Could not log in to the journal."
      });
    }
  }
);

app.get("/api/journal/status", (req, res) => {
  res.json({
    unlocked: req.session?.journalUnlocked === true
  });
});

app.post("/api/journal/logout", requireJournal, (req, res) => {
  req.session.journalUnlocked = false;

  req.session.save((error) => {
    if (error) {
      return res.status(500).json({
        error: "Could not lock the journal."
      });
    }

    return res.json({
      success: true,
      message: "Private journal locked."
    });
  });
});


app.get("/api/journal/entries", requireJournal, async (req, res) => {
  try {
    const [entries] = await db.execute(
      `SELECT id, title, entry_date, content, created_at, updated_at
       FROM journal_entries
       ORDER BY entry_date DESC, id DESC`
    );

    return res.json(entries);
  } catch (error) {
    console.error("Load journal entries failed:", error.message);

    return res.status(500).json({
      error: "Could not load journal entries."
    });
  }
});

app.post("/api/journal/entries", requireJournal, async (req, res) => {
  try {
    const { title, entry_date, content } = req.body || {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        error: "Title is required and must be 150 characters or fewer."
      });
    }

    if (
      typeof entry_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)
    ) {
      return res.status(400).json({
        error: "Please provide a valid date in YYYY-MM-DD format."
      });
    }

    const parsedDate = new Date(`${entry_date}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== entry_date
    ) {
      return res.status(400).json({
        error: "Please provide a valid calendar date."
      });
    }

    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 20000
    ) {
      return res.status(400).json({
        error: "Entry content is required and must be 20,000 characters or fewer."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO journal_entries (title, entry_date, content)
       VALUES (?, ?, ?)`,
      [title.trim(), entry_date, content.trim()]
    );

    return res.status(201).json({
      success: true,
      message: "Journal entry saved.",
      id: result.insertId
    });
  } catch (error) {
    console.error("Save journal entry failed:", error.message);

    return res.status(500).json({
      error: "Could not save journal entry."
    });
  }
});

app.put("/api/journal/entries/:id", requireJournal, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, entry_date, content } = req.body || {};

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid entry ID." });
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150 ||
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 20000 ||
      typeof entry_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)
    ) {
      return res.status(400).json({
        error: "Please provide a valid title, date and content."
      });
    }

    const date = new Date(`${entry_date}T00:00:00Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== entry_date
    ) {
      return res.status(400).json({ error: "Invalid calendar date." });
    }

    const [result] = await db.execute(
      `UPDATE journal_entries
       SET title = ?, entry_date = ?, content = ?
       WHERE id = ?`,
      [title.trim(), entry_date, content.trim(), id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Journal entry not found." });
    }

    return res.json({ success: true, message: "Entry updated." });
  } catch (error) {
    console.error("Update journal entry failed:", error.message);
    return res.status(500).json({ error: "Could not update entry." });
  }
});

app.delete("/api/journal/entries/:id", requireJournal, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid entry ID." });
    }

    const [result] = await db.execute(
      "DELETE FROM journal_entries WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Journal entry not found." });
    }

    return res.json({ success: true, message: "Entry deleted." });
  } catch (error) {
    console.error("Delete journal entry failed:", error.message);
    return res.status(500).json({ error: "Could not delete entry." });
  }
});

// Test database connection


app.post("/api/journal/setup", requireAdmin, async (req, res) => {
  try {
    const { password } = req.body || {};

    if (
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: "Password must be between 10 and 72 characters."
      });
    }

    const [existing] = await db.execute(
      "SELECT id FROM journal_settings WHERE id = 1"
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: "Journal has already been set up."
      });
    }

    const crypto = require("crypto");

    const recoveryCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(6).toString("hex").toUpperCase()
    );

    const passwordHash = await bcrypt.hash(password, 12);

    const recoveryHashes = await Promise.all(
      recoveryCodes.map((code) => bcrypt.hash(code, 12))
    );

    await db.execute(
      `INSERT INTO journal_settings
       (id, password_hash, recovery_code_hashes)
       VALUES (1, ?, ?)`,
      [passwordHash, JSON.stringify(recoveryHashes)]
    );

    return res.status(201).json({
      success: true,
      message: "Journal password created. Save your recovery codes now.",
      recoveryCodes
    });
  } catch (error) {
    console.error("Journal setup failed:", error.message);

    return res.status(500).json({
      error: "Could not set up the journal."
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// Gallery
app.get("/api/gallery", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, title, image_url, category, created_at FROM gallery ORDER BY id DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Gallery error:", error.message);
    res.status(500).json({ error: "Could not load gallery." });
  }
});

// Memories
app.get("/api/memories", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, title, memory_date, description, created_at
      FROM memories
      ORDER BY memory_date ASC, id ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Memories error:", error.message);
    res.status(500).json({ error: "Could not load memories." });
  }
});


 // Spotify playlist
app.get("/api/playlist", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, spotify_url, position, mood, artist, image_url
       FROM tracks
       ORDER BY position, id`
    );

    res.json(rows);
  } catch (error) {
    console.error("Playlist error:", error.message);
    res.status(500).json({ error: "Could not load playlist." });
  }
});


// Birthday letter
app.get("/api/letter", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT title, content, updated_at FROM birthday_letter WHERE id = 1"
    );
    res.json(rows[0] || null);
  } catch (error) {
    console.error("Letter error:", error.message);
    res.status(500).json({ error: "Could not load letter." });
  }
});

app.post("/api/gallery", requireAdmin, async (req, res) => {
  const { title, image_url, category = "Moments" } = req.body || {};

  if (
    typeof title !== "string" || !title.trim() ||
    typeof image_url !== "string" || !image_url.trim() ||
    typeof category !== "string"
  ) {
    return res.status(400).json({ error: "Valid title and image URL required." });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO gallery (title, image_url, category) VALUES (?, ?, ?)",
      [title.trim(), image_url.trim(), category.trim()]
    );
    res.status(201).json({ id: result.insertId, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save gallery item." });
  }
});

app.delete("/api/gallery/:id", requireAdmin, async (req, res) => {
  try {
    const [result] = await db.execute(
      "DELETE FROM gallery WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Gallery item not found." });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete gallery item." });
  }
});

app.post("/api/memories", requireAdmin, async (req, res) => {
  const { title, memory_date, description } = req.body || {};

  if (
    typeof title !== "string" || !title.trim() ||
    typeof description !== "string" ||
    typeof memory_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(memory_date) ||
    Number.isNaN(Date.parse(memory_date))
  ) {
    return res.status(400).json({ error: "Valid title, date and description required." });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO memories (title, memory_date, description) VALUES (?, ?, ?)",
      [title.trim(), memory_date, description.trim()]
    );
    res.status(201).json({ id: result.insertId, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save memory." });
  }
});

app.delete("/api/memories/:id", requireAdmin, async (req, res) => {
  try {
    const [result] = await db.execute(
      "DELETE FROM memories WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Memory not found." });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete memory." });
  }
});

async function getSpotifyMetadata(spotifyUrl) {
  const endpoint =
    `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error("Spotify metadata could not be fetched.");
  }

  const data = await response.json();

  return {
    title: data.title || "",
    image_url: data.thumbnail_url || null,
    embed_url: data.iframe_url || null
  };
}

app.post("/api/playlist", requireAdmin, async (req, res) => {
  const { spotify_url, mood = "miss", position = 0 } = req.body || {};

  if (
    typeof spotify_url !== "string" ||
    !["miss", "happy"].includes(mood)
  ) {
    return res.status(400).json({
      error: "Valid Spotify URL and mood are required."
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(spotify_url);
  } catch {
    return res.status(400).json({ error: "Invalid Spotify URL." });
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !["open.spotify.com", "www.open.spotify.com"].includes(parsedUrl.hostname) ||
    !parsedUrl.pathname.startsWith("/track/")
  ) {
    return res.status(400).json({
      error: "Please use a valid Spotify track link."
    });
  }

  try {
    let metadata = {
      title: "",
      image_url: null
    };

    try {
      metadata = await getSpotifyMetadata(parsedUrl.toString());
    } catch (metadataError) {
      console.warn("Spotify metadata unavailable:", metadataError.message);
    }

    if (!metadata.title) {
      return res.status(400).json({
        error: "Could not fetch the song title. Please try another Spotify track."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO tracks
        (title, spotify_url, position, mood, artist, image_url)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [
        metadata.title,
        parsedUrl.toString(),
        Number.isInteger(position) ? position : 0,
        mood,
        metadata.image_url || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      success: true,
      title: metadata.title,
      image_url: metadata.image_url || null
    });
  } catch (error) {
    console.error("Add track error:", error.message);
    res.status(500).json({ error: "Could not save track." });
  }
});

app.delete("/api/playlist/:id", requireAdmin, async (req, res) => {
  try {
    const [result] = await db.execute(
      "DELETE FROM tracks WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Track not found." });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete track." });
  }
});

app.put("/api/letter", requireAdmin, async (req, res) => {
  const { title, content } = req.body || {};

  if (
    typeof title !== "string" || !title.trim() ||
    typeof content !== "string"
  ) {
    return res.status(400).json({ error: "Valid title and content required." });
  }

  try {
    await db.execute(
      `INSERT INTO birthday_letter (id, title, content)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE title = ?, content = ?`,
      [title.trim(), content, title.trim(), content]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save letter." });
  }
});

// Start only after confirming MySQL connection
async function startServer() {
  try {
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();

    app.listen(PORT, () => {
      console.log(`Birthday website: http://localhost:${PORT}`);
      console.log("MySQL database connected successfully!");
    });
  } catch (error) {
    console.error("Could not connect to MySQL:", error.message);
    process.exit(1);
  }
}

startServer();
