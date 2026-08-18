"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listWorkflowsApiV1WorkflowsGetOptions,
  listWorkflowsApiV1WorkflowsGetQueryKey,
  createWorkflowApiV1WorkflowsPostMutation,
  deleteWorkflowApiV1WorkflowsWorkflowIdDeleteMutation,
} from "@repo/api-client";
import { Plus, ArrowUpRight, Trash2, Search, Sparkles, Loader2, Upload } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // TanStack React Query for listing workflows
  const { data: workflows = [], isLoading } = useQuery(
    listWorkflowsApiV1WorkflowsGetOptions()
  );

  // TanStack React Query mutation for creating workflow
  const createMutation = useMutation({
    ...createWorkflowApiV1WorkflowsPostMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listWorkflowsApiV1WorkflowsGetQueryKey() });
      setIsCreateOpen(false);
      setName("");
      setDescription("");
    },
  });

  // TanStack React Query mutation for deleting workflow
  const deleteMutation = useMutation({
    ...deleteWorkflowApiV1WorkflowsWorkflowIdDeleteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listWorkflowsApiV1WorkflowsGetQueryKey() });
    },
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportWorkflowFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          alert("Invalid workflow JSON file format. Must contain 'nodes' and 'edges' arrays.");
          return;
        }

        const idMapping: Record<string, string> = {};
        const cleanNodes = parsed.nodes.map((n: any, idx: number) => {
          const newId = `node-${Date.now()}-${idx + 1}`;
          idMapping[n.id] = newId;
          const { status, ...cleanData } = n.data || {};
          return {
            id: newId,
            type: n.type || "customNode",
            position: n.position || { x: 250 + idx * 40, y: 150 + idx * 40 },
            data: cleanData,
          };
        });

        const cleanEdges = parsed.edges.map((e: any, idx: number) => ({
          id: `edge-${Date.now()}-${idx + 1}`,
          source: idMapping[e.source] || e.source,
          target: idMapping[e.target] || e.target,
          animated: e.animated ?? true,
          style: e.style || { stroke: "#8b5cf6", strokeWidth: 2 },
        }));

        createMutation.mutate({
          body: {
            name: parsed.name ? `${parsed.name} (Imported)` : "Imported Workflow",
            description: parsed.description || "Imported from JSON definition.",
            is_active: true,
            nodes: cleanNodes,
            edges: cleanEdges,
          },
        });
      } catch (err) {
        console.error("Failed to parse imported workflow JSON:", err);
        alert("Failed to parse JSON file. Please ensure it is valid JSON.");
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreateWorkflow = () => {
    if (!name.trim()) return;
    createMutation.mutate({
      body: {
        name,
        description,
        is_active: true,
        nodes: [
          { id: "node-1", type: "customNode", position: { x: 250, y: 100 }, data: { label: "Trigger Node", type: "trigger" } },
          { id: "node-2", type: "customNode", position: { x: 250, y: 300 }, data: { label: "LangGraph AI Agent", type: "agent", prompt: "Execute agentic reasoning task." } }
        ],
        edges: [
          { id: "edge-1-2", source: "node-1", target: "node-2", animated: true, style: { stroke: "#8b5cf6", strokeWidth: 2 } }
        ]
      }
    });
  };

  const handleDeleteWorkflow = (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    deleteMutation.mutate({
      path: { workflow_id: id }
    });
  };

  const filteredWorkflows = (workflows as any[]).filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-8 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Workflows Manager</h1>
          <p className="text-sm text-muted-foreground">Create, configure, and inspect visual agentic workflows.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportWorkflowFile}
            accept=".json,application/json"
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 border-purple-500/30 hover:bg-purple-500/10 text-purple-300"
          >
            <Upload className="h-4 w-4" /> Import Workflow JSON
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20"
          >
            <Plus className="h-4 w-4" /> New Workflow
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search workflows by name or description..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="p-16 text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 text-purple-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading workflows via React Query...</p>
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">No workflows found</CardTitle>
            <CardDescription>Click 'New Workflow' above to create one.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredWorkflows.map((wf) => (
            <Card key={wf.id} className="group hover:border-purple-500/50 transition-all duration-200 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                    {wf.nodes?.length || 0} Nodes
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                    onClick={() => handleDeleteWorkflow(wf.id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
                <CardTitle className="text-xl group-hover:text-purple-400 transition-colors pt-2">
                  {wf.name}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {wf.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2 flex items-center justify-between border-t border-border/40">
                <span className="text-xs text-muted-foreground font-mono">
                  ID: {wf.id.slice(0, 8)}
                </span>
                <Link href={`/workflows/${wf.id}`}>
                  <Button size="sm" variant="secondary" className="gap-1 text-xs">
                    Open Visual Canvas <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Workflow Dialog Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" /> Create New Workflow
            </DialogTitle>
            <DialogDescription>
              Name your workflow to initialize a new visual DAG canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Workflow Name</Label>
              <Input
                placeholder="e.g. Lead Enrichment & Email Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Brief summary of what this workflow executes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkflow} disabled={createMutation.isPending} className="gap-2 bg-purple-600 hover:bg-purple-500">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-white" />}
              {createMutation.isPending ? "Creating Workflow..." : "Create & Open Canvas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  );
}
