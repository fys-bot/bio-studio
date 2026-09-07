"use client";

import { Pagination, PaginationItem } from "@mui/material";

export function CatalogPagination({
  page,
  count,
  label,
  onChange,
}: {
  page: number;
  count: number;
  label: string;
  onChange: (page: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <nav className="catalog-pagination mui-pagination" aria-label={label}>
      <Pagination
        page={page}
        count={count}
        onChange={(_, nextPage) => onChange(nextPage)}
        size="small"
        siblingCount={0}
        boundaryCount={1}
        getItemAriaLabel={(type, itemPage, selected) => {
          if (type === "previous") return "上一页";
          if (type === "next") return "下一页";
          if (type === "first") return "第一页";
          if (type === "last") return "最后一页";
          return selected ? `当前第 ${itemPage} 页` : `前往第 ${itemPage} 页`;
        }}
        renderItem={(item) => (
          <PaginationItem
            {...item}
            slots={{ previous: undefined, next: undefined }}
            sx={{
              minWidth: 32,
              height: 32,
              borderRadius: "6px",
              border: "1px solid #cad5ce",
              color: "#3f5b4d",
              fontSize: 11,
              "&.Mui-selected": {
                borderColor: "#93a327",
                backgroundColor: "#eef3c8",
                color: "#52610e",
              },
            }}
          />
        )}
      />
    </nav>
  );
}
