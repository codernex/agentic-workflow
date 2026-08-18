"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { PrivacyModal } from "@/components/gdpr/PrivacyModal";
import {
  Bot,
  Sparkles,
  Zap,
  Code,
  ShieldCheck,
  ArrowRight,
  Play,
  Check,
  Layers,
  Activity,
  Mail,
  Lock,
  Globe,
  Database,
  Terminal,
  Cpu,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  const { user } = useAuth();
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [activeSimNode, setActiveSimNode] = useState<string>("agent");

  const simOutputs: Record<string, string> = {
    trigger: JSON.stringify({ event: "user_signup", email: "alex@company.com", tier: "pro" }, null, 2),
    agent: "Thinking: Ingested user_signup event for alex@company.com.\nCalling tool: Format Welcome Package & Calculate Scoring.",
    sandbox: JSON.stringify({ status: "success", lead_score: 95, isolated_process_ms: 14.2 }, null, 2),
    alert: JSON.stringify({ delivered: true, recipient: "alex@company.com", service: "Mailtrap SDK" }, null, 2),
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-purple-500/30">
      {/* Dynamic SEO JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Agentic Workflow Automation Engine",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Linux, macOS, Windows",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            description:
              "Autonomous AI agent execution engine powered by LangChain & LangGraph, isolated Python process sandboxing, and real-time DAG execution visual editor.",
          }),
        }}
      />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24 border-b border-border/40">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-pink-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-6 max-w-6xl text-center relative z-10 space-y-8">
          <Badge variant="outline" className="gap-2 px-4 py-1.5 bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs rounded-full font-mono">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Powered by LangChain & LangGraph & Isolated Python Sandboxes
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight sm:leading-none max-w-4xl mx-auto bg-gradient-to-r from-foreground via-foreground/90 to-purple-400 bg-clip-text">
            Automate Complex Workflows with Autonomous AI Agents
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Design event-driven DAG visual graphs with <code className="text-purple-400 font-mono">LangChain & LangGraph</code> reasoning loops, isolated process Python execution, and Mailtrap email verification.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 text-base px-8 h-12 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-xl shadow-purple-500/25">
                  Go to User Dashboard <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg" className="gap-2 text-base px-8 h-12 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-xl shadow-purple-500/25">
                  Get Started Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            )}
            <Link href="/workflows">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8 h-12 border-purple-500/30 hover:bg-purple-500/10 text-purple-300">
                <Play className="h-4 w-4" /> Explore Visual Canvas
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* INTERACTIVE WORKFLOW NODE DEMO SIMULATOR */}
      <section className="py-16 bg-muted/20 border-b border-border/40">
        <div className="container mx-auto px-6 max-w-6xl space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Interactive Visual DAG Execution Engine</h2>
            <p className="text-sm text-muted-foreground">Click any node below to inspect real-time data passing and agent reasoning output.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { id: "trigger", title: "Manual / Webhook Trigger", icon: Zap, type: "Trigger Node", color: "purple" },
              { id: "agent", title: "LangGraph AI Agent", icon: Bot, type: "Reasoning Node", color: "pink" },
              { id: "sandbox", title: "Python Process Sandbox", icon: Code, type: "Isolated Execution", color: "blue" },
              { id: "alert", title: "Mailtrap Email Alert", icon: Mail, type: "Integration Node", color: "emerald" },
            ].map((node) => {
              const Icon = node.icon;
              const isActive = activeSimNode === node.id;
              return (
                <Card
                  key={node.id}
                  onClick={() => setActiveSimNode(node.id)}
                  className={`cursor-pointer transition-all duration-200 border bg-card/60 backdrop-blur-md ${
                    isActive ? "border-purple-500 ring-2 ring-purple-500/30 scale-[1.03]" : "hover:border-purple-500/40"
                  }`}
                >
                  <CardHeader className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">{node.type}</Badge>
                      <Icon className={`h-4 w-4 text-${node.color}-400`} />
                    </div>
                    <CardTitle className="text-sm pt-1">{node.title}</CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* SIMULATOR INSPECTOR OUTPUT BOX */}
          <Card className="bg-black/60 border-purple-500/30 font-mono text-xs overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border/40 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                <Terminal className="h-3.5 w-3.5" /> Inspector Payload — [{activeSimNode.toUpperCase()}]
              </span>
              <span className="text-emerald-400 font-medium">● Step Completed (12ms)</span>
            </div>
            <div className="p-4 overflow-x-auto text-purple-200 leading-relaxed">
              <pre>{simOutputs[activeSimNode]}</pre>
            </div>
          </Card>
        </div>
      </section>

      {/* CORE PRODUCT FEATURES GRID */}
      <section className="py-20 border-b border-border/40">
        <div className="container mx-auto px-6 max-w-6xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Built for Secure AI Agent Automation</h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Everything you need to orchestrate LLMs, execute python snippets, and trigger webhooks safely.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-card/40 border-purple-500/20 backdrop-blur-md hover:border-purple-500/50 transition-all">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Bot className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">LangChain & LangGraph</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Utilizes <code className="text-purple-400 font-mono">create_react_agent</code> with LangChain models to plan, execute python tools, and solve complex multi-step tasks.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/40 border-purple-500/20 backdrop-blur-md hover:border-purple-500/50 transition-all">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Isolated Python Sandbox</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Runs Python code blocks in isolated <code className="text-blue-400 font-mono">multiprocessing.Process</code> workers with builtins whitelist and 5.0s timeout limit.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/40 border-purple-500/20 backdrop-blur-md hover:border-purple-500/50 transition-all">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
                  <Mail className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Mailtrap Email SDK</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Authenticates users with 6-digit email verification codes delivered via official Mailtrap Python SDK using responsive HTML templates.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/40 border-purple-500/20 backdrop-blur-md hover:border-purple-500/50 transition-all">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Zap className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Event-Driven Webhooks</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Trigger workflow executions automatically via custom POST webhook URLs with real-time JSON payload ingestion.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/40 border-purple-500/20 backdrop-blur-md hover:border-purple-500/50 transition-all">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Layers className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Selective Data Forwarding</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Selectively project specific dictionary keys from upstream node outputs before forwarding to downstream agent blocks.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/40 border-purple-500/20 backdrop-blur-md hover:border-purple-500/50 transition-all">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">GDPR Article 17 & 20</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Full data portability export (downloadable JSON user archive) and 1-click permanent account erasure rights.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="py-20 border-b border-border/40 bg-muted/10">
        <div className="container mx-auto px-6 max-w-5xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Flexible Developer Pricing</h2>
            <p className="text-muted-foreground text-sm">Start building for free or scale your agentic automation pipeline.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-card/60 backdrop-blur-xl border-border/60 p-6 space-y-6">
              <div>
                <Badge variant="outline" className="text-xs mb-2">Community</Badge>
                <h3 className="text-2xl font-bold">Developer Free</h3>
                <div className="text-4xl font-extrabold pt-2">$0 <span className="text-xs text-muted-foreground font-normal">/ month</span></div>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> Unlimited Visual DAG Graphs</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> Isolated Process Python Sandbox</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> Mailtrap Email Verification</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> Real-time WebSocket Execution Logs</li>
              </ul>
              <Link href="/login" className="block">
                <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold">Get Started Free</Button>
              </Link>
            </Card>

            <Card className="bg-gradient-to-b from-purple-950/40 via-card to-pink-950/30 border-purple-500/40 p-6 space-y-6 relative overflow-hidden shadow-2xl">
              <Badge className="absolute top-4 right-4 bg-purple-500 text-white text-[10px] uppercase font-bold">Popular</Badge>
              <div>
                <Badge variant="outline" className="text-xs mb-2 border-purple-500/30 text-purple-300">Team Studio</Badge>
                <h3 className="text-2xl font-bold">Pro Agentic</h3>
                <div className="text-4xl font-extrabold pt-2">$49 <span className="text-xs text-muted-foreground font-normal">/ month</span></div>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> Priority OpenRouter LLM Tokens</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> Custom Python Tool Extensions</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> GDPR Automated Compliance Export</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-emerald-400" /> 24/7 Dedicated Engine Support</li>
              </ul>
              <Link href="/login" className="block">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg">Upgrade to Pro</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-border/40 bg-background text-xs text-muted-foreground">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400 font-bold">
              <Bot className="h-4 w-4" />
            </div>
            <span className="font-bold text-foreground">Agentic Workflow Engine</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="hover:text-purple-400 transition-colors"
            >
              Privacy Policy & GDPR
            </button>
            <Link href="/login" className="hover:text-purple-400 transition-colors">
              Sign In
            </Link>
            <Link href="/workflows" className="hover:text-purple-400 transition-colors">
              Workflows
            </Link>
          </div>

          <p>© {new Date().getFullYear()} Agentic Workflow Engine. All rights reserved.</p>
        </div>
      </footer>

      <PrivacyModal isOpen={isPrivacyModalOpen} onOpenChange={setIsPrivacyModalOpen} />
    </div>
  );
}
