"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { listWorkflowsApiV1WorkflowsGetOptions } from "@repo/api-client";
import { useAuth } from "@/context/AuthContext";
import { ENGINE_BASE_URL } from "@/lib/api";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import {
  Plus,
  Layers,
  Bot,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Activity,
  Download,
  Trash2,
  ShieldCheck,
  Rocket,
  User as UserIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function UserDashboardPage() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: workflows = [], isLoading } = useQuery(
    listWorkflowsApiV1WorkflowsGetOptions()
  );

  // Protected route check
  if (!user && typeof window !== "undefined") {
    router.push("/login");
  }

  const handleExportData = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/api/v1/gdpr/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gdpr_export_${user?.id || "data"}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error("GDPR Export failed:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to permanently delete your account and all associated workflows per GDPR Article 17? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`${ENGINE_BASE_URL}/api/v1/gdpr/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        logout();
        router.push("/");
      }
    } catch (e) {
      console.error("Account deletion failed:", e);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-10 max-w-7xl">
      {/* Unverified Email Warning Banner */}
      {user && !user.is_verified && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/30 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 text-amber-200 text-xs">
          <div className="flex items-center gap-3">
            <UserIcon className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Your email address is not verified.</span> Please check your inbox for the 6-digit verification code sent via Mailtrap.
            </div>
          </div>
          <Link href="/login">
            <Button size="sm" variant="outline" className="gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
              Enter Code / Resend Code <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* User Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-purple-950/50 via-background to-pink-950/40 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs">
                <UserIcon className="h-3.5 w-3.5" /> {user?.email}
              </Badge>
              {user?.is_verified && (
                <Badge variant="outline" className="gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Welcome Back, {user?.full_name || "Automation Engineer"} 👋
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your personal workspace for executing visual DAG agent workflows, smolagent reasoning loops, and isolated Python sandboxes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOnboardingOpen(true)}
              className="gap-2 border-purple-500/30 hover:bg-purple-500/10 text-purple-300"
            >
              <Rocket className="h-4 w-4" /> Onboarding Guide
            </Button>
            <Link href="/workflows">
              <Button size="sm" className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg">
                <Plus className="h-4 w-4" /> New Workflow
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="bg-card/40 backdrop-blur-md border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Workflows</CardTitle>
            <Layers className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{workflows.length}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">+100%</span> active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Executions Run</CardTitle>
            <Activity className="h-4 w-4 text-pink-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">128</div>
            <p className="text-xs text-muted-foreground mt-1 text-emerald-400">Real-time WebSocket active</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-400">99.2%</div>
            <p className="text-xs text-muted-foreground mt-1">Sandbox timeout 5.0s enforced</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Reasoning Engine</CardTitle>
            <Bot className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">smolagents</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono text-[11px]">CodeAgent + OpenRouter</p>
          </CardContent>
        </Card>
      </div>

      {/* User Workflows List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Automation Workflows</h2>
            <p className="text-sm text-muted-foreground">Visual event DAGs created in your studio workspace.</p>
          </div>
          <Link href="/workflows">
            <Button variant="outline" size="sm" className="gap-1.5">
              View All <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <Card className="p-12 text-center border-dashed bg-card/20">
            <CardContent className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">No workflows created yet</h3>
                <p className="text-sm text-muted-foreground">Create your first agentic workflow to start automating tasks.</p>
              </div>
              <Link href="/workflows">
                <Button className="gap-2 bg-purple-600 hover:bg-purple-500">
                  <Plus className="h-4 w-4" /> Create Workflow
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workflows.map((wf: any) => (
              <Card key={wf.id} className="group hover:border-purple-500/50 transition-all duration-200 bg-card/40 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                      {wf.nodes?.length || 0} Nodes
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      {wf.is_active ? "Active" : "Draft"}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-purple-400 transition-colors pt-2">
                    {wf.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {wf.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-2 flex items-center justify-between border-t border-border/40">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="h-3.5 w-3.5" /> {new Date(wf.created_at).toLocaleDateString()}
                  </span>
                  <Link href={`/workflows/${wf.id}`}>
                    <Button size="sm" variant="ghost" className="gap-1 hover:text-purple-400 text-xs">
                      Open Canvas <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* GDPR & Data Privacy Management Section */}
      <Card className="bg-card/40 backdrop-blur-md border-purple-500/20 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-purple-400">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-lg font-bold">GDPR Compliance & Privacy Controls</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage your personal data portability (Article 20) and account erasure rights (Article 17).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Download className="h-4 w-4 text-purple-400" /> Export My Personal Data
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Download a machine-readable JSON archive containing your user profile, created workflows, and execution history per GDPR Article 20.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isExporting}
              onClick={handleExportData}
              className="gap-2 text-xs border-purple-500/30 hover:bg-purple-500/10 text-purple-300"
            >
              <Download className="h-3.5 w-3.5" /> {isExporting ? "Exporting..." : "Download Data (JSON)"}
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 space-y-2">
            <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-400" /> Delete Account & Erase Data
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Permanently delete your profile and erase all created workflow graphs from our servers per GDPR Article 17 ("Right to be Forgotten").
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteAccount}
              className="gap-2 text-xs bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <OnboardingWizard isOpen={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} />
    </div>
  );
}
