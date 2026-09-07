"use client";

import { TextField } from "@mui/material";
import type { ChangeEvent, SelectHTMLAttributes } from "react";

export function SelectControl({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <TextField
      select
      className={`select-control ${className}`}
      size="small"
      value={props.value}
      onChange={(event) => props.onChange?.(event as unknown as ChangeEvent<HTMLSelectElement>)}
      disabled={props.disabled}
      slotProps={{
        select: {
          native: true,
          inputProps: { "aria-label": props["aria-label"] },
        },
      }}
      sx={{
        minWidth: 132,
        "& .MuiOutlinedInput-root": {
          height: 34,
          borderRadius: "6px",
          backgroundColor: "#fff",
          color: "#405047",
          fontFamily: "inherit",
          fontSize: 11,
          "& fieldset": { borderColor: "#d0dad4" },
          "&:hover fieldset": { borderColor: "#9eafa5" },
          "&.Mui-focused fieldset": { borderColor: "#84974a", borderWidth: 1 },
        },
        "& select": { paddingBlock: 0, minHeight: "0 !important" },
      }}
    >
      {children}
    </TextField>
  );
}
