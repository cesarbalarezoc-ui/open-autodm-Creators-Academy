import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import { AppProviders } from "@/components/providers/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PROSPECTOR AI",
  description:
    "Plataforma inteligente de automatización de Instagram. Gestiona tus mensajes, comentarios, contactos y oportunidades desde un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${bricolage.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}
      >
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}