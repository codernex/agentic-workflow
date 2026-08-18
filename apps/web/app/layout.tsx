import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "@/app/providers";
import { CookieConsent } from "@/components/gdpr/CookieConsent";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Agentic Workflow Automation Engine | AI Agents & Python Sandboxes",
  description:
    "Design event-driven DAG visual graphs with LangChain & LangGraph reasoning loops, isolated process Python execution, and Mailtrap email verification.",
  keywords: [
    "AI Agent Automation",
    "LangChain & LangGraph",
    "Python Sandbox Execution",
    "Visual DAG Workflow Editor",
    "Event-Driven Webhook Engine",
    "LangGraph ReAct Agent",
  ],
  authors: [{ name: "Agentic Workflow Team" }],
  openGraph: {
    title: "Agentic Workflow Automation Engine",
    description:
      "Autonomous AI agent execution engine powered by LangChain & LangGraph, isolated Python process sandboxing, and real-time DAG visual canvas editor.",
    type: "website",
    locale: "en_US",
    siteName: "Agentic Workflow",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentic Workflow Automation Engine",
    description:
      "Autonomous AI agent execution engine powered by LangChain & LangGraph and isolated Python sandboxes.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-purple-500/30">
        <Providers>
          <TooltipProvider>
            <Navbar />
            <main>{children}</main>
            <CookieConsent />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
