"use client";

import BiotechOutlined from "@mui/icons-material/BiotechOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { LoginMoleculeScene } from "@/components/auth/LoginMoleculeScene";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("researcher");
  const [password, setPassword] = useState("bioflow2026");
  const [passwordVisible, setPasswordVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await bioflowApi.login({ username, password });
      const next = searchParams.get("next");
      router.replace(
        next?.startsWith("/") ? next : "/projects/proj_a5211690a4/tasks/task_demo_rnaseq",
      );
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, "登录失败，请检查本地服务"));
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <LoginMoleculeScene />
      <section className="login-context" aria-label="BioFlow 产品说明">
        <span className="login-brand-mark">
          <BiotechOutlined />
        </span>
        <div>
          <small>BIOFLOW STUDIO</small>
          <h1>生命科学智能分析工作台</h1>
          <p>从真实文档、证据检索到可审计工作流与统计计算，在一个研究上下文中完成。</p>
        </div>
        <ul>
          <li>多模态文档解析与 RAG 证据链</li>
          <li>可审批、可恢复的智能体工作流</li>
          <li>DESeq2 真实计算与结果血缘</li>
        </ul>
      </section>
      <section className="login-panel" aria-label="登录 BioFlow">
        <div className="login-panel-head">
          <span>
            <ScienceOutlined />
          </span>
          <div>
            <small>研究人员入口</small>
            <h2>进入工作区</h2>
          </div>
        </div>
        <form onSubmit={submit}>
          <TextField
            label="账号"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="密码"
            type={passwordVisible ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={passwordVisible ? "隐藏演示密码" : "显示演示密码"}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      {passwordVisible ? (
                        <VisibilityOffOutlined fontSize="small" />
                      ) : (
                        <VisibilityOutlined fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
            {loading && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
            {loading ? "正在验证令牌…" : "登录并进入工作台"}
          </Button>
        </form>
        <div className="login-demo-note">
          <b>面试演示账号已预填</b>
          <span>账号 researcher · 密码 bioflow2026 · 服务重启后需重新登录。</span>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page login-page-loading" role="status" aria-live="polite">
          <LoginMoleculeScene />
          <div className="login-route-loading">
            <CircularProgress size={20} />
            <span>正在准备研究工作区</span>
          </div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
