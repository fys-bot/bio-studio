"use client";

import { MenuItem, Select } from "@mui/material";
import {
  Children,
  isValidElement,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export function SelectControl({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Select
      className={`select-control ${className}`}
      size="small"
      value={props.value}
      onChange={(event) => props.onChange?.(event as unknown as ChangeEvent<HTMLSelectElement>)}
      disabled={props.disabled}
      required={props.required}
      name={props.name}
      inputProps={{ "aria-label": props["aria-label"] }}
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320, mt: 0.5 } } } }}
      sx={{
        minWidth: 132,
        height: 34,
        borderRadius: "6px",
        backgroundColor: "#fff",
        color: "#405047",
        fontFamily: "inherit",
        fontSize: 11,
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d0dad4" },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#9eafa5" },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "#84974a",
          borderWidth: 1,
        },
        "& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          minHeight: "0 !important",
          paddingBlock: 0,
          border: "0 !important",
          boxShadow: "none !important",
        },
      }}
    >
      {Children.toArray(children).map((child) => {
        if (!isValidElement<{ value?: string; children?: ReactNode }>(child)) return child;
        const value = child.props.value ?? String(child.props.children ?? "");
        return <MenuItem value={value}>{child.props.children}</MenuItem>;
      })}
    </Select>
  );
}
