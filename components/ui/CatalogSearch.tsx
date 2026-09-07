"use client";

import { Search, X } from "lucide-react";

type CatalogSearchProps = {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
};

/** 能力中心与文件中心共享的目录搜索控件。 */
export function CatalogSearch({ value, placeholder, ariaLabel, onChange }: CatalogSearchProps) {
  return (
    <label className="catalog-search">
      <Search size={15} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label={`清除${ariaLabel}`}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}
