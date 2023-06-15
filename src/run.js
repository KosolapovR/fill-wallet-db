import Path from "path";
import pify from "pify";
import * as fs from "fs";
import * as crypto from "crypto";
import sqlitePackage from "sqlite3";
const sqlite3 = sqlitePackage.verbose();

const CURRENCIES = [
  {
    name: "Ruble",
    alphaCode: "RUB",
  },
  {
    name: "Dollar",
    alphaCode: "USD",
  },
  {
    name: "Euro",
    alphaCode: "EUR",
  },
];

const generateId = () =>
  new Promise((resolve, reject) => {
    crypto.randomBytes(8, (err, buf) => {
      if (err) reject(err);
      const id = buf.toString("hex");
      resolve(id);
    });
  });

async function run() {
  const dbPath = Path.join(Path.resolve("."), "src/db/fixture.db");
  const fsAsync = await pify(fs);
  let exist = true;
  try {
    exist = await fsAsync.exists(dbPath);
  } catch (e) {
    console.log("err", e);
  }
  try {
    if (exist) await fsAsync.unlink(dbPath);
  } catch (e) {
    console.log("err", e);
  }

  const db = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) {
        return console.error("[db-error]", err.message);
      }
      console.log("Connected to the SQlite database.");
    }
  );

  const asyncDB = await pify(db);
  await asyncDB.run(
    "CREATE TABLE currencies (id TEXT PRIMARY KEY, name TEXT, alpha_code TEXT, _status TEXT, _changed TEXT)"
  );
  for (let currency of CURRENCIES) {
    const id = await generateId();
    console.log("id", id);
    await asyncDB.run(
      "INSERT INTO currencies (`id`, `name`, `alpha_code`) VALUES (?, ?, ?)",
      [id, currency.name, currency.alphaCode]
    );
  }

  // close the database connection
  db.close((err) => {
    if (err) {
      return console.error("[db-error]", err.message);
    }
    console.log("Close the database connection.");
  });
}

export default run;
