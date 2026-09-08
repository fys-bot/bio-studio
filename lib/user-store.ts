import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  roleDefinitions,
  type BioflowPermission,
  type BioflowRole,
  type BioflowSessionUser,
} from "@/lib/access-control";

type StoredUser = BioflowSessionUser & {
  passwordHash: string;
  passwordSalt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedUser = BioflowSessionUser & {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserStore = { version: 1 | 2; users: StoredUser[] };

const storePath = () =>
  path.join(
    process.env.BIOFLOW_DATA_DIR || path.join(process.cwd(), "data", "runtime"),
    "auth-users.json",
  );

const bootstrapAccounts: Array<{
  id: string;
  username: string;
  password: string;
  name: string;
  role: BioflowRole;
}> = [
  {
    id: "user-researcher-demo",
    username: process.env.BIOFLOW_DEMO_USER || "researcher",
    password: process.env.BIOFLOW_DEMO_PASSWORD || "bioflow2026",
    name: "DF 研究员",
    role: "researcher",
  },
  {
    id: "user-reviewer-demo",
    username: process.env.BIOFLOW_REVIEWER_USER || "reviewer",
    password: process.env.BIOFLOW_REVIEWER_PASSWORD || "review2026",
    name: "QA 审阅者",
    role: "reviewer",
  },
  {
    id: "user-admin-demo",
    username: process.env.BIOFLOW_ADMIN_USER || "admin",
    password: process.env.BIOFLOW_ADMIN_PASSWORD || "admin2026",
    name: "BioFlow 管理员",
    role: "admin",
  },
];

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("base64url");
}

function storedUser(input: (typeof bootstrapAccounts)[number]): StoredUser {
  const now = new Date().toISOString();
  const passwordSalt = randomBytes(18).toString("base64url");
  return {
    id: input.id,
    username: input.username,
    name: input.name,
    role: input.role,
    permissions: [...roleDefinitions[input.role].permissions],
    passwordHash: hashPassword(input.password, passwordSalt),
    passwordSalt,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function writeStore(store: UserStore) {
  const target = storePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function readStore(): UserStore {
  const target = storePath();
  try {
    const parsed = JSON.parse(fs.readFileSync(target, "utf8")) as UserStore;
    if ((parsed.version === 1 || parsed.version === 2) && Array.isArray(parsed.users)) {
      if (parsed.version === 1) {
        // 仅迁移默认研究员一次，不覆盖管理员为其他用户做出的细粒度权限调整。
        const defaultResearcher = parsed.users.find(
          (user) => user.id === "user-researcher-demo" && user.role === "researcher",
        );
        if (defaultResearcher && !defaultResearcher.permissions.includes("skills:write")) {
          defaultResearcher.permissions = [...defaultResearcher.permissions, "skills:write"];
          defaultResearcher.updatedAt = new Date().toISOString();
        }
        parsed.version = 2;
        writeStore(parsed);
      }
      return parsed;
    }
  } catch {
    // 首次启动或损坏时重新建立演示账号；运行目录不会提交到 Git。
  }
  const created = { version: 2 as const, users: bootstrapAccounts.map(storedUser) };
  writeStore(created);
  return created;
}

function publicUser(user: StoredUser): ManagedUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safe } = user;
  return safe;
}

function normalizedUsername(username: string) {
  return username.trim().toLowerCase();
}

export function listUsers() {
  return readStore()
    .users.map(publicUser)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function findManagedUserById(id: string) {
  const user = readStore().users.find((item) => item.id === id);
  return user ? publicUser(user) : null;
}

export function findManagedUserByUsername(username: string) {
  const target = normalizedUsername(username);
  const user = readStore().users.find((item) => normalizedUsername(item.username) === target);
  return user ? publicUser(user) : null;
}

export function verifyUserPassword(username: string, password: string) {
  const target = normalizedUsername(username);
  const user = readStore().users.find((item) => normalizedUsername(item.username) === target);
  if (!user) return { status: "not_found" as const };
  const actual = Buffer.from(hashPassword(password, user.passwordSalt));
  const expected = Buffer.from(user.passwordHash);
  const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
  return valid
    ? { status: "valid" as const, user: publicUser(user) }
    : { status: "wrong_password" as const };
}

function validateUsername(username: string) {
  const normalized = normalizedUsername(username);
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(normalized)) {
    throw new Error("账号需为 3-32 位小写字母、数字、点、下划线或短横线");
  }
  return normalized;
}

function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) throw new Error("密码长度需为 8-128 位");
}

export function createManagedUser(input: {
  username: string;
  password: string;
  name: string;
  role: BioflowRole;
  permissions?: BioflowPermission[];
  enabled?: boolean;
}) {
  const store = readStore();
  const username = validateUsername(input.username);
  validatePassword(input.password);
  if (store.users.some((user) => normalizedUsername(user.username) === username)) {
    throw new Error("该账号已经存在");
  }
  const name = input.name.trim().slice(0, 48);
  if (!name) throw new Error("显示名称不能为空");
  const passwordSalt = randomBytes(18).toString("base64url");
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: `user-${randomBytes(10).toString("hex")}`,
    username,
    name,
    role: input.role,
    permissions: input.permissions?.length
      ? [...new Set(input.permissions)]
      : [...roleDefinitions[input.role].permissions],
    passwordHash: hashPassword(input.password, passwordSalt),
    passwordSalt,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(user);
  writeStore(store);
  return publicUser(user);
}

export function updateManagedUser(
  id: string,
  input: {
    name?: string;
    role?: BioflowRole;
    permissions?: BioflowPermission[];
    enabled?: boolean;
    password?: string;
  },
) {
  const store = readStore();
  const user = store.users.find((item) => item.id === id);
  if (!user) throw new Error("用户不存在");
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 48);
    if (!name) throw new Error("显示名称不能为空");
    user.name = name;
  }
  if (input.role) {
    user.role = input.role;
    user.permissions = [...roleDefinitions[input.role].permissions];
  }
  if (input.permissions) user.permissions = [...new Set(input.permissions)];
  if (input.enabled !== undefined) user.enabled = input.enabled;
  if (input.password) {
    validatePassword(input.password);
    user.passwordSalt = randomBytes(18).toString("base64url");
    user.passwordHash = hashPassword(input.password, user.passwordSalt);
  }
  user.updatedAt = new Date().toISOString();
  writeStore(store);
  return publicUser(user);
}
