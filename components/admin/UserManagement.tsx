"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ManageAccountsRounded from "@mui/icons-material/ManageAccountsRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  allPermissions,
  permissionLabels,
  roleDefinitions,
  type BioflowPermission,
  type BioflowRole,
  type BioflowSessionUser,
} from "@/lib/access-control";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";

type ManagedUser = BioflowSessionUser & {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type DraftUser = {
  username: string;
  password: string;
  name: string;
  role: BioflowRole;
  permissions: BioflowPermission[];
};

const initialDraft: DraftUser = {
  username: "",
  password: "",
  name: "",
  role: "researcher",
  permissions: [...roleDefinitions.researcher.permissions],
};

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftUser>(initialDraft);
  const [savingId, setSavingId] = useState("");
  const enabledCount = useMemo(() => users.filter((user) => user.enabled).length, [users]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await bioflowApi.listUsers();
      setUsers(response.users);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "用户列表加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateUser = async (id: string, patch: Partial<ManagedUser>) => {
    setSavingId(id);
    setError("");
    try {
      const response = await bioflowApi.updateUser({ id, ...patch });
      setUsers(response.users);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "用户权限更新失败"));
    } finally {
      setSavingId("");
    }
  };

  const createUser = async () => {
    setSavingId("new");
    setError("");
    try {
      const response = await bioflowApi.createUser(draft);
      setUsers(response.users);
      setDraft(initialDraft);
      setCreateOpen(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "创建用户失败"));
    } finally {
      setSavingId("");
    }
  };

  return (
    <main className="admin-users-page">
      <header className="admin-users-header">
        <div>
          <span className="admin-eyebrow">
            <AdminPanelSettingsRounded sx={{ fontSize: 17 }} /> 管理员专属
          </span>
          <h1>用户与权限</h1>
          <p>账号角色决定默认权限；单个权限可继续细化，变更会在下次接口请求时生效。</p>
        </div>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>
          新增用户
        </Button>
      </header>

      <section className="admin-summary" aria-label="权限概览">
        <div>
          <b>{users.length}</b>
          <span>全部账号</span>
        </div>
        <div>
          <b>{enabledCount}</b>
          <span>正常启用</span>
        </div>
        <div>
          <b>{users.filter((user) => user.role === "admin").length}</b>
          <span>管理员</span>
        </div>
        <div>
          <b>{allPermissions.length}</b>
          <span>原子权限</span>
        </div>
      </section>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {loading ? (
        <div className="admin-users-loading">正在读取本地加密用户库…</div>
      ) : (
        <section className="admin-user-grid" aria-label="用户列表">
          {users.map((user) => (
            <article className="admin-user-card" key={user.id}>
              <div className="admin-user-title">
                <span className={`admin-user-avatar ${user.role}`}>
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h2>{user.name}</h2>
                  <small>@{user.username}</small>
                </div>
                <Chip
                  size="small"
                  color={user.enabled ? "success" : "default"}
                  icon={user.enabled ? <CheckCircleRounded /> : undefined}
                  label={user.enabled ? "已启用" : "已停用"}
                />
              </div>
              <div className="admin-user-controls">
                <label>
                  <span>角色</span>
                  <Select
                    size="small"
                    value={user.role}
                    disabled={savingId === user.id}
                    onChange={(event) =>
                      void updateUser(user.id, { role: event.target.value as BioflowRole })
                    }
                  >
                    {(Object.keys(roleDefinitions) as BioflowRole[]).map((role) => (
                      <MenuItem key={role} value={role}>
                        {roleDefinitions[role].label}
                      </MenuItem>
                    ))}
                  </Select>
                </label>
                <FormControlLabel
                  control={
                    <Switch
                      checked={user.enabled}
                      disabled={savingId === user.id}
                      onChange={(_, enabled) => void updateUser(user.id, { enabled })}
                    />
                  }
                  label="允许登录"
                />
              </div>
              <div className="admin-permission-list">
                {allPermissions.map((permission) => (
                  <Tooltip key={permission} title={permission} placement="top">
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={user.permissions.includes(permission)}
                          disabled={savingId === user.id}
                          onChange={(_, checked) => {
                            const permissions = checked
                              ? [...user.permissions, permission]
                              : user.permissions.filter((item) => item !== permission);
                            void updateUser(user.id, { permissions });
                          }}
                        />
                      }
                      label={permissionLabels[permission]}
                    />
                  </Tooltip>
                ))}
              </div>
              <footer>
                <span>
                  更新于 {new Date(user.updatedAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
                {savingId === user.id && (
                  <span>
                    <SaveRounded sx={{ fontSize: 14 }} /> 正在保存
                  </span>
                )}
              </footer>
            </article>
          ))}
        </section>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>新增工作区用户</DialogTitle>
        <DialogContent className="admin-create-user">
          <TextField
            label="登录账号"
            value={draft.username}
            onChange={(event) => setDraft({ ...draft, username: event.target.value })}
            fullWidth
          />
          <TextField
            label="显示名称"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            fullWidth
          />
          <TextField
            label="初始密码"
            type="password"
            value={draft.password}
            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
            helperText="至少 8 位；服务端仅持久化 scrypt 哈希。"
            fullWidth
          />
          <label>
            <span>角色模板</span>
            <Select
              value={draft.role}
              fullWidth
              onChange={(event) => {
                const role = event.target.value as BioflowRole;
                setDraft({ ...draft, role, permissions: [...roleDefinitions[role].permissions] });
              }}
            >
              {(Object.keys(roleDefinitions) as BioflowRole[]).map((role) => (
                <MenuItem key={role} value={role}>
                  {roleDefinitions[role].label}：{roleDefinitions[role].description}
                </MenuItem>
              ))}
            </Select>
          </label>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            startIcon={<ManageAccountsRounded />}
            disabled={savingId === "new"}
            onClick={() => void createUser()}
          >
            创建并分配权限
          </Button>
        </DialogActions>
      </Dialog>
    </main>
  );
}
