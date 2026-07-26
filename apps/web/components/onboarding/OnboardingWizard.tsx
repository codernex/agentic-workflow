"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Sparkles, Rocket, ArrowRight, CheckCircle2, Layers, Code, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface OnboardingWizardProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ isOpen, onOpenChange }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("My Agentic Studio");
  const [selectedGoal, setSelectedGoal] = useState<string>("smolagent");

  const goals = [
    {
      id: "smolagent",
      title: "Hugging Face smolagents AI",
      desc: "Autonomous CodeAgent reasoning with OpenRouter & OpenAI models",
      icon: Bot,
      color: "border-purple-500/40 bg-purple-950/20 text-purple-300",
    },
    {
      id: "python_sandbox",
      title: "Isolated Python Subprocess",
      desc: "Run Python snippets inside isolated process sandboxes",
      icon: Code,
      color: "border-blue-500/40 bg-blue-950/20 text-blue-300",
    },
    {
      id: "webhook_triggers",
      title: "Event-Driven Webhooks",
      desc: "Trigger workflow DAGs from Stripe, GitHub, or REST POST requests",
      icon: Zap,
      color: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
    },
  ];

  const handleFinishOnboarding = () => {
    onOpenChange(false);
    router.push("/workflows");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card/95 backdrop-blur-xl border-purple-500/30 shadow-2xl">
        <DialogHeader className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 p-0.5 shadow-lg flex items-center justify-center">
            <div className="h-full w-full bg-background rounded-[14px] flex items-center justify-center">
              <Rocket className="h-6 w-6 text-purple-400" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-extrabold tracking-tight">
            Welcome to Agentic Workflow
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Step {step} of 3 — Set up your AI agent execution workspace
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: WORKSPACE NAME */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Workspace Name</label>
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Production AI Studio"
                className="text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Workflows, credentials, and custom python execution tools will be organized under this workspace environment.
            </p>
            <Button
              onClick={() => setStep(2)}
              className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold"
            >
              Continue to Agent Goals <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: SELECT GOAL */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <label className="text-xs font-semibold text-foreground">Select Primary Engine Capability</label>
            <div className="grid grid-cols-1 gap-3">
              {goals.map((g) => {
                const Icon = g.icon;
                const isSelected = selectedGoal === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGoal(g.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? "border-purple-500 bg-purple-500/10 shadow-md"
                        : "border-border/60 bg-card/40 hover:border-purple-500/30"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-background border flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold">{g.title}</h4>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-purple-400" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{g.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold"
              >
                Review Starter Template <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMATION & LAUNCH */}
        {step === 3 && (
          <div className="space-y-4 pt-2 text-center">
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/20 space-y-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs">
                <Sparkles className="h-3 w-3 mr-1" /> Ready to Automate
              </Badge>
              <h3 className="text-lg font-bold text-foreground">{workspaceName} Initialized</h3>
              <p className="text-xs text-muted-foreground">
                Your workspace is configured with Hugging Face <code className="text-purple-400 font-mono">smolagents</code> reasoning loops, isolated Python execution sandboxing, and Mailtrap email verification.
              </p>
            </div>
            <Button
              onClick={handleFinishOnboarding}
              className="w-full gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-sm shadow-xl"
            >
              <Layers className="h-4 w-4" /> Launch Canvas Studio
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
