"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBuiltinToolsApiV1ToolsBuiltinGetOptions,
  listCustomToolsApiV1ToolsCustomGetOptions,
  listCustomToolsApiV1ToolsCustomGetQueryKey,
  createCustomToolApiV1ToolsCustomPostMutation,
} from "@repo/api-client";
import { Wrench, Zap, Bot, Code, Globe, Plus, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ToolsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toolType, setToolType] = useState<"python_code" | "http_api">("python_code");
  const [codeOrUrl, setCodeOrUrl] = useState("output = {'result': inputs}");

  const { data: builtinTools = [], isLoading: isLoadingBuiltin } = useQuery(
    getBuiltinToolsApiV1ToolsBuiltinGetOptions()
  );

  const { data: customTools = [], isLoading: isLoadingCustom } = useQuery(
    listCustomToolsApiV1ToolsCustomGetOptions()
  );

  const createMutation = useMutation({
    ...createCustomToolApiV1ToolsCustomPostMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCustomToolsApiV1ToolsCustomGetQueryKey() });
      setIsOpen(false);
      setName("");
      setDescription("");
      setCodeOrUrl("output = {'result': inputs}");
    },
  });

  const handleCreateTool = () => {
    if (!name.trim() || !codeOrUrl.trim()) return;
    createMutation.mutate({
      body: {
        name,
        description: description || "Custom node tool.",
        tool_type: toolType as any,
        code_or_url: codeOrUrl,
        input_schema: {},
        output_schema: {},
      },
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "trigger":
      case "webhook":
        return <Zap className="h-5 w-5 text-purple-400" />;
      case "agent":
        return <Bot className="h-5 w-5 text-pink-400" />;
      case "code":
      case "python_code":
        return <Code className="h-5 w-5 text-blue-400" />;
      case "http_request":
      case "http_api":
        return <Globe className="h-5 w-5 text-emerald-400" />;
      default:
        return <Wrench className="h-5 w-5 text-amber-400" />;
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tools & Nodes Registry</h1>
          <p className="text-sm text-muted-foreground">Built-in execution blocks and custom tools available for visual canvas nodes.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white">
          <Plus className="h-4 w-4" /> Create Custom Tool
        </Button>
      </div>

      {/* Built-in Nodes Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Built-in Canvas Nodes</h2>
        {isLoadingBuiltin ? (
          <div className="p-8 text-center text-muted-foreground">Loading built-in tools...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(builtinTools as any[]).map((t) => (
              <Card key={t.id} className="bg-card/40 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-secondary/80">{getIcon(t.type)}</div>
                    <Badge variant="outline" className="text-xs uppercase font-mono">{t.type}</Badge>
                  </div>
                  <CardTitle className="text-lg pt-2">{t.name}</CardTitle>
                  <CardDescription className="text-xs">{t.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Custom Nodes Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-5 w-5 text-purple-400" /> Custom User Tools ({(customTools as any[]).length})
          </h2>
        </div>
        {isLoadingCustom ? (
          <div className="p-8 text-center text-muted-foreground">Loading custom tools...</div>
        ) : (customTools as any[]).length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">No custom tools created yet</CardTitle>
              <CardDescription className="text-xs">Click 'Create Custom Tool' to define your custom Python or HTTP node.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(customTools as any[]).map((ct: any) => (
              <Card key={ct.id} className="bg-purple-950/20 border-purple-500/30 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-purple-500/20">{getIcon(ct.tool_type)}</div>
                    <Badge variant="outline" className="text-xs uppercase font-mono text-purple-300 border-purple-500/30">{ct.tool_type}</Badge>
                  </div>
                  <CardTitle className="text-lg pt-2">{ct.name}</CardTitle>
                  <CardDescription className="text-xs">{ct.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Custom Tool Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" /> Create Custom Node Tool
            </DialogTitle>
            <DialogDescription>
              Define a reusable custom tool snippet or REST API endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tool Name</Label>
              <Input placeholder="e.g. Lead Scoring Engine" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief summary of what this tool executes..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tool Type</Label>
              <Select value={toolType} onValueChange={(val) => { if (val) setToolType(val as any); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="python_code">Python Code Snippet</SelectItem>
                  <SelectItem value="http_api">HTTP REST API Endpoint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{toolType === "python_code" ? "Python Code" : "REST Endpoint URL"}</Label>
              {toolType === "python_code" ? (
                <textarea
                  rows={6}
                  className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-emerald-400"
                  value={codeOrUrl}
                  onChange={(e) => setCodeOrUrl(e.target.value)}
                />
              ) : (
                <Input value={codeOrUrl} onChange={(e) => setCodeOrUrl(e.target.value)} placeholder="https://api.example.com/v1/data" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTool} disabled={createMutation.isPending} className="bg-purple-600 hover:bg-purple-500">
              {createMutation.isPending ? "Creating..." : "Save Custom Tool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
