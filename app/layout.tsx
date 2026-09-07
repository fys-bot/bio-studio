import "./globals.css";
import "./product.css";
import type { Metadata } from "next";
import { BioFlowThemeProvider } from "@/components/ui/BioFlowThemeProvider";

export const metadata: Metadata = {
  title: "BioFlow Studio",
  description: "Inspectable science workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <BioFlowThemeProvider>{children}</BioFlowThemeProvider>
      </body>
    </html>
  );
}
