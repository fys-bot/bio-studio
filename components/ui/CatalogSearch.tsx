"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { IconButton, InputAdornment, TextField } from "@mui/material";

type CatalogSearchProps = {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
};

/** 能力中心与文件中心共享的目录搜索控件。 */
export function CatalogSearch({ value, placeholder, ariaLabel, onChange }: CatalogSearchProps) {
  return (
    <TextField
      className="catalog-search"
      fullWidth
      size="small"
      variant="outlined"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      slotProps={{
        htmlInput: { "aria-label": `搜索${ariaLabel}` },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded sx={{ fontSize: 18 }} aria-hidden="true" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                className="catalog-search-clear"
                size="small"
                edge="end"
                onClick={() => onChange("")}
                aria-label={`清除${ariaLabel}搜索`}
                title="清除搜索"
              >
                <CloseRounded sx={{ fontSize: 17 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          height: 40,
          borderRadius: "6px",
          backgroundColor: "#fff",
          color: "#24312a",
          fontFamily: "inherit",
          fontSize: "12px",
          transition: "box-shadow 150ms ease",
          "& fieldset": { borderColor: "#d5ddd8" },
          "&:hover fieldset": { borderColor: "#aabbb1" },
          "&.Mui-focused": { boxShadow: "0 0 0 2px #b9d2c455" },
          "&.Mui-focused fieldset": { borderColor: "#8fa899", borderWidth: "1px" },
        },
        "& .MuiInputAdornment-root": { color: "#708078" },
        "& .MuiInputBase-input": {
          height: "100%",
          minHeight: 0,
          boxSizing: "border-box",
          padding: "0 2px",
          border: "0 !important",
          borderRadius: 0,
          backgroundColor: "transparent",
          boxShadow: "none !important",
        },
        "& .MuiInputBase-input::placeholder": { color: "#849088", opacity: 1 },
      }}
    />
  );
}
