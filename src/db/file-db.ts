/** Node 20 fallback when node:sqlite is missing (no experimental warning). */
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

export class FileDb {
  private tables: Tables = {
    objects: [],
    executions: [],
    rules: [],
    agents: [],
    agent_runs: [],
    runtime_space: [],
    syscalls: [],
    events: [],
  };

  constructor(private file: string) {
    if (fs.existsSync(file)) {
      try {
        this.tables = { ...this.tables, ...JSON.parse(fs.readFileSync(file, "utf8")) };
      } catch {
        /* empty */
      }
    }
  }

  exec(sql: string) {
    const s = sql.trim();
    if (/^BEGIN|^COMMIT|^ROLLBACK|^CREATE/i.test(s)) return;
    if (/INSERT OR IGNORE INTO runtime_space/i.test(s)) {
      if (!this.tables.runtime_space.some((r) => r.id === "kernel")) {
        this.tables.runtime_space.push({ id: "kernel", processes: "[]", updated_at: new Date().toISOString() });
        this.flush();
      }
    }
  }

  prepare(sql: string) {
    const n = sql.replace(/\s+/g, " ").trim();
    return {
      run: (...args: unknown[]) => ({ changes: this.run(n, args) }),
      get: (...args: unknown[]) => this.get(n, args),
      all: (...args: unknown[]) => this.all(n, args),
    };
  }

  close() {
    this.flush();
  }

  private flush() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.tables));
  }

  private table(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }

  private run(sql: string, args: unknown[]): number {
    const ins = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)(.*)$/i);
    if (ins) {
      const table = ins[1];
      const cols = ins[2].split(",").map((c) => c.trim());
      const row: Row = {};
      cols.forEach((c, i) => {
        row[c] = args[i];
      });
      const rows = this.table(table);
      const conflict = /ON CONFLICT\((\w+)\) DO UPDATE/i.exec(sql);
      if (conflict) {
        const key = conflict[1];
        const idx = rows.findIndex((r) => String(r[key]) === String(row[key]));
        if (idx >= 0) {
          const sets = sql.split(/DO UPDATE SET/i)[1] ?? "";
          const fields = [...sets.matchAll(/(\w+)=excluded\.(\w+)/g)].map((m) => m[1]);
          for (const f of fields) rows[idx][f] = row[f];
          this.flush();
          return 1;
        }
      }
      if (/INSERT OR IGNORE/i.test(sql) && rows.some((r) => r.id === row.id)) return 0;
      rows.push(row);
      this.flush();
      return 1;
    }
    const del = sql.match(/^DELETE FROM (\w+) WHERE (\w+) = \?$/i);
    if (del) {
      const rows = this.table(del[1]);
      const before = rows.length;
      this.tables[del[1]] = rows.filter((r) => String(r[del[2]]) !== String(args[0]));
      this.flush();
      return before - this.tables[del[1]].length;
    }
    const upd = sql.match(/^UPDATE (\w+) SET (.+) WHERE (\w+) = \?$/i);
    if (upd) {
      const rows = this.table(upd[1]);
      const assigns = upd[2].split(",").map((s) => s.trim().split("=")[0].trim());
      const whereCol = upd[3];
      const whereVal = args[args.length - 1];
      let n = 0;
      for (const r of rows) {
        if (String(r[whereCol]) !== String(whereVal)) continue;
        assigns.forEach((c, i) => {
          r[c] = args[i];
        });
        n++;
      }
      this.flush();
      return n;
    }
    return 0;
  }

  private get(sql: string, args: unknown[]): Row | undefined {
    const rows = this.all(sql, args);
    return rows[0];
  }

  private all(sql: string, args: unknown[]): Row[] {
    const from = sql.match(/FROM (\w+)/i);
    if (!from) return [];
    let rows = [...this.table(from[1])];
    if (/COALESCE\(MAX\(seq\), 0\)/i.test(sql)) {
      const max = rows.reduce((m, r) => Math.max(m, Number(r.seq ?? 0)), 0);
      return [{ s: max }];
    }
    if (/COUNT\(\*\) as c FROM executions WHERE cache_hit = 1/i.test(sql)) {
      return [{ c: rows.filter((r) => Number(r.cache_hit) === 1).length }];
    }
    if (/SELECT status, COUNT\(\*\) as c FROM executions GROUP BY status/i.test(sql)) {
      const map: Record<string, number> = {};
      for (const r of rows) map[String(r.status)] = (map[String(r.status)] ?? 0) + 1;
      return Object.entries(map).map(([status, c]) => ({ status, c }));
    }
    if (/SELECT kind, COUNT\(\*\) as count FROM objects GROUP BY kind/i.test(sql)) {
      const map: Record<string, number> = {};
      for (const r of rows) map[String(r.kind)] = (map[String(r.kind)] ?? 0) + 1;
      return Object.entries(map)
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => Number(b.count) - Number(a.count));
    }

    const eq = [...sql.matchAll(/(\w+) = \?/g)];
    const likes = [...sql.matchAll(/(\w+) LIKE \?/g)];
    let ai = 0;
    for (const m of eq) {
      if (m[1] === "1") continue;
      const col = m[1];
      const val = args[ai++];
      rows = rows.filter((r) => String(r[col]) === String(val));
    }
    for (const m of likes) {
      const col = m[1];
      const val = String(args[ai++] ?? "").replace(/%/g, "");
      rows = rows.filter((r) => String(r[col] ?? "").startsWith(val) || String(r[col] ?? "").includes(val));
    }
    if (/ORDER BY updated_at DESC/i.test(sql) || /ORDER BY created_at DESC/i.test(sql)) {
      const col = /ORDER BY (\w+)/i.exec(sql)?.[1] ?? "created_at";
      rows.sort((a, b) => String(b[col] ?? "").localeCompare(String(a[col] ?? "")));
    }
    if (/ORDER BY created_at ASC/i.test(sql)) {
      rows.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    }
    if (/ORDER BY priority DESC/i.test(sql)) {
      rows.sort((a, b) => Number(b.priority) - Number(a.priority));
    }
    if (/ORDER BY created_at$/i.test(sql)) {
      rows.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    }
    const lim = /LIMIT \?/.test(sql)
      ? Number(args[args.length - 1])
      : /LIMIT (\d+)/.test(sql)
        ? Number(/LIMIT (\d+)/.exec(sql)?.[1])
        : undefined;
    if (lim != null && !Number.isNaN(lim)) rows = rows.slice(0, lim);
    return rows;
  }
}
