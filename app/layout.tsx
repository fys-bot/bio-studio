import "./globals.css";
import "./product.css";
import "./ui-contract.css";
import type { Metadata } from "next";
import { AuthSessionGate } from "@/components/auth/AuthSessionGate";
import { BioFlowThemeProvider } from "@/components/ui/BioFlowThemeProvider";
import { GlobalApiFeedback } from "@/components/ui/GlobalApiFeedback";

export const metadata: Metadata = {
  title: "BioFlow Studio",
  description: "Inspectable science workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <BioFlowThemeProvider>
          <AuthSessionGate>{children}</AuthSessionGate>
          <GlobalApiFeedback />
        </BioFlowThemeProvider>
      </body>
    </html>
  );
}
