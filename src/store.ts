import { randomUUID } from "node:crypto";

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
    if (key.includes("_") && value && typeof value === "object") {
      return Object.entries(value).every(([part, expected]) => row[part] === expected);
    }
    if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
      if ("lte" in value && !(row[key] <= value.lte)) return false;
      if ("lt" in value && !(row[key] < value.lt)) return false;
      if ("gte" in value && !(row[key] >= value.gte)) return false;
      if ("gt" in value && !(row[key] > value.gt)) return false;
      if ("in" in value && !value.in.includes(row[key])) return false;
      return true;
    }
    return row[key] === value;
  });
}

function sortRows(rows: Row[], orderBy: any) {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return rows.sort((a, b) => {
    for (const order of orders) {
      const [key, direction] = Object.entries(order)[0] as [string, string];
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (av === bv) continue;
      return (av > bv ? 1 : -1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
}

function model(rows: Row[]) {
  return {
    async findUnique({ where, select }: any) {
      const row = rows.find((item) => matches(item, where)) ?? null;
      if (!row || !select) return row;
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]));
    },
    async findUniqueOrThrow(args: any) {
      const row = await this.findUnique(args);
      if (!row) throw new Error("Záznam nebyl nalezen.");
      return row;
    },
    async findFirst({ where = {}, orderBy, select }: any = {}) {
      const row = sortRows(rows.filter((item) => matches(item, where)), orderBy)[0] ?? null;
      if (!row || !select) return row;
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]));
    },
    async findMany({ where = {}, orderBy, take }: any = {}) {
      const found = sortRows(rows.filter((item) => matches(item, where)), orderBy);
      return take ? found.slice(0, take) : found;
    },
    async create({ data }: any) {
      const now = new Date();
      const row = { id: randomUUID(), createdAt: now, updatedAt: now, ...data };
      rows.push(row);
      return row;
    },
    async update({ where, data }: any) {
      const row = rows.find((item) => matches(item, where));
      if (!row) throw new Error("Záznam nebyl nalezen.");
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) row[key] = value;
      }
      row.updatedAt = new Date();
      return row;
    },
    async updateMany({ where = {}, data }: any) {
      const found = rows.filter((item) => matches(item, where));
      found.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
      return { count: found.length };
    },
    async delete({ where }: any) {
      const index = rows.findIndex((item) => matches(item, where));
      if (index < 0) throw new Error("Záznam nebyl nalezen.");
      return rows.splice(index, 1)[0];
    },
    async upsert({ where, create, update }: any) {
      const row = rows.find((item) => matches(item, where));
      return row ? this.update({ where, data: update }) : this.create({ data: create });
    }
  };
}

export function createMemoryStore(seed: { username: string; passwordHash: string; deviceId: string; apiKeyHash: string }) {
  const now = new Date();
  const data: Record<string, Row[]> = {
    users: [{ id: randomUUID(), username: seed.username, passwordHash: seed.passwordHash, createdAt: now, updatedAt: now }],
    devices: [{ id: randomUUID(), deviceId: seed.deviceId, name: "StaniceBox LCD", apiKeyHash: seed.apiKeyHash, enabled: true, createdAt: now, updatedAt: now }],
    telemetry: [], messages: [], deliveries: [], configurations: [], commands: [], events: [], firmware: [], audit: []
  };
  const store: any = {
    user: model(data.users), device: model(data.devices), telemetrySample: model(data.telemetry),
    message: model(data.messages), messageDelivery: model(data.deliveries),
    deviceConfiguration: model(data.configurations), deviceCommand: model(data.commands),
    deviceEvent: model(data.events), firmwareRelease: model(data.firmware), auditLog: model(data.audit),
    async $transaction(actions: Promise<any>[]) { return Promise.all(actions); },
    data
  };
  return store;
}
