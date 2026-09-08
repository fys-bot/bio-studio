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
    fontSize: 12,
    button: { fontWeight: 600, letterSpacing: 0, textTransform: "none" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 34,
          gap: 0,
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 11,
          lineHeight: 1.35,
        },
        startIcon: { marginRight: 4, marginLeft: 0 },
        endIcon: { marginRight: 0, marginLeft: 4 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          width: 32,
          height: 32,
          padding: 6,
          borderRadius: 6,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 36,
          borderRadius: 6,
          backgroundColor: "#ffffff",
          color: "#34443b",
          fontSize: 11,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#d2dcd6",
            borderWidth: 1,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#a9bbb0" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#87994b",
            borderWidth: 1,
          },
        },
        input: { padding: "8px 10px" },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          display: "flex",
          minHeight: "0 !important",
          alignItems: "center",
          padding: "7px 32px 7px 10px !important",
          border: "0 !important",
          outline: "0 !important",
          boxShadow: "none !important",
        },
        icon: { right: 7, color: "#68776f" },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          marginTop: 4,
          border: "1px solid #d6dfda",
          borderRadius: 7,
          boxShadow: "0 16px 36px rgba(38, 51, 44, 0.16)",
        },
        list: { padding: 4 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 34,
          borderRadius: 5,
          color: "#405047",
          fontSize: 11,
          "&.Mui-selected": { backgroundColor: "#eef2d5" },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 34,
          padding: "5px 9px",
          borderColor: "#d2dcd6",
          color: "#5e6d65",
          fontSize: 10,
          letterSpacing: 0,
          textTransform: "none",
          "&.Mui-selected": {
            borderColor: "#b8c86b",
            backgroundColor: "#eff3d2",
            color: "#566511",
          },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 500 },
      styleOverrides: {
        tooltip: { fontSize: 10, lineHeight: 1.35 },
      },
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
