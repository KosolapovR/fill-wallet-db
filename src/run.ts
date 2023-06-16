import Path from "path";
import pify from "pify";
import * as fs from "fs";
import * as crypto from "crypto";
import sqlitePackage from "sqlite3";
const sqlite3 = sqlitePackage.verbose();

type ColumnType = "string" | "number" | "boolean";
type ColumnSchema = {
  name: string;
  type: ColumnType;
  isOptional?: boolean;
  isIndexed?: boolean;
};
type TableSchemaSpec = {
  name: string;
  columns: ColumnSchema[];
  unsafeSql?: (_: string) => string;
};

type TableNameUnion =
  | "currencies"
  | "transactions"
  | "accounts"
  | "categories"
  | "sub_categories";

const TABLES: { [k in TableNameUnion]: TableNameUnion } = {
  categories: "categories",
  accounts: "accounts",
  currencies: "currencies",
  sub_categories: "sub_categories",
  transactions: "transactions",
};

const CURRENCIES = [
  {
    name: "Zloty",
    alphaCode: "PLN",
  },
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

const currenciesTableSpec: TableSchemaSpec = {
  name: TABLES.currencies,
  columns: [
    { name: "name", type: "string" },
    { name: "alpha_code", type: "string" },
  ],
};
const accountsTableSpec: TableSchemaSpec = {
  name: TABLES.accounts,
  columns: [
    { name: "name", type: "string" },
    { name: "currency_id", type: "string" },
    { name: "balance", type: "number" },
  ],
};
const transactionsTableSpec: TableSchemaSpec = {
  name: TABLES.transactions,
  columns: [
    { name: "amount", type: "number" },
    { name: "note", type: "string", isOptional: true },
    { name: "account_id", type: "string" },
    { name: "transfer_account_id", type: "string", isOptional: true },
    { name: "category_id", type: "string" },
    { name: "sub_category_id", type: "string", isOptional: true },
    { name: "created_at", type: "number" },
  ],
};
const categoriesTableSpec: TableSchemaSpec = {
  name: TABLES.categories,
  columns: [
    { name: "name", type: "string" },
    { name: "icon", type: "string" },
    { name: "color", type: "string" },
  ],
};
const subCategoriesTableSpec: TableSchemaSpec = {
  name: TABLES.sub_categories,
  columns: [
    { name: "name", type: "string" },
    { name: "color", type: "string" },
    { name: "category_id", type: "string" },
  ],
};

const schema: TableSchemaSpec[] = [
  currenciesTableSpec,
  accountsTableSpec,
  transactionsTableSpec,
  categoriesTableSpec,
  subCategoriesTableSpec,
];

const withFixtures = process.argv[2] === "--fixtures";

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
  const fsAsync = await pify(fs, { errorFirst: false });
  const exist = await fsAsync.exists(dbPath);
  if (exist) await fsAsync.unlink(dbPath);

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
  //@ts-ignore
  await asyncDB.run("PRAGMA user_version = 1");

  const transformColumnType = (t: ColumnType): "TEXT" | "INTEGER" =>
    t === "string" ? "TEXT" : "INTEGER";
  async function createTable({ name, columns }: TableSchemaSpec): Promise<any> {
    const columnsSQL = columns.reduce(
      (sql, c) =>
        `${sql}, ${c.name} ${transformColumnType(c.type)}${
          !c.isOptional ? " NOT NULL" : ""
        }`,
      ""
    );
    const sql = `CREATE TABLE ${name} (id TEXT PRIMARY KEY, _status TEXT, _changed TEXT${columnsSQL})`;
    //@ts-ignore
    return asyncDB.run(sql);
  }

  //create tables
  for (const tableSpec of schema) {
    await createTable(tableSpec);
  }

  //fill currencies
  for (let currency of CURRENCIES) {
    const id = await generateId();
    const stmt = `INSERT INTO ${TABLES.currencies} (id, name, alpha_code) VALUES (?, ?, ?)`;
    const params = [id, currency.name, currency.alphaCode];
    //@ts-ignore
    await asyncDB.run(stmt, params);
  }

  if (withFixtures) {
    const selectRubIdSQL = `SELECT id FROM ${TABLES.currencies} WHERE name = 'Ruble'`;
    //@ts-ignore
    const { id: rubID } = (await asyncDB.each(selectRubIdSQL)) as {
      id: string;
    };

    const selectUsdIdSQL = `SELECT id FROM ${TABLES.currencies} WHERE name = 'Zloty'`;
    //@ts-ignore
    const { id: plnID } = (await asyncDB.each(selectUsdIdSQL)) as {
      id: string;
    };

    //fill accounts
    const plnAccountId = await generateId();
    const plnAccountStmt = `INSERT INTO ${TABLES.accounts} (id, name, currency_id, balance) VALUES (?, ?, ?, ?)`;
    const pnlAccountParams = [plnAccountId, "Polish wallet", plnID, 3000];
    //@ts-ignore
    await asyncDB.run(plnAccountStmt, pnlAccountParams);

    const rubAccountId = await generateId();
    const rubAccountStmt = `INSERT INTO ${TABLES.accounts} (id, name, currency_id, balance) VALUES (?, ?, ?, ?)`;
    const rubAccountParams = [rubAccountId, "Russian wallet", rubID, 700000];
    //@ts-ignore
    await asyncDB.run(rubAccountStmt, rubAccountParams);
  }

  // close the database connection
  db.close((err) => {
    if (err) {
      return console.error("[db-error]", err.message);
    }
    console.log("Close the database connection.");
  });
}

run();
