"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Bot, Layers, Key, Wrench, Sparkles, Activity, LogOut, User as UserIcon, CheckCircle2, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: user ? "/dashboard" : "/", label: user ? "Dashboard" : "Home", icon: Activity },
    { href: "/workflows", label: "Workflows", icon: Layers },
    { href: "/credentials", label: "Credentials", icon: Key },
    { href: "/tools", label: "Tools Registry", icon: Wrench },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center px-6 justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 p-0.5 shadow-lg group-hover:scale-105 transition-transform duration-200">
              <div className="h-full w-full bg-background rounded-[10px] flex items-center justify-center">
                <Bot className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-lg leading-none bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
                Agentic Workflow
              </span>
              <span className="text-[11px] text-muted-foreground font-mono leading-tight flex items-center gap-1 mt-0.5">
                <Sparkles className="h-3 w-3 text-purple-400" /> LangGraph engine
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 ml-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-2 text-sm font-medium transition-colors ${
                      isActive ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Status Indicator */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs hidden sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Engine Online
          </Badge>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-border/40">
              <div className="flex flex-col text-right hidden md:block">
                <span className="text-xs font-semibold leading-tight">{user.full_name || user.email}</span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center justify-end gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={logout} className="gap-1.5 text-xs text-muted-foreground hover:text-rose-400">
                <LogOut className="h-3.5 w-3.5" /> Log Out
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm" className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-sm">
                <LogIn className="h-3.5 w-3.5" /> Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
