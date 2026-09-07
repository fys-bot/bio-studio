"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#5f6f16", contrastText: "#ffffff" },
    secondary: { main: "#287665" },
    error: { main: "#b2463a" },
    background: { default: "#f5f7f5", paper: "#ffffff" },
    text: { primary: "#26332c", secondary: "#66736b" },
    divider: "#d9e0dc",
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { fontWeight: 600, letterSpacing: 0, textTransform: "none" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 34, fontSize: 12 } },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 500 },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: "1px solid #d4ddd7",
          boxShadow: "0 24px 70px rgba(35, 50, 42, 0.22)",
        },
      },
    },
  },
});

export function BioFlowThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
