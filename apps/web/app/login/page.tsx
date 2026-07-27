"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Bot, Sparkles, Mail, Lock, User as UserIcon, KeyRound, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "register" | "verify";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, verifyEmail, resendVerificationCode, user } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendCode = async () => {
    if (!email) {
      setError("Please enter your email address to resend the verification code.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await resendVerificationCode(email);
      setSuccessMsg(`New 6-digit verification code sent to ${email} via Mailtrap!`);
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Redirect if user is already authenticated
  if (user && mode !== "verify") {
    router.push("/workflows");
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await login(email, password);
      router.push("/workflows");
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("not verified")) {
        setError("Your email address is not verified yet. Enter your verification code below.");
        setMode("verify");
      } else {
        setError(err.message || "Failed to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await register(email, password, fullName);
      setSuccessMsg(`Account created! We've sent a 6-digit verification code to ${email} via Mailtrap.`);
      setMode("verify");
    } catch (err: any) {
      setError(err.message || "Registration failed. Email may already be registered.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await verifyEmail(email, verificationCode);
      setSuccessMsg("Email verified successfully! You can now log in.");
      setVerificationCode("");
      setMode("login");
    } catch (err: any) {
      setError(err.message || "Invalid verification code. Please check your Mailtrap inbox.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-purple-500/20 shadow-2xl relative z-10">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 p-0.5 shadow-lg flex items-center justify-center">
            <div className="h-full w-full bg-background rounded-[14px] flex items-center justify-center">
              <Bot className="h-6 w-6 text-purple-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {mode === "login" && "Welcome Back"}
            {mode === "register" && "Create an Account"}
            {mode === "verify" && "Verify Email Address"}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {mode === "login" && "Sign in to manage visual agentic workflows & executions."}
            {mode === "register" && "Get started with smolagents AI workflow automation engine."}
            {mode === "verify" && `Enter the 6-digit code sent via Mailtrap to ${email || "your email"}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/40 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in-0 duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs flex items-start gap-2 animate-in fade-in-0 duration-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Quick Demo Credentials Button */}
              <div className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-950/20 flex items-center justify-between text-xs text-purple-300">
                <div>
                  <span className="font-semibold block text-[11px] text-purple-200">Demo Account:</span>
                  <span className="font-mono text-[10px] text-muted-foreground">borhan.dev@gmail.com • 123456</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-purple-500/30 hover:bg-purple-500/10 cursor-pointer"
                  onClick={() => {
                    setEmail("borhan.dev@gmail.com");
                    setPassword("123456");
                  }}
                >
                  <Sparkles className="h-3 w-3 text-purple-400" /> Use Demo
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    placeholder="user@example.com"
                    className="pl-9 text-xs"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="pl-9 text-xs"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Jane Doe"
                    className="pl-9 text-xs"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    placeholder="user@example.com"
                    className="pl-9 text-xs"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="pl-9 text-xs"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register & Send Code"}
                {!loading && <Sparkles className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {/* VERIFY EMAIL FORM */}
          {mode === "verify" && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  required
                  className="text-xs font-mono bg-muted/40"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">6-Digit Verification Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
                  <Input
                    required
                    maxLength={6}
                    placeholder="123456"
                    className="pl-9 text-base tracking-widest font-mono text-center text-purple-300 font-bold bg-black/40 border-purple-500/40"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Email"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col border-t border-border/40 pt-4 space-y-2 text-center text-xs">
          {mode === "login" && (
            <p className="text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("register"); setError(null); setSuccessMsg(null); }}
                className="text-purple-400 hover:underline font-semibold"
              >
                Sign up
              </button>
            </p>
          )}
          {mode === "register" && (
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
                className="text-purple-400 hover:underline font-semibold"
              >
                Sign in
              </button>
            </p>
          )}
          {mode === "verify" && (
            <div className="flex items-center justify-between w-full text-xs">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Back to Sign in
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendCode}
                className="text-purple-400 hover:underline font-semibold disabled:opacity-50 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Re-send Code"}
              </button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
