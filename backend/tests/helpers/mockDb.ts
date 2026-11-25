import crypto from 'crypto';
import { Knex } from 'knex';
import { setDbForTesting } from '../../src/config/database';

type Row = Record<string, any>;

export interface MemoryStore {
  [table: string]: Row[];
}

function stripAlias(name: string): { table: string; alias?: string } {
  const parts = name.split(/\s+as\s+/i);
  return { table: parts[0].trim(), alias: parts[1]?.trim() };
}

function stripColAlias(col: string): { source: string; alias?: string } {
  const parts = col.split(/\s+as\s+/i);
  return { source: parts[0].trim(), alias: parts[1]?.trim() };
}

function getColVal(row: Row, key: string): any {
  if (key in row) return row[key];
  const bare = key.includes('.') ? key.split('.').pop()! : key;
  return row[bare];
}

class QueryBuilder implements PromiseLike<any> {
  private tableName: string;
  private tableAlias?: string;
  private filters: Array<(row: Row) => boolean> = [];
  private joins: Array<{ table: string; alias?: string; leftCol: string; rightCol: string; type: 'inner' | 'left' }> = [];
  private selectedCols: string[] | null = null;
  private isFirst = false;
  private isCount = false;
  private countAlias = 'count';
  private orderBys: Array<{ col: string; dir: 'asc' | 'desc' }> = [];
  private limitVal?: number;
  private offsetVal = 0;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private conflictCols: string[] | null = null;
  private conflictAction: 'ignore' | 'merge' | null = null;
  private conflictMergeData: Row | null = null;

  constructor(private store: MemoryStore, rawTable: string) {
    const parsed = stripAlias(rawTable);
    this.tableName = parsed.table;
    this.tableAlias = parsed.alias;
    if (!this.store[this.tableName]) {
      this.store[this.tableName] = [];
    }
  }

  clone(): QueryBuilder {
    const copy = new QueryBuilder(this.store, this.tableAlias ? `${this.tableName} as ${this.tableAlias}` : this.tableName);
    copy.filters = [...this.filters];
    copy.joins = [...this.joins];
    copy.selectedCols = this.selectedCols ? [...this.selectedCols] : null;
    copy.isFirst = this.isFirst;
    copy.isCount = this.isCount;
    copy.countAlias = this.countAlias;
    copy.orderBys = [...this.orderBys];
    copy.limitVal = this.limitVal;
    copy.offsetVal = this.offsetVal;
    return copy;
  }

  private addFilter(fn: (row: Row) => boolean): this {
    this.filters.push(fn);
    return this;
  }

  where(cond: string | Row | ((qb: QueryBuilder) => void), opOrVal?: any, val?: any): this {
    if (typeof cond === 'function') {
      const sub = new QueryBuilder(this.store, this.tableName);
      cond(sub);
      return this.addFilter((r) => sub.filters.every((f) => f(r)));
    }
    if (typeof cond === 'object' && cond !== null) {
      for (const [k, v] of Object.entries(cond)) {
        this.addFilter((r) => getColVal(r, k) === v);
      }
      return this;
    }
    if (typeof cond === 'string') {
      const op = val !== undefined ? opOrVal : '=';
      const expected = val !== undefined ? val : opOrVal;
      return this.addFilter((r) => {
        const actual = getColVal(r, cond);
        if (op === '=') return actual === expected;
        if (op === '<=') return String(actual) <= String(expected);
        if (op === '<') return String(actual) < String(expected);
        if (op === '>=') return String(actual) >= String(expected);
        if (op === '>') return String(actual) > String(expected);
        return actual === expected;
      });
    }
    return this;
  }

  andWhere(cond: string | Row | ((qb: QueryBuilder) => void), opOrVal?: any, val?: any): this {
    return this.where(cond, opOrVal, val);
  }

  orWhere(col: string, val?: any): this {
    const prev = this.filters.pop();
    const nextFn = (r: Row) => getColVal(r, col) === val;
    if (!prev) return this.addFilter(nextFn);
    return this.addFilter((r) => prev(r) || nextFn(r));
  }

  whereNull(col: string): this {
    return this.addFilter((r) => getColVal(r, col) === null || getColVal(r, col) === undefined);
  }

  whereNotNull(col: string): this {
    return this.addFilter((r) => getColVal(r, col) !== null && getColVal(r, col) !== undefined);
  }

  whereNotIn(col: string, values: any[]): this {
    return this.addFilter((r) => !values.includes(getColVal(r, col)));
  }

  whereILike(col: string, pattern: string): this {
    const needle = pattern.replace(/%/g, '').toLowerCase();
    return this.addFilter((r) => String(getColVal(r, col) || '').toLowerCase().includes(needle));
  }

  orWhereILike(col: string, pattern: string): this {
    const needle = pattern.replace(/%/g, '').toLowerCase();
    const prev = this.filters.pop();
    const nextFn = (r: Row) => String(getColVal(r, col) || '').toLowerCase().includes(needle);
    if (!prev) return this.addFilter(nextFn);
    return this.addFilter((r) => prev(r) || nextFn(r));
  }

  whereRaw(sql: string, bindings: any[] = []): this {
    if (sql.includes('ANY(events)') && bindings.length > 0) {
      const evt = bindings[0];
      return this.addFilter((r) => Array.isArray(r.events) && r.events.includes(evt));
    }
    return this;
  }

  join(rawTable: string, leftCol: string, rightCol: string): this {
    const parsed = stripAlias(rawTable);
    this.joins.push({ table: parsed.table, alias: parsed.alias, leftCol, rightCol, type: 'inner' });
    return this;
  }

  leftJoin(rawTable: string, leftCol: string, rightCol: string): this {
    const parsed = stripAlias(rawTable);
    this.joins.push({ table: parsed.table, alias: parsed.alias, leftCol, rightCol, type: 'left' });
    return this;
  }

  select(...cols: string[]): this {
    this.selectedCols = cols.flat();
    return this;
  }

  first(...cols: string[]): this {
    if (cols.length > 0) this.selectedCols = cols;
    this.isFirst = true;
    return this;
  }

  count(expr = '* as count'): this {
    this.isCount = true;
    const parts = expr.split(/\s+as\s+/i);
    this.countAlias = parts[1]?.trim() || 'count';
    return this;
  }

  groupBy(): this {
    return this;
  }

  orderBy(col: string, dir: 'asc' | 'desc' = 'asc'): this {
    this.orderBys.push({ col, dir });
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  offset(n: number): this {
    this.offsetVal = n;
    return this;
  }

  insert(data: Row | Row[]): this {
    this.mode = 'insert';
    this.payload = Array.isArray(data) ? data : [data];
    return this;
  }

  onConflict(cols: string | string[]): this {
    this.conflictCols = Array.isArray(cols) ? cols : [cols];
    return this;
  }

  ignore(): this {
    this.conflictAction = 'ignore';
    return this;
  }

  merge(data: Row): this {
    this.conflictAction = 'merge';
    this.conflictMergeData = data;
    return this;
  }

  update(data: Row): this {
    this.mode = 'update';
    this.payload = data;
    return this;
  }

  del(): this {
    this.mode = 'delete';
    return this;
  }

  returning(): this {
    return this;
  }

  private buildJoinedRows(): Row[] {
    const baseRows = this.store[this.tableName] || [];
    const baseAlias = this.tableAlias || this.tableName;

    let combined: Row[] = baseRows.map((row) => {
      const prefixed: Row = { ...row };
      for (const [k, v] of Object.entries(row)) {
        prefixed[`${baseAlias}.${k}`] = v;
        prefixed[`${this.tableName}.${k}`] = v;
      }
      return prefixed;
    });

    for (const j of this.joins) {
      const targetRows = this.store[j.table] || [];
      const jAlias = j.alias || j.table;
      const next: Row[] = [];

      const parseRef = (ref: string) => {
        const [tbl, col] = ref.includes('.') ? ref.split('.') : ['', ref];
        return { tbl, col };
      };
      const leftRef = parseRef(j.leftCol);
      const rightRef = parseRef(j.rightCol);

      const leftIsTarget = leftRef.tbl === jAlias || leftRef.tbl === j.table;
      const targetCol = leftIsTarget ? leftRef.col : rightRef.col;
      const sourceRef = leftIsTarget ? j.rightCol : j.leftCol;

      for (const row of combined) {
        const sourceVal = getColVal(row, sourceRef);
        const matches = targetRows.filter((tr) => tr[targetCol] === sourceVal);
        if (matches.length > 0) {
          for (const m of matches) {
            const merged: Row = { ...row };
            for (const [k, v] of Object.entries(m)) {
              if (!(k in merged)) merged[k] = v;
              merged[`${jAlias}.${k}`] = v;
              merged[`${j.table}.${k}`] = v;
            }
            next.push(merged);
          }
        } else if (j.type === 'left') {
          next.push(row);
        }
      }
      combined = next;
    }

    return combined;
  }

  private projectRow(row: Row): Row {
    if (!this.selectedCols) {
      const clean: Row = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.includes('.')) clean[k] = v;
      }
      return clean;
    }
    const out: Row = {};
    for (const spec of this.selectedCols) {
      if (spec === '*' || spec.endsWith('.*')) {
        const prefix = spec === '*' ? null : spec.slice(0, -2);
        for (const [k, v] of Object.entries(row)) {
          if (prefix && k.startsWith(`${prefix}.`)) {
            out[k.slice(prefix.length + 1)] = v;
          } else if (!prefix && !k.includes('.')) {
            out[k] = v;
          }
        }
      } else {
        const { source, alias } = stripColAlias(spec);
        const key = alias || source.split('.').pop()!;
        out[key] = getColVal(row, source);
      }
    }
    return out;
  }

  private execute(): any {
    const table = this.store[this.tableName];

    if (this.mode === 'insert') {
      const inserted: Row[] = [];
      for (const item of this.payload as Row[]) {
        const normalized: Row = { ...item };
        if (!normalized.id && this.tableName !== 'task_watchers') {
          normalized.id = crypto.randomUUID();
        }
        if (!normalized.created_at) normalized.created_at = new Date().toISOString();
        if (!normalized.updated_at) normalized.updated_at = new Date().toISOString();
        if (this.tableName === 'tasks' || this.tableName === 'projects') {
          normalized.version = normalized.version ?? 1;
        }
        if (this.tableName === 'notifications' && normalized.is_read === undefined) {
          normalized.is_read = false;
        }
        if (this.tableName === 'workflow_rules' && normalized.is_active === undefined) {
          normalized.is_active = true;
        }
        if (this.tableName === 'users' && normalized.is_active === undefined) {
          normalized.is_active = true;
          normalized.is_platform_admin = normalized.is_platform_admin ?? false;
        }

        if (this.conflictCols) {
          const existingIdx = table.findIndex((r) =>
            this.conflictCols!.every((c) => r[c] === normalized[c]),
          );
          if (existingIdx >= 0) {
            if (this.conflictAction === 'ignore') {
              continue;
            }
            if (this.conflictAction === 'merge') {
              table[existingIdx] = { ...table[existingIdx], ...this.conflictMergeData };
              inserted.push({ ...table[existingIdx] });
              continue;
            }
          }
        }

        // Enforce unique email/slug/event_id
        if (this.tableName === 'users' && table.some((u) => u.email === normalized.email)) {
          const err: any = new Error('Duplicate user email');
          err.code = '23505';
          throw err;
        }
        if (this.tableName === 'processed_events' && table.some((e) => e.event_id === normalized.event_id)) {
          const err: any = new Error('Duplicate processed event');
          err.code = '23505';
          throw err;
        }

        table.push(normalized);
        inserted.push({ ...normalized });
      }
      return inserted;
    }

    if (this.mode === 'update') {
      const updated: Row[] = [];
      for (let i = 0; i < table.length; i++) {
        if (this.filters.every((f) => f(table[i]))) {
          const next = { ...table[i] };
          for (const [k, v] of Object.entries(this.payload as Row)) {
            if (v && typeof v === 'object' && '__raw' in v) {
              if (String(v.__raw).includes('version + 1')) {
                next.version = Number(next.version || 1) + 1;
              } else {
                next[k] = new Date().toISOString();
              }
            } else {
              next[k] = v;
            }
          }
          table[i] = next;
          updated.push({ ...next });
        }
      }
      return updated;
    }

    if (this.mode === 'delete') {
      const remaining: Row[] = [];
      let deleted = 0;
      for (const row of table) {
        if (this.filters.every((f) => f(row))) {
          deleted += 1;
        } else {
          remaining.push(row);
        }
      }
      this.store[this.tableName] = remaining;
      return deleted;
    }

    // SELECT
    let rows = this.buildJoinedRows().filter((r) => this.filters.every((f) => f(r)));

    if (this.isCount) {
      const countResult = [{ [this.countAlias]: String(rows.length) }];
      return this.isFirst ? countResult[0] : countResult;
    }

    if (this.orderBys.length > 0) {
      rows.sort((a, b) => {
        for (const ob of this.orderBys) {
          const av = getColVal(a, ob.col);
          const bv = getColVal(b, ob.col);
          if (av === bv) continue;
          const cmp = av < bv ? -1 : 1;
          return ob.dir === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }

    if (this.offsetVal) rows = rows.slice(this.offsetVal);
    if (this.limitVal !== undefined) rows = rows.slice(0, this.limitVal);

    const projected = rows.map((r) => this.projectRow(r));
    return this.isFirst ? projected[0] : projected;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const res = this.execute();
      return Promise.resolve(res).then(onfulfilled, onrejected);
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected);
    }
  }
}

export function createMockDb(initial: MemoryStore = {}): { db: Knex; store: MemoryStore } {
  const store: MemoryStore = {
    organizations: [],
    users: [],
    organization_members: [],
    invitations: [],
    refresh_tokens: [],
    teams: [],
    team_members: [],
    projects: [],
    milestones: [],
    tasks: [],
    comments: [],
    attachments: [],
    task_watchers: [],
    activity_log: [],
    audit_events: [],
    notifications: [],
    workflow_rules: [],
    processed_events: [],
    outgoing_webhooks: [],
    webhook_deliveries: [],
    subscriptions: [],
    dead_letter_jobs: [],
    ...initial,
  };

  const fnHelpers = {
    now: () => new Date().toISOString(),
  };

  const dbFn: any = (tableName: string) => new QueryBuilder(store, tableName);
  dbFn.fn = fnHelpers;
  dbFn.raw = (sql: string) => {
    if (sql.trim().toUpperCase() === 'SELECT 1') {
      return Promise.resolve({ rows: [{ '?column?': 1 }] });
    }
    return { __raw: sql };
  };
  dbFn.transaction = async (cb: (trx: any) => Promise<any>) => {
    const snapshot = JSON.parse(JSON.stringify(store));
    try {
      return await cb(dbFn);
    } catch (err) {
      // Roll back in-memory store on transaction failure!
      for (const key of Object.keys(store)) {
        store[key] = snapshot[key] || [];
      }
      throw err;
    }
  };
  dbFn.destroy = async () => undefined;

  setDbForTesting(dbFn as Knex);
  return { db: dbFn as Knex, store };
}
