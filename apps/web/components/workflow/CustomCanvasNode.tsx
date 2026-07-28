"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Zap, Bot, Code, Globe, GitFork, Play, Database, Mail, Filter, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CustomNodeData {
  label: string;
  type: "trigger" | "agent" | "code" | "http_request" | "condition" | "database" | "email" | "filter" | "logger" | string;
  trigger_type?: string;
  prompt?: string;
  code?: string;
  url?: string;
  status?: "pending" | "running" | "completed" | "failed";
}

const nodeTypeConfig: Record<string, { label: string; icon: any; color: string; bgClass: string; borderClass: string }> = {
  trigger: {
    label: "Trigger",
    icon: Zap,
    color: "#c084fc",
    bgClass: "bg-purple-950/40",
    borderClass: "border-purple-500/40 hover:border-purple-500",
  },
  agent: {
    label: "smolagent AI",
    icon: Bot,
    color: "#f472b6",
    bgClass: "bg-pink-950/40",
    borderClass: "border-pink-500/40 hover:border-pink-500",
  },
  code: {
    label: "Python Code",
    icon: Code,
    color: "#60a5fa",
    bgClass: "bg-blue-950/40",
    borderClass: "border-blue-500/40 hover:border-blue-500",
  },
  logger: {
    label: "Step Logger",
    icon: Terminal,
    color: "#2dd4bf",
    bgClass: "bg-teal-950/40",
    borderClass: "border-teal-500/40 hover:border-teal-500",
  },
  http_request: {
    label: "HTTP Request",
    icon: Globe,
    color: "#34d399",
    bgClass: "bg-emerald-950/40",
    borderClass: "border-emerald-500/40 hover:border-emerald-500",
  },
  condition: {
    label: "Condition",
    icon: GitFork,
    color: "#fbbf24",
    bgClass: "bg-amber-950/40",
    borderClass: "border-amber-500/40 hover:border-amber-500",
  },
  database: {
    label: "Database",
    icon: Database,
    color: "#38bdf8",
    bgClass: "bg-sky-950/40",
    borderClass: "border-sky-500/40 hover:border-sky-500",
  },
  email: {
    label: "Email Alert",
    icon: Mail,
    color: "#fb7185",
    bgClass: "bg-rose-950/40",
    borderClass: "border-rose-500/40 hover:border-rose-500",
  },
  filter: {
    label: "Data Filter",
    icon: Filter,
    color: "#a855f7",
    bgClass: "bg-purple-950/40",
    borderClass: "border-purple-500/40 hover:border-purple-500",
  },
};

export const CustomCanvasNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as CustomNodeData;
  const config = nodeTypeConfig[nodeData.type] || {
    label: nodeData.type || "Node",
    icon: Play,
    color: "#6b7280",
    bgClass: "bg-neutral-900",
    borderClass: "border-neutral-700",
  };
  const Icon = config.icon;

  return (
    <div
      className={`relative min-w-[240px] rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 ${config.bgClass} ${config.borderClass} ${
        selected ? "ring-2 ring-purple-500 shadow-purple-500/20" : ""
      }`}
    >
      {/* Target Handle (Input) */}
      {nodeData.type !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-background !bg-purple-400"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-lg flex items-center justify-center shadow-md"
            style={{ backgroundColor: `${config.color}25`, color: config.color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-foreground leading-tight">
              {nodeData.label}
            </h4>
            <span className="text-[11px] text-muted-foreground font-mono">{config.label}</span>
          </div>
        </div>

        {/* Execution status indicator if running/completed */}
        {nodeData.status && (
          <Badge
            variant="outline"
            className={`text-[10px] uppercase font-mono ${
              nodeData.status === "completed"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : nodeData.status === "running"
                ? "bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse"
                : nodeData.status === "failed"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {nodeData.status}
          </Badge>
        )}
      </div>

      {/* Body Content Details */}
      <div className="pt-3 text-xs text-muted-foreground font-mono space-y-1">
        {nodeData.type === "trigger" && (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[10px] uppercase font-mono">
            {nodeData.trigger_type || "manual"} trigger
          </Badge>
        )}
        {nodeData.prompt && (
          <p className="line-clamp-2 italic text-foreground/80">"{nodeData.prompt}"</p>
        )}
        {nodeData.url && <p className="truncate text-blue-400 font-mono">{nodeData.url}</p>}
        {nodeData.code && (
          <p className="truncate text-emerald-400/80 font-mono bg-black/30 px-2 py-1 rounded border border-white/5">
            {nodeData.code}
          </p>
        )}
      </div>

      {/* Source Handle (Output) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-background !bg-purple-400"
      />
    </div>
  );
});

CustomCanvasNode.displayName = "CustomCanvasNode";
