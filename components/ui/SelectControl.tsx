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
      variant="outlined"
      value={props.value}
      onChange={(event) => props.onChange?.(event as unknown as ChangeEvent<HTMLSelectElement>)}
      disabled={props.disabled}
      required={props.required}
      name={props.name}
      inputProps={{ "aria-label": props["aria-label"] }}
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320, mt: 0.5 } } } }}
      sx={{
        minWidth: 132,
        width: "100%",
        height: 36,
        border: 0,
        outline: 0,
        boxShadow: "none",
      }}
    >
      {Children.toArray(children).map((child) => {
        if (!isValidElement<{ value?: string; children?: ReactNode }>(child)) return child;
        const value = child.props.value ?? String(child.props.children ?? "");
        return (
          <MenuItem key={String(value)} value={value}>
            {child.props.children}
          </MenuItem>
        );
      })}
    </Select>
  );
}
