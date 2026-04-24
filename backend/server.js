const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 5000;
const SECRET = "supersecretkey";

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("shop.db", (err) => {
  if (err) console.error(err.message);
  else console.log("Database connected");
});

/* =========================
   TABLE SETUP
========================= */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      position TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partNumber TEXT,
      partDescriptionSeller TEXT,
      quantity INTEGER,
      cost REAL,
      net REAL,
      profit REAL,
      orderDate TEXT,
      repairOrderNumber TEXT,
      partOrdered INTEGER DEFAULT 0,
      orderedBy TEXT,
      dateOrdered TEXT,
      received INTEGER DEFAULT 0,
      testedGood INTEGER DEFAULT 0,
      testedBy TEXT,
      receivedDate TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      quantity INTEGER,
      dateReceived TEXT,
      partNumber TEXT,
      repairOrderNumber TEXT,
      sourceOrderId INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partId INTEGER,
      partNumber TEXT,
      partDescriptionSeller TEXT,
      quantity INTEGER,
      cost REAL,
      net REAL,
      profit REAL,
      orderDate TEXT,
      repairOrderNumber TEXT,
      orderedBy TEXT,
      dateOrdered TEXT,
      testedBy TEXT,
      receivedDate TEXT,
      usedDate TEXT,
      installedBy TEXT
    )
  `);

  // Default admin
  db.get("SELECT * FROM users WHERE username=?", ["admin"], async (err, row) => {
    if (!row) {
      const hash = await bcrypt.hash("admin123", 10);
      db.run(
        `INSERT INTO users (username, password, role, name, position)
         VALUES (?, ?, ?, ?, ?)`,
        ["admin", hash, "admin", "Admin", "I.T."]
      );
    }
  });
});

/* =========================
   LOGIN
========================= */

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username=?", [username], async (err, user) => {
    if (!user) return res.status(401).json({ success: false });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET);

    res.json({
      success: true,
      token,
      user
    });
  });
});

/* =========================
   USERS
========================= */

app.get("/users", (req, res) => {
  db.all(
    "SELECT id, username, role, name, email, phone, position FROM users",
    [],
    (err, rows) => {
      res.json({ success: true, users: rows });
    }
  );
});

app.post("/users", async (req, res) => {
  const { name, email, phone, position, username, password, role, createdByRole } = req.body;

  const allowedRoles = ["Tech", "Manager", "IT", "admin"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid role" });
  }

  if (createdByRole === "Manager" && role !== "Tech") {
    return res.status(403).json({ success: false, message: "Managers can only create Techs" });
  }

  if (!(createdByRole === "IT" || createdByRole === "admin" || createdByRole === "Manager")) {
    return res.status(403).json({ success: false });
  }

  const hash = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (username, password, role, name, email, phone, position)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username, hash, role, name, email, phone, position],
    function (err) {
      if (err) {
        return res.json({ success: false, message: "Username exists" });
      }

      res.json({ success: true });
    }
  );
});

/* ===== EDIT USER (ADMIN + IT) ===== */

app.put("/users/:id", async (req, res) => {
  const { name, email, phone, position, username, password, role, updatedByRole } = req.body;

  if (!(updatedByRole === "IT" || updatedByRole === "admin")) {
    return res.status(403).json({ success: false });
  }

  if (password && password !== "") {
    const hash = await bcrypt.hash(password, 10);

    db.run(
      `UPDATE users SET
        name=?, email=?, phone=?, position=?,
        username=?, password=?, role=?
       WHERE id=?`,
      [name, email, phone, position, username, hash, role, req.params.id],
      () => res.json({ success: true })
    );
  } else {
    db.run(
      `UPDATE users SET
        name=?, email=?, phone=?, position=?,
        username=?, role=?
       WHERE id=?`,
      [name, email, phone, position, username, role, req.params.id],
      () => res.json({ success: true })
    );
  }
});

/* =========================
   ORDERS
========================= */

app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders", [], (err, rows) => {
    res.json({ success: true, orders: rows });
  });
});

app.post("/orders", (req, res) => {
  const o = req.body;

  db.run(
    `INSERT INTO orders (
      partNumber, partDescriptionSeller, quantity, cost,
      net, profit, orderDate, repairOrderNumber
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      o.partNumber,
      o.partDescriptionSeller,
      o.quantity,
      o.cost,
      o.net,
      o.profit,
      o.orderDate,
      o.repairOrderNumber
    ],
    () => res.json({ success: true })
  );
});

/* ORDERED */

app.put("/orders/:id/ordered", (req, res) => {
  const { orderedBy, dateOrdered } = req.body;

  db.run(
    `UPDATE orders SET partOrdered=1, orderedBy=?, dateOrdered=? WHERE id=?`,
    [orderedBy, dateOrdered, req.params.id],
    () => res.json({ success: true })
  );
});

/* RECEIVED → MOVE TO PARTS */

app.put("/orders/:id/received", (req, res) => {
  const { testedGood, testedBy } = req.body;

  db.get("SELECT * FROM orders WHERE id=?", [req.params.id], (err, order) => {
    const receivedDate = new Date().toISOString();

    db.run(
      `UPDATE orders SET received=1, testedGood=?, testedBy=?, receivedDate=? WHERE id=?`,
      [testedGood ? 1 : 0, testedBy, receivedDate, req.params.id]
    );

    db.run(
      `INSERT INTO parts (name, quantity, dateReceived, partNumber, repairOrderNumber, sourceOrderId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        order.partDescriptionSeller,
        order.quantity,
        receivedDate,
        order.partNumber,
        order.repairOrderNumber,
        order.id
      ]
    );

    res.json({ success: true });
  });
});

/* =========================
   PARTS
========================= */

app.get("/parts", (req, res) => {
  db.all("SELECT * FROM parts", [], (err, rows) => {
    res.json({ success: true, parts: rows });
  });
});

/* MARK USED → MOVE TO HISTORY */

app.put("/parts/:id/used", (req, res) => {
  const { installedBy } = req.body;

  db.get("SELECT * FROM parts WHERE id=?", [req.params.id], (err, part) => {
    const usedDate = new Date().toISOString();

    db.get("SELECT * FROM orders WHERE id=?", [part.sourceOrderId], (err, order) => {
      db.run(
        `INSERT INTO history (
          partId, partNumber, partDescriptionSeller,
          quantity, cost, net, profit, orderDate,
          repairOrderNumber, orderedBy, dateOrdered,
          testedBy, receivedDate, usedDate, installedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          part.id,
          part.partNumber,
          part.name,
          part.quantity,
          order?.cost || 0,
          order?.net || 0,
          order?.profit || 0,
          order?.orderDate || "",
          part.repairOrderNumber,
          order?.orderedBy || "",
          order?.dateOrdered || "",
          order?.testedBy || "",
          part.dateReceived,
          usedDate,
          installedBy
        ]
      );

      db.run("DELETE FROM parts WHERE id=?", [part.id]);

      res.json({ success: true });
    });
  });
});

/* =========================
   HISTORY
========================= */

app.get("/history", (req, res) => {
  db.all("SELECT * FROM history", [], (err, rows) => {
    res.json({ success: true, history: rows });
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});