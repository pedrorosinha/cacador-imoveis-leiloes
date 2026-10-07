import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Garimpo · Porto Alegre",
  description:
    "Imóveis de Porto Alegre, fontes verificáveis e simulação de retorno.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
