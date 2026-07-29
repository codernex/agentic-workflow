"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ENGINE_BASE_URL, ENGINE_WS_URL } from "@/lib/api";
import {
  createCustomToolApiV1ToolsCustomPostMutation,
  getExecutionStepLogsApiV1ExecutionsRunIdLogsGetOptions,
  getWorkflowApiV1WorkflowsWorkflowIdGetOptions,
  getWorkflowApiV1WorkflowsWorkflowIdGetQueryKey,
  listCustomToolsApiV1ToolsCustomGetOptions,
  listCustomToolsApiV1ToolsCustomGetQueryKey,
  listExecutionsApiV1ExecutionsGetOptions,
  listWorkflowsApiV1WorkflowsGetQueryKey,
} from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, CheckCircle2, ChevronLeft, Clock, Code, Copy, Download, Filter, GitFork, Globe, Layers, Loader2, Mail, Play, Plus, RefreshCw, Save, Search, Sparkles, Terminal, Trash2, Upload, Wrench, X, Zap } from "lucide-react";
import { CustomCanvasNode, NodeType, SPECIAL_LEFT_NODE_TYPES, SPECIAL_RIGHT_NODE_TYPES } from "./CustomCanvasNode";

const nodeTypes = {
  customNode: CustomCanvasNode,
};

interface CanvasEditorProps {
  workflowId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  workflowName?: string;
}

export function CanvasEditor({ workflowId, initialNodes = [], initialEdges = [], workflowName = "New Workflow" }: CanvasEditorProps) {
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<Node[]>(
    initialNodes.length > 0
      ? initialNodes
      : [
        {
          id: "node-1",
          type: "customNode",
          position: { x: 250, y: 100 },
          data: { label: "Manual Trigger", type: "trigger" },
        },
        {
          id: "node-2",
          type: "customNode",
          position: { x: 250, y: 300 },
          data: { label: "Reasoning Agent", type: "agent", prompt: "Summarize context inputs and extract key action points." },
        },
      ]
  );

  const [edges, setEdges] = useState<Edge[]>(
    initialEdges.length > 0
      ? initialEdges
      : [
        { id: "edge-1-2", source: "node-1", target: "node-2", animated: true, style: { stroke: "#8b5cf6", strokeWidth: 2 } },
      ]
  );

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<any[]>([]);

  // Node Palette Sidebar & Custom Tool State
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isCustomToolModalOpen, setIsCustomToolModalOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");

  // Saving & Toast Notification State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Hidden File Input Ref for Import
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Export Workflow JSON (Without Database Internal IDs)
  const handleExportWorkflowJson = () => {
    const cleanNodes = nodes.map((node) => {
      const { status, ...cleanData } = (node.data || {}) as any;
      return {
        id: node.id,
        type: node.type || "customNode",
        position: node.position,
        data: cleanData,
      };
    });

    const cleanEdges = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.animated ?? true,
      style: edge.style || { stroke: "#8b5cf6", strokeWidth: 2 },
    }));

    const exportData = {
      name: workflowName,
      exported_at: new Date().toISOString(),
      nodes: cleanNodes,
      edges: cleanEdges,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `${(workflowName || "workflow").toLowerCase().replace(/[^a-z0-9]/g, "_")}_export.json`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger File Input Click for Import
  const handleTriggerImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Import Workflow JSON Handler
  const handleImportWorkflowJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          alert("Invalid workflow JSON file format. Must contain 'nodes' and 'edges' arrays.");
          return;
        }

        // Remap IDs to ensure unique visual node/edge identifiers without internal DB IDs
        const idMapping: Record<string, string> = {};
        const importedNodes: Node[] = parsed.nodes.map((n: any, idx: number) => {
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

        const importedEdges: Edge[] = parsed.edges.map((e: any, idx: number) => ({
          id: `edge-${Date.now()}-${idx + 1}`,
          source: idMapping[e.source] || e.source,
          target: idMapping[e.target] || e.target,
          animated: e.animated ?? true,
          style: e.style || { stroke: "#8b5cf6", strokeWidth: 2 },
        }));

        setNodes(importedNodes);
        setEdges(importedEdges);

        // Auto-save the imported workflow canvas graph to database
        await fetch(`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: parsed.name ? `${parsed.name} (Imported)` : workflowName,
            nodes: importedNodes,
            edges: importedEdges,
          }),
        });

        queryClient.invalidateQueries({ queryKey: listWorkflowsApiV1WorkflowsGetQueryKey() });
        queryClient.invalidateQueries({ queryKey: getWorkflowApiV1WorkflowsWorkflowIdGetQueryKey({ path: { workflow_id: workflowId } }) });

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        alert(`Successfully imported workflow with ${importedNodes.length} nodes!`);
      } catch (err) {
        console.error("Failed to parse imported workflow JSON:", err);
        alert("Failed to parse JSON file. Please ensure it is valid JSON.");
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  // Fetch workflow details including webhook_secret
  const { data: workflowData, refetch: refetchWorkflow } = useQuery(
    getWorkflowApiV1WorkflowsWorkflowIdGetOptions({
      path: { workflow_id: workflowId }
    })
  );

  const handleRegenerateSecret = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/regenerate-secret`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const updatedWorkflow = await res.json();
        queryClient.setQueryData(
          getWorkflowApiV1WorkflowsWorkflowIdGetQueryKey({ path: { workflow_id: workflowId } }),
          updatedWorkflow
        );
        await refetchWorkflow();
      }
    } catch (e) {
      console.error("Failed to regenerate webhook secret:", e);
    }
  };

  // Fetch execution runs for this workflow
  const { data: executionRuns = [], refetch: refetchExecutions } = useQuery({
    ...listExecutionsApiV1ExecutionsGetOptions({ query: { workflow_id: workflowId } }),
    enabled: isLogsOpen,
  });

  // Fetch step logs for selected active run
  const { data: activeStepLogs = [], refetch: refetchStepLogs } = useQuery({
    ...getExecutionStepLogsApiV1ExecutionsRunIdLogsGetOptions({
      path: { run_id: activeRunId || "" },
    }),
    enabled: !!activeRunId && isLogsOpen,
  });

  useEffect(() => {
    if (isLogsOpen && (executionRuns as any[]).length > 0 && !activeRunId) {
      setActiveRunId((executionRuns[0] as any).id);
    }
  }, [isLogsOpen, executionRuns, activeRunId]);

  const selectedRunData = (executionRuns as any[]).find((r) => r.id === activeRunId) || ((executionRuns as any[])[0] || null);

  const [customToolName, setCustomToolName] = useState("");
  const [customToolDesc, setCustomToolDesc] = useState("");
  const [customToolType, setCustomToolType] = useState<"python_code" | "http_api">("python_code");
  const [customToolCodeOrUrl, setCustomToolCodeOrUrl] = useState("output = {'result': inputs}");

  // Fetch custom tools via React Query
  const { data: customTools = [] } = useQuery(
    listCustomToolsApiV1ToolsCustomGetOptions()
  );

  // Mutation for creating custom tool
  const createCustomToolMutation = useMutation({
    ...createCustomToolApiV1ToolsCustomPostMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCustomToolsApiV1ToolsCustomGetQueryKey() });
      setIsCustomToolModalOpen(false);
      setCustomToolName("");
      setCustomToolDesc("");
      setCustomToolCodeOrUrl("output = {'result': inputs}");
    },
  });

  const handleCreateCustomTool = () => {
    if (!customToolName.trim() || !customToolCodeOrUrl.trim()) return;
    createCustomToolMutation.mutate({
      body: {
        name: customToolName,
        description: customToolDesc || "Custom node tool.",
        tool_type: customToolType as any,
        code_or_url: customToolCodeOrUrl,
        input_schema: {},
        output_schema: {},
      },
    });
  };

  const handleAddCustomToolNodeToCanvas = (tool: any) => {
    const isCode = tool.tool_type === "python_code";
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: "customNode",
      position: { x: 300 + nodes.length * 30, y: 150 + nodes.length * 30 },
      data: {
        label: tool.name,
        type: isCode ? "code" : "http_request",
        code: isCode ? tool.code_or_url : undefined,
        url: !isCode ? tool.code_or_url : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const PRESET_COLLECTION = [
    {
      category: "Triggers & Events",
      items: [
        { type: "trigger", trigger_type: "manual", label: "Manual API Trigger", desc: "On-demand or POST payload entry.", icon: Zap, color: "text-purple-400" },
        { type: "trigger", trigger_type: "webhook", label: "Inbound Webhook", desc: "Listens for third-party HTTP POST webhooks.", icon: Zap, color: "text-purple-400" },
        { type: "trigger", trigger_type: "cron", label: "Cron Scheduler", cron_expression: "0 * * * *", desc: "Periodic UTC time-based execution.", icon: Clock, color: "text-purple-400" },
      ],
    },
    {
      category: "AI Reasoning Agents",
      items: [
        { type: "agent", label: "smolagent Code Agent", prompt: "Analyze inputs and execute decision logic.", desc: "Dynamic Thought -> Action loop.", icon: Bot, color: "text-pink-400" },
        { type: "agent", label: "Content Summarizer", prompt: "Summarize upstream input data into executive bullet points.", desc: "Extracts key insights from text.", icon: Bot, color: "text-pink-400" },
        { type: "agent", label: "Lead Scoring Agent", prompt: "Analyze user lead payload and score priority (1-100).", desc: "Scores and classifies incoming leads.", icon: Bot, color: "text-pink-400" },
        {
          type: "agent_custom", label: "Custom Agent", prompt: "You can expect you will get order data from previous node, you will have to process the order data and validate the order details, if the order is valid then generate a confirmation message and if the order is invalid then generate a rejection message and email to the customer about the order status based on the order details.", desc: "Custom agent with ability to think and act based on the input data", icon: Bot, color: "text-pink-400"
        }
      ],
    },
    {
      category: "Logic & Code",
      items: [
        { type: "code", label: "Python Code Block", code: "log('Processing previous steps...')\noutput = {'result': steps}\n", desc: "Inline Python sandbox with steps history and log() helper.", icon: Code, color: "text-blue-400" },
        { type: "logger", label: "Step Result Logger", desc: "Captures and logs outputs from all previous step calls.", icon: Terminal, color: "text-teal-400" },
        { type: "condition", label: "Conditional Router", desc: "Evaluates if/else conditions on inputs.", icon: GitFork, color: "text-amber-400" },
        { type: "filter", label: "Data Filter & Mapper", desc: "Transforms and filters nested JSON values.", icon: Filter, color: "text-purple-400" },
      ],
    },
    {
      category: "Integrations & Alerts",
      items: [
        { type: "http_request", label: "HTTP REST API", url: "https://api.github.com/zen", method: "GET", desc: "REST HTTP call (GET/POST/PUT/DELETE).", icon: Globe, color: "text-emerald-400" },
        { type: "email", label: "Email Alert Notification", desc: "Dispatches email alert via webhook/SMTP.", icon: Mail, color: "text-rose-400" },
      ],
    },
  ];

  // Node Changes
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Edge Changes
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Automatically sync isTool flag and default tool specs on nodes based on connected tool edges
  useEffect(() => {
    const DEFAULT_TOOL_SPECS: Record<string, { tool_name: string; tool_description: string; input_schema: string; output_schema: string }> = {
      http_request: {
        tool_name: "http_request_tool",
        tool_description: "Executes HTTP REST API requests and returns status code and response payload",
        input_schema: "url, method, headers, payload",
        output_schema: "status_code, body, headers",
      },
      logger: {
        tool_name: "step_logger_tool",
        tool_description: "Logs execution steps and records observation outputs for debugging",
        input_schema: "log_message, step_data",
        output_schema: "status, logged_at",
      },
      email: {
        tool_name: "email_alert_tool",
        tool_description: "Dispatches email alerts to designated recipient addresses",
        input_schema: "recipient, subject, message_body",
        output_schema: "delivery_status, timestamp",
      },
    };

    const toolSourceNodeIds = new Set(
      edges
        .filter((e) => e.sourceHandle === "source-right" || e.targetHandle === "target-left")
        .map((e) => e.source)
    );

    setNodes((nds) => {
      let changed = false;
      const updated = nds.map((n) => {
        const isToolNow = toolSourceNodeIds.has(n.id);
        const defaultSpec = DEFAULT_TOOL_SPECS[n.data.type] || {
          tool_name: `${n.data.type}_tool`,
          tool_description: `Executes ${n.data.label} action`,
          input_schema: "parameters, payload",
          output_schema: "result_data, status",
        };

        if (n.data.isTool !== isToolNow) {
          changed = true;
          return {
            ...n,
            data: {
              ...n.data,
              isTool: isToolNow,
              tool_name: n.data.tool_name || defaultSpec.tool_name,
              tool_description: n.data.tool_description || defaultSpec.tool_description,
              input_schema: n.data.input_schema || defaultSpec.input_schema,
              output_schema: n.data.output_schema || defaultSpec.output_schema,
            },
          };
        }
        return n;
      });
      return changed ? updated : nds;
    });
  }, [edges, setNodes]);

  // Handle Connections
  const onConnect: OnConnect = useCallback(
    (connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;

      // Prevent connecting to top handle of any node currently acting as a Tool
      if (targetHandle === "target-top") {
        const targetNode = nodes.find((n) => n.id === target);
        if (targetNode?.data?.isTool) {
          return;
        }
      }

      // If connecting a left node to a right node as a tool
      if (sourceHandle === "source-right" || targetHandle === "target-left") {
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              animated: true,
              style: { stroke: "#ec4899", strokeWidth: 2 },
            },
            // Remove any top-incoming edge to the tool node if one exists
            eds.filter((e) => !(e.target === source && e.targetHandle === "target-top"))
          )
        );
        return;
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#8b5cf6", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [nodes, setNodes]
  );

  // On Edge Click -> Delete Edge Connection
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, []);

  // On Node Click -> Open Inspector Sheet
  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsInspectorOpen(true);
  };

  // Add Node Handler
  const handleAddNode = (type: string, label: string) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: "customNode",
      position: { x: 250 + nodes.length * 40, y: 150 + nodes.length * 40 },
      data: {
        label,
        type,
        prompt: type === "agent" ? "Analyze inputs and execute decision logic." : undefined,
        code: type === "code" ? "log('Accessing previous steps...')\noutput = {'result': steps}\n" : undefined,
        url: type === "http_request" ? "https://api.github.com/zen" : undefined,
        hasLeftTarget: false,
        hasRightTarget: true,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Update Node Configuration from Inspector
  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updated = { ...n, data: { ...n.data, [key]: value } };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      })
    );
  };

  // On Nodes Delete Handler
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedIds = new Set(deletedNodes.map((n) => n.id));
      setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)));
      if (selectedNode && deletedIds.has(selectedNode.id)) {
        setIsInspectorOpen(false);
        setSelectedNode(null);
      }
    },
    [selectedNode]
  );

  // Delete Selected Node Handler
  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setIsInspectorOpen(false);
    setSelectedNode(null);
  };

  // Get parent nodes connected to selected node
  const getParentNodesForSelected = () => {
    if (!selectedNode) return [];
    const parentEdgeSources = edges.filter((e) => e.target === selectedNode.id).map((e) => e.source);
    return nodes.filter((n) => parentEdgeSources.includes(n.id));
  };

  // Replace / Change Node Type Handler
  const handleReplaceNodeType = (newType: string) => {
    if (!selectedNode) return;
    const defaultLabels: Record<string, string> = {
      trigger: "Event Trigger",
      agent: "smolagent AI",
      code: "Python Code",
      logger: "Step Logger",
      http_request: "HTTP Request",
      condition: "Condition Node",
    };

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updated = {
            ...n,
            data: {
              ...n.data,
              type: newType,
              label: defaultLabels[newType] || newType,
              prompt: newType === "agent" ? (n.data.prompt || "Analyze inputs and execute decision logic.") : n.data.prompt,
              code: newType === "code" ? (n.data.code || "log('Accessing previous steps...')\noutput = {'result': steps}\n") : n.data.code,
              url: newType === "http_request" ? (n.data.url || "https://api.github.com/zen") : n.data.url,
              trigger_type: newType === "trigger" ? (n.data.trigger_type || "manual") : n.data.trigger_type,
            },
          };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      })
    );
  };

  // Save Workflow to Backend API
  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch(`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          nodes: nodes,
          edges: edges,
        }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: listWorkflowsApiV1WorkflowsGetQueryKey() });
        queryClient.invalidateQueries({ queryKey: getWorkflowApiV1WorkflowsWorkflowIdGetQueryKey({ path: { workflow_id: workflowId } }) });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error("Failed to save workflow:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Store refetch functions in refs to avoid useEffect dependency churn
  const refetchExecutionsRef = React.useRef(refetchExecutions);
  const refetchStepLogsRef = React.useRef(refetchStepLogs);

  useEffect(() => {
    refetchExecutionsRef.current = refetchExecutions;
    refetchStepLogsRef.current = refetchStepLogs;
  }, [refetchExecutions, refetchStepLogs]);

  // Real-time Workflow WebSocket listener (for inbound webhooks, cron, manual runs)
  useEffect(() => {
    if (!workflowId) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const connectWs = () => {
      if (!isSubscribed) return;
      try {
        ws = new WebSocket(`${ENGINE_WS_URL}/api/v1/ws/workflows/${workflowId}`);

        ws.onopen = () => {
          console.log(`[WS] Subscribed to workflow ${workflowId}`);
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const eventType = payload.event;
            const data = payload.data || {};

            if (eventType === "run_start") {
              setIsRunning(true);
              if (data.run_id) {
                setActiveRunId(data.run_id);
              }
              refetchExecutionsRef.current();
              refetchStepLogsRef.current();
            } else if (eventType === "step_start") {
              setIsRunning(true);
              if (data.node_id) {
                setNodes((nds) =>
                  nds.map((n) => (n.id === data.node_id ? { ...n, data: { ...n.data, status: "running" } } : n))
                );
              }
              refetchStepLogsRef.current();
            } else if (eventType === "step_completed") {
              if (data.node_id) {
                setNodes((nds) =>
                  nds.map((n) => (n.id === data.node_id ? { ...n, data: { ...n.data, status: "completed" } } : n))
                );
              }
              refetchStepLogsRef.current();
            } else if (eventType === "step_failed") {
              if (data.node_id) {
                setNodes((nds) =>
                  nds.map((n) => (n.id === data.node_id ? { ...n, data: { ...n.data, status: "failed" } } : n))
                );
              }
              refetchStepLogsRef.current();
            } else if (eventType === "run_completed" || eventType === "run_failed") {
              setIsRunning(false);
              refetchExecutionsRef.current();
              refetchStepLogsRef.current();
              setTimeout(() => {
                setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: undefined } })));
              }, 3500);
            }
          } catch (e) {
            console.error("Error handling workflow websocket message:", e);
          }
        };

        ws.onclose = () => {
          if (isSubscribed) {
            reconnectTimeout = setTimeout(connectWs, 5000);
          }
        };

        ws.onerror = (err) => {
          console.warn("[WS] Workflow connection event:", err);
        };
      } catch (e) {
        console.error("[WS] Workflow setup error:", e);
        if (isSubscribed) {
          reconnectTimeout = setTimeout(connectWs, 5000);
        }
      }
    };

    connectWs();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };
  }, [workflowId]);

  // Run Workflow Execution Trigger
  const handleRunWorkflow = async () => {
    setIsRunning(true);
    setIsLogsOpen(true);
    setStepLogs([]);

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const secret = (workflowData as any)?.webhook_secret || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      // First save workflow graph
      await fetch(`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name: workflowName, nodes, edges }),
      });

      // Trigger Execution with Authorization header and secret parameter fallback
      const url = secret
        ? `${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/execute?secret=${encodeURIComponent(secret)}`
        : `${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/execute`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ trigger_time: new Date().toISOString() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Failed to execute workflow." }));
        console.error("Execution failed response:", errData);
        alert(errData.detail || "Failed to execute workflow.");
        setIsRunning(false);
        return;
      }

      const runData = await res.json();
      setActiveRunId(runData.id);
    } catch (e) {
      console.error("Execution failed:", e);
      setIsRunning(false);
    }
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background flex">
      {/* Collapsible Left Nodes Collection Sidebar */}
      {isPaletteOpen && (
        <div className="w-[330px] border-r bg-background/95 backdrop-blur-xl flex flex-col z-20 shadow-2xl shrink-0 h-full overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-400" />
              <h3 className="font-bold text-sm">Nodes Collection</h3>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsPaletteOpen(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-4 py-3 border-b space-y-2 bg-muted/20 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search nodes & custom tools..."
                className="pl-8 h-8 text-xs bg-background"
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => setIsCustomToolModalOpen(true)}
              className="w-full gap-1.5 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Create Custom Node
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
            {/* Built-in Node Categories */}
            {PRESET_COLLECTION.map((cat, idx) => {
              const filteredItems = cat.items.filter(
                (item) =>
                  item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                  item.desc.toLowerCase().includes(paletteSearch.toLowerCase())
              );
              if (filteredItems.length === 0) return null;
              return (
                <div key={idx} className="space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                    {cat.category}
                  </h4>
                  <div className="space-y-2">
                    {filteredItems.map((item, iIdx) => {
                      const IconComponent = item.icon;
                      return (
                        <div
                          key={iIdx}
                          onClick={() => handleAddNode(item.type, item.label)}
                          className="group p-3 rounded-xl border border-border/40 hover:border-purple-500/50 bg-card/40 hover:bg-purple-500/10 cursor-pointer transition-all flex items-start gap-3 shadow-sm"
                        >
                          <div className={`p-2 rounded-lg bg-secondary/80 mt-0.5 shrink-0 ${item.color}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-semibold group-hover:text-purple-300 transition-colors truncate">
                                {item.label}
                              </h5>
                              <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity shrink-0 ml-1" />
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Custom Tools Section */}
            <div className="space-y-2 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" /> Custom Tools ({(customTools as any[]).length})
                </h4>
              </div>

              {(customTools as any[]).length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No custom nodes created yet. Click '+ Create Custom Node' above.</p>
              ) : (
                <div className="space-y-2">
                  {(customTools as any[]).filter(t => t.name.toLowerCase().includes(paletteSearch.toLowerCase())).map((tool: any) => (
                    <div
                      key={tool.id}
                      onClick={() => handleAddCustomToolNodeToCanvas(tool)}
                      className="group p-3 rounded-xl border border-purple-500/20 hover:border-purple-500/60 bg-purple-950/20 hover:bg-purple-900/30 cursor-pointer transition-all flex items-start gap-3 shadow-sm"
                    >
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 mt-0.5 shrink-0">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-purple-200 group-hover:text-white truncate">
                            {tool.name}
                          </h5>
                          <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-purple-300 transition-opacity shrink-0 ml-1" />
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                          {tool.description}
                        </p>
                        <Badge variant="outline" className="text-[9px] uppercase font-mono mt-1.5 text-purple-300 border-purple-500/30">
                          {tool.tool_type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative flex-1 h-full overflow-hidden">
        {/* Top Floating Control Bar */}
        <div className="absolute top-4 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
          {/* Toggle Sidebar & Quick Node Palette */}
          <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-xl border bg-background/90 backdrop-blur-md shadow-2xl">
            <Button
              size="sm"
              variant={isPaletteOpen ? "secondary" : "outline"}
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              className="gap-1.5 text-xs"
            >
              <Layers className="h-3.5 w-3.5 text-purple-400" />
              {isPaletteOpen ? "Hide Palette" : "Show Palette"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAddNode("trigger", "Event Trigger")}
              className="gap-1.5 text-xs hover:bg-purple-500/10 hover:text-purple-400"
            >
              <Zap className="h-3.5 w-3.5 text-purple-400" /> + Trigger
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAddNode("agent", "smolagent AI")}
              className="gap-1.5 text-xs hover:bg-pink-500/10 hover:text-pink-400"
            >
              <Bot className="h-3.5 w-3.5 text-pink-400" /> + AI Agent
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAddNode("code", "Python Code")}
              className="gap-1.5 text-xs hover:bg-blue-500/10 hover:text-blue-400"
            >
              <Code className="h-3.5 w-3.5 text-blue-400" /> + Code
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAddNode("http_request", "HTTP Request")}
              className="gap-1.5 text-xs hover:bg-emerald-500/10 hover:text-emerald-400"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-400" /> + HTTP
            </Button>
          </div>

          {/* Action Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportWorkflowJson}
              accept=".json,application/json"
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={handleExportWorkflowJson} className="gap-1.5 border-sky-500/30 hover:bg-sky-500/10 text-sky-300">
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleTriggerImportClick} className="gap-1.5 border-teal-500/30 hover:bg-teal-500/10 text-teal-300">
              <Upload className="h-4 w-4" /> Import JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsWebhookModalOpen(true)} className="gap-2">
              <Zap className="h-4 w-4 text-amber-400" /> Webhook Secret API
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsLogsOpen(!isLogsOpen)} className="gap-2">
              <Terminal className="h-4 w-4 text-purple-400" /> Execution Logs
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="gap-2 font-medium transition-all"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
              ) : saveSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
            </Button>
            <Button
              size="sm"
              onClick={handleRunWorkflow}
              disabled={isRunning}
              className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {isRunning ? "Running..." : "Test Execute"}
            </Button>
          </div>
        </div>

        {/* Floating Save Toast Banner */}
        {saveSuccess && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-950/80 backdrop-blur-xl text-emerald-300 text-xs font-semibold shadow-2xl animate-in fade-in-0 slide-in-from-top-4 duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Workflow graph saved successfully!
          </div>
        )}

        {/* Main Visual ReactFlow Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          edgesReconnectable={true}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255, 255, 255, 0.08)" />
          <Controls className="!bg-background/80 !border-border !shadow-lg rounded-xl" />
        </ReactFlow>

        {/* Node Inspector Sidebar Sheet */}
        <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
          <SheetContent className="w-full sm:max-w-[540px] p-0 bg-background/95 backdrop-blur-xl border-l flex flex-col h-full overflow-hidden">
            <SheetHeader className="px-6 py-4 border-b shrink-0">
              <SheetTitle className="flex items-center gap-2 text-lg font-bold">
                Configure Node
              </SheetTitle>
              <SheetDescription>
                Edit parameters, prompts, and execution code for this node.
              </SheetDescription>
            </SheetHeader>

            {selectedNode && (
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
                {/* Node Title */}
                <div className="space-y-2">
                  <Label>Node Label</Label>
                  <Input
                    value={selectedNode.data.label as string}
                    onChange={(e) => updateSelectedNodeData("label", e.target.value)}
                  />
                </div>

                {/* Node Type Selector (Replace Node) */}
                <div className="space-y-2">
                  <Label>Node Type (Replace Node)</Label>
                  <Select
                    value={(selectedNode.data.type as string) || "agent"}
                    onValueChange={(val) => { if (val) handleReplaceNodeType(val); }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select node type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trigger">⚡ Trigger Event</SelectItem>
                      <SelectItem value="agent">🤖 smolagent AI Agent</SelectItem>
                      <SelectItem value="code">🐍 Python Code Block</SelectItem>
                      <SelectItem value="logger">📋 Step Result Logger</SelectItem>
                      <SelectItem value="condition">🔀 Conditional Router</SelectItem>
                      <SelectItem value="filter">🔍 Data Filter & Mapper</SelectItem>
                      <SelectItem value="http_request">🌐 HTTP REST API</SelectItem>
                      <SelectItem value="email">📧 Email Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Agent Tool Specification Section */}
                {selectedNode.data.isTool && (
                  <div className="rounded-xl border border-pink-500/30 bg-pink-950/20 p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                        <Wrench className="h-4 w-4 text-pink-400" /> Agent Tool Specification
                      </Label>
                      <Badge variant="outline" className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-[9px] uppercase font-mono">
                        Active Tool
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      This node is connected as a tool for the AI Agent. Define the tool name, description, accepted inputs, and returned outputs so the agent can observe and execute it.
                    </p>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Tool Name</Label>
                      <Input
                        className="text-xs font-mono bg-background"
                        placeholder="e.g. http_request_tool"
                        value={(selectedNode.data.tool_name as string) || ""}
                        onChange={(e) => updateSelectedNodeData("tool_name", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Tool Description for Agent</Label>
                      <Input
                        className="text-xs bg-background"
                        placeholder="Describe what this tool does so the agent knows when to invoke it..."
                        value={(selectedNode.data.tool_description as string) || ""}
                        onChange={(e) => updateSelectedNodeData("tool_description", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Accepted Input Parameters (Input Schema)</Label>
                      <Input
                        className="text-xs font-mono bg-background"
                        placeholder="e.g. url, method, headers, payload"
                        value={(selectedNode.data.input_schema as string) || ""}
                        onChange={(e) => updateSelectedNodeData("input_schema", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Returned Output Observation (Output Schema)</Label>
                      <Input
                        className="text-xs font-mono bg-background"
                        placeholder="e.g. status_code, body, headers"
                        value={(selectedNode.data.output_schema as string) || ""}
                        onChange={(e) => updateSelectedNodeData("output_schema", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Trigger Node Customization */}
                {selectedNode.data.type === "trigger" && (
                  <div className="space-y-4 rounded-xl border border-purple-500/20 bg-purple-950/20 p-4">
                    <div className="space-y-2">
                      <Label className="text-purple-300 font-semibold flex items-center gap-1.5">
                        <Zap className="h-4 w-4" /> Trigger Mechanism
                      </Label>
                      <Select
                        value={(selectedNode.data.trigger_type as string) || "manual"}
                        onValueChange={(val) => { if (val) updateSelectedNodeData("trigger_type", val); }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select trigger mechanism" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual / API Trigger</SelectItem>
                          <SelectItem value="webhook">Inbound Webhook</SelectItem>
                          <SelectItem value="cron">Cron Schedule</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {((selectedNode.data.trigger_type as string) === "webhook" || (selectedNode.data.trigger_type as string) === "manual" || !selectedNode.data.trigger_type) && (
                      <div className="space-y-2 pt-2">
                        <Label className="text-xs text-muted-foreground">Authenticated Webhook / API URL</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            className="font-mono text-xs text-purple-300 bg-black/40"
                            value={`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/webhook?secret=${(workflowData as any)?.webhook_secret || ""}`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const url = `${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/webhook?secret=${(workflowData as any)?.webhook_secret || ""}`;
                              navigator.clipboard.writeText(url);
                              alert("Authenticated Webhook URL with secret copied to clipboard!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Send HTTP POST to trigger this workflow with JSON payload and secret token.</p>
                      </div>
                    )}

                    {(selectedNode.data.trigger_type as string) === "cron" && (
                      <div className="space-y-2 pt-2">
                        <Label className="text-xs text-purple-300 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Cron Schedule (UTC)
                        </Label>
                        <Input
                          placeholder="e.g. 0 * * * * or */15 * * * *"
                          className="font-mono text-xs"
                          value={(selectedNode.data.cron_expression as string) || "0 * * * *"}
                          onChange={(e) => updateSelectedNodeData("cron_expression", e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">Standard 5-part cron syntax: minute hour day-of-month month day-of-week.</p>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground">Initial Input Payload Sample (JSON)</Label>
                      <textarea
                        rows={3}
                        className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-purple-300"
                        value={(selectedNode.data.default_payload as string) || '{\n  "source": "manual_trigger"\n}'}
                        onChange={(e) => updateSelectedNodeData("default_payload", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Settings per Type */}
                {(selectedNode.data.type === "agent" || selectedNode.data.type === "agent_custom") && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Bot className="h-4 w-4 text-pink-400" /> AI Agent Instruction Prompt
                      </Label>
                      <textarea
                        rows={5}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono leading-relaxed"
                        value={(selectedNode.data.prompt as string) || ""}
                        onChange={(e) => updateSelectedNodeData("prompt", e.target.value)}
                        placeholder="Instructions for your custom agent (e.g. Process and validate the order details from input payload)..."
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-950/20 text-xs space-y-1.5 text-purple-200">
                      <p className="font-semibold text-purple-300 flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="h-3.5 w-3.5 text-purple-400" /> User Prompt & Dynamic Variables:
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
                        Pass user prompts or trigger payload data into your agent dynamically using placeholders like <code className="text-purple-300 font-mono font-bold">{"{{user_prompt}}"}</code>, <code className="text-purple-300 font-mono font-bold">{"{{order_id}}"}</code>, or <code className="text-purple-300 font-mono font-bold">{"{{input}}"}</code>.
                      </p>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "code" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Python Execution Code</Label>
                      <span className="text-[10px] text-muted-foreground font-mono">Isolated Sandbox</span>
                    </div>
                    <textarea
                      rows={8}
                      className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-sm shadow-sm font-mono text-emerald-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={(selectedNode.data.code as string) || ""}
                      onChange={(e) => updateSelectedNodeData("code", e.target.value)}
                      placeholder="log('msg')&#10;output = {'result': steps['node-1']}"
                    />
                    <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3 text-[11px] text-muted-foreground space-y-1.5">
                      <p className="text-blue-300 font-semibold flex items-center gap-1.5">
                        <Code className="h-3.5 w-3.5" /> Sandbox Execution Environment:
                      </p>
                      <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                        <li><code className="text-emerald-400 font-bold">log("msg", val)</code> or <code className="text-emerald-400 font-bold">print(...)</code> — write to execution log trace</li>
                        <li><code className="text-emerald-400 font-bold">steps['node_id']</code> — read data output from any previous node call</li>
                        <li><code className="text-emerald-400 font-bold">output = ...</code> — return data payload for child nodes</li>
                      </ul>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "logger" && (
                  <div className="space-y-3 rounded-xl border border-teal-500/20 bg-teal-950/20 p-4">
                    <div className="flex items-center gap-2 text-teal-300 font-semibold text-xs">
                      <Terminal className="h-4 w-4" /> Result Logger Node
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      This tool captures and logs the execution output from all previous node calls in the graph (e.g. HTTP responses, Agent outputs, Triggers).
                    </p>
                    <div className="p-2.5 rounded bg-black/40 border border-teal-500/10 text-[11px] font-mono text-teal-200 space-y-1">
                      <p className="font-semibold text-teal-300">Child Node Access:</p>
                      <p>Downstream nodes receive: <code className="text-emerald-400">{`inputs['${selectedNode.id}']`}</code> containing <code className="text-purple-300">logged_data</code>, <code className="text-purple-300">summary</code>, and <code className="text-purple-300">count</code>.</p>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "http_request" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 space-y-2">
                        <Label>Method</Label>
                        <Select
                          value={(selectedNode.data.method as string) || "GET"}
                          onValueChange={(val) => { if (val) updateSelectedNodeData("method", val); }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>Endpoint URL</Label>
                        <Input
                          value={(selectedNode.data.url as string) || ""}
                          onChange={(e) => updateSelectedNodeData("url", e.target.value)}
                          placeholder="https://api.example.com/users/{node-1.id}"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">JSON Request Body</Label>
                      <textarea
                        rows={4}
                        className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-emerald-400"
                        value={typeof selectedNode.data.body === "object" ? JSON.stringify(selectedNode.data.body, null, 2) : (selectedNode.data.body as string) || "{}"}
                        onChange={(e) => {
                          try {
                            updateSelectedNodeData("body", JSON.parse(e.target.value));
                          } catch {
                            updateSelectedNodeData("body", e.target.value);
                          }
                        }}
                        placeholder='{\n  "email": "{node-1.user_email}"\n}'
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "email" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Recipient Email (To)</Label>
                      <Input
                        value={(selectedNode.data.to as string) || ""}
                        onChange={(e) => updateSelectedNodeData("to", e.target.value)}
                        placeholder="e.g. user@example.com or {node-1.email}"
                      />
                      <p className="text-[11px] text-muted-foreground">Use template syntax <code className="text-purple-300 font-mono">{`{node-1.email}`}</code> to bind recipient from a parent node.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject Line</Label>
                      <Input
                        value={(selectedNode.data.subject as string) || ""}
                        onChange={(e) => updateSelectedNodeData("subject", e.target.value)}
                        placeholder="e.g. Alert: {node-1.status_code} - {node-2.status}"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Body Message</Label>
                      <textarea
                        rows={4}
                        className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-purple-200"
                        value={(selectedNode.data.body as string) || ""}
                        onChange={(e) => updateSelectedNodeData("body", e.target.value)}
                        placeholder="Hello {node-1.user_name}, your request processed with summary: {node-2.summary}"
                      />
                    </div>

                    {/* Parent Data Binding Examples Card */}
                    <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-950/20 text-xs space-y-2 text-purple-200">
                      <p className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 shrink-0 text-purple-400" /> Parent Node Data Binding Examples:
                      </p>
                      <div className="space-y-1.5 text-[11px] font-mono bg-black/40 p-2.5 rounded border border-purple-500/10">
                        <p><span className="text-muted-foreground">From Trigger:</span> <code className="text-emerald-400">{`To: {node-1.email}`}</code></p>
                        <p><span className="text-muted-foreground">From Python Code:</span> <code className="text-emerald-400">{`Subject: {node-2.subject_line}`}</code></p>
                        <p><span className="text-muted-foreground">From HTTP Request:</span> <code className="text-emerald-400">{`Body: User ID {node-3.data.id} result`}</code></p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-pink-500/20 bg-pink-950/20 text-xs space-y-2 text-pink-200">
                      <p className="font-bold text-pink-300 flex items-center gap-1.5">
                        <Mail className="h-4 w-4 shrink-0 text-pink-400" /> How Notifications Are Delivered:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground leading-relaxed font-sans">
                        <li>Rendered as responsive HTML email templates with gradient header banners.</li>
                        <li>Dispatched directly to the recipient’s inbox (<code className="text-pink-300">To</code>) via official <strong>Mailtrap Python SDK</strong>.</li>
                        <li>If <code className="text-purple-300 font-mono">MAILTRAP_API_TOKEN</code> is unconfigured, full email payloads are captured into execution logs.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "filter" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-purple-300">Filter & Transformation Method</Label>
                      <Select
                        value={(selectedNode.data.output_filter_mode as string) || "selected_keys"}
                        onValueChange={(val) => { if (val) updateSelectedNodeData("output_filter_mode", val); }}
                      >
                        <SelectTrigger className="bg-background/80 text-xs">
                          <SelectValue placeholder="Select filter mode..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="selected_keys">1. Keep Specific Keys (Whitelist)</SelectItem>
                          <SelectItem value="custom_mapping">2. Key Renaming & Remapping (JSON)</SelectItem>
                          <SelectItem value="code">3. Python Expression Transformation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {((selectedNode.data.output_filter_mode as string) === "selected_keys" || !selectedNode.data.output_filter_mode) && (
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-semibold">Keys to Keep (Comma Separated)</Label>
                        <Input
                          className="text-xs bg-black/40 font-mono text-emerald-400"
                          placeholder="e.g. user_email, status, score, user_id"
                          value={(selectedNode.data.output_filter_keys as string) || ""}
                          onChange={(e) => updateSelectedNodeData("output_filter_keys", e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">Strips out all unlisted keys from parent output payload, passing only the selected fields.</p>
                      </div>
                    )}

                    {(selectedNode.data.output_filter_mode as string) === "custom_mapping" && (
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-semibold">JSON Field Remapping Schema</Label>
                        <textarea
                          rows={5}
                          className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-purple-300"
                          value={typeof selectedNode.data.output_filter_mapping === "object" ? JSON.stringify(selectedNode.data.output_filter_mapping, null, 2) : (selectedNode.data.output_filter_mapping as string) || '{\n  "recipient": "{node-1.email}",\n  "status_code": "{node-2.status}"\n}'}
                          onChange={(e) => {
                            try {
                              updateSelectedNodeData("output_filter_mapping", JSON.parse(e.target.value));
                            } catch {
                              updateSelectedNodeData("output_filter_mapping", e.target.value);
                            }
                          }}
                        />
                      </div>
                    )}

                    {(selectedNode.data.output_filter_mode as string) === "code" && (
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-semibold">Python Transformation Code</Label>
                        <textarea
                          rows={6}
                          className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-emerald-400"
                          value={(selectedNode.data.code as string) || "output = {'email': inputs['node-1']['email'], 'active': True}"}
                          onChange={(e) => updateSelectedNodeData("code", e.target.value)}
                        />
                      </div>
                    )}

                    {/* Filter Capabilities Overview Card */}
                    <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-950/20 text-xs space-y-2 text-purple-200">
                      <p className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Filter className="h-4 w-4 shrink-0 text-purple-400" /> How Data Filter & Mapper Works:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground leading-relaxed font-sans">
                        <li><strong>Cleans Heavy Payloads:</strong> Strips thousands of unwanted API fields, keeping only relevant parameters.</li>
                        <li><strong>Reshapes JSON Structure:</strong> Renames keys to match the exact input structure expected by downstream Email or HTTP nodes.</li>
                        <li><strong>Array & Value Mapping:</strong> Performs list filtering and type conversions before passing to child nodes.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "condition" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Boolean Condition Expression (Python)</Label>
                      <textarea
                        rows={4}
                        className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-amber-300"
                        value={(selectedNode.data.code as string) || (selectedNode.data.condition as string) || "output = inputs['node-1']['status_code'] == 200"}
                        onChange={(e) => {
                          updateSelectedNodeData("code", e.target.value);
                          updateSelectedNodeData("condition", e.target.value);
                        }}
                        placeholder="output = inputs['node-1']['score'] >= 80"
                      />
                    </div>

                    {/* Condition Examples Card */}
                    <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/20 text-xs space-y-2 text-amber-200">
                      <p className="font-bold text-amber-300 flex items-center gap-1.5">
                        <GitFork className="h-4 w-4 shrink-0 text-amber-400" /> Condition Expression Examples:
                      </p>
                      <div className="space-y-1.5 text-[11px] font-mono bg-black/40 p-2.5 rounded border border-amber-500/10">
                        <p><span className="text-muted-foreground">HTTP Status Check:</span> <code className="text-emerald-400">output = inputs['node-1']['status_code'] == 200</code></p>
                        <p><span className="text-muted-foreground">Threshold Check:</span> <code className="text-emerald-400">output = inputs['node-2']['score'] &gt;= 80</code></p>
                        <p><span className="text-muted-foreground">String Search:</span> <code className="text-emerald-400">output = 'urgent' in inputs['node-1']['body'].lower()</code></p>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground leading-relaxed font-sans pt-1">
                        <li><strong>Condition Output:</strong> Returns <code className="text-amber-300 font-mono">{"{ condition_met: true, output: true }"}</code> on match.</li>
                        <li><strong>Child Node Routing:</strong> Downstream nodes inspect <code className="text-purple-300 font-mono">condition_met</code> to decide whether to execute or skip.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Output Data Forwarding Selector */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5" /> Output Data Selective Forwarding
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Choose which output fields this node forwards to downstream connected nodes.
                  </p>
                  <div className="space-y-2">
                    <Select
                      value={(selectedNode.data.output_filter_mode as string) || "all"}
                      onValueChange={(val) => { if (val) updateSelectedNodeData("output_filter_mode", val); }}
                    >
                      <SelectTrigger className="bg-background/80 text-xs">
                        <SelectValue placeholder="Select forwarding mode..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Forward All Output Fields (Default)</SelectItem>
                        <SelectItem value="selected_keys">Forward Selected Keys Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(selectedNode.data.output_filter_mode as string) === "selected_keys" && (
                    <div className="space-y-2 pt-1">
                      <Label className="text-[11px]">Keys to Forward (comma separated)</Label>
                      <Input
                        className="text-xs bg-background font-mono"
                        placeholder="e.g. user_email, amount, status"
                        value={(selectedNode.data.output_filter_keys as string) || ""}
                        onChange={(e) => updateSelectedNodeData("output_filter_keys", e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground italic">
                        Only keys listed above will be forwarded to downstream nodes.
                      </p>
                    </div>
                  )}
                </div>

                {/* Upstream Parent Connected Nodes Reference Box */}
                {selectedNode.data.type !== "trigger" && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 space-y-2">
                    <Label className="text-blue-300 font-semibold text-xs flex items-center gap-1.5">
                      <GitFork className="h-3.5 w-3.5" /> Upstream Parent Nodes ({getParentNodesForSelected().length})
                    </Label>
                    {getParentNodesForSelected().length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No parent nodes connected. Drag an edge from another node to pass data into this node.</p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {getParentNodesForSelected().map((pNode) => (
                          <div key={pNode.id} className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5 text-xs">
                            <div>
                              <span className="font-semibold text-foreground">{pNode.data.label as string}</span>
                              <span className="text-[10px] text-muted-foreground font-mono ml-2">({pNode.id})</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] font-mono text-purple-300 hover:text-purple-200"
                              onClick={() => {
                                navigator.clipboard.writeText(`inputs['${pNode.id}']`);
                                alert(`Copied "inputs['${pNode.id}']" reference to clipboard!`);
                              }}
                            >
                              Copy Ref
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Delete Node Button */}
                <div className="pt-6 border-t flex items-center justify-between">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete Node
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Execution Logs Drawer */}
        {isLogsOpen && (
          <div className="absolute bottom-4 left-6 right-6 z-20 max-h-80 rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40 gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Terminal className="h-4 w-4 text-purple-400 shrink-0" />
                <span className="font-mono text-xs font-semibold shrink-0">Execution Logs</span>

                {/* Execution Run Selector */}
                <div className="flex items-center gap-2 max-w-xs flex-1">
                  <Select
                    value={activeRunId || ""}
                    onValueChange={(val) => { if (val) setActiveRunId(val); }}
                  >
                    <SelectTrigger className="h-7 text-xs font-mono bg-background/80">
                      <SelectValue placeholder="Select execution run..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(executionRuns as any[]).map((run: any) => (
                        <SelectItem key={run.id} value={run.id} className="text-xs font-mono">
                          [{run.trigger_type.toUpperCase()}] {new Date(run.started_at).toLocaleTimeString()} ({run.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-purple-400"
                    onClick={() => refetchExecutions()}
                    title="Refresh Webhook Executions"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setIsLogsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 font-mono text-xs">
              {/* Display Ingested Webhook Payload / Input Data if available */}
              {selectedRunData && selectedRunData.input_data && Object.keys(selectedRunData.input_data).length > 0 && (
                <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-950/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-purple-300">
                    <span>📥 Ingested Webhook Payload Data ({selectedRunData.trigger_type})</span>
                    <Badge variant="outline" className="text-[9px] uppercase border-purple-500/30 text-purple-300">
                      {selectedRunData.status}
                    </Badge>
                  </div>
                  <pre className="text-purple-200 whitespace-pre-wrap text-[11px] bg-black/40 p-2 rounded border border-purple-500/10">
                    {JSON.stringify(selectedRunData.input_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Display Step Logs */}
              {activeStepLogs.length > 0 ? (
                (activeStepLogs as any[]).map((step: any) => (
                  <div key={step.id} className="p-2.5 rounded-lg border border-white/5 bg-black/40 space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-purple-400 font-bold">[{step.node_type}] {step.node_name}</span>
                      <span className="text-[10px]">{step.execution_time_ms}ms</span>
                    </div>
                    {step.thought_trace && (
                      <pre className="text-pink-300/90 whitespace-pre-wrap text-[11px] bg-pink-950/20 p-2 rounded border border-pink-500/10">
                        {step.thought_trace}
                      </pre>
                    )}
                    {step.output_data && (
                      <pre className="text-emerald-300 whitespace-pre-wrap text-[11px] bg-emerald-950/20 p-2 rounded border border-emerald-500/10">
                        {JSON.stringify(step.output_data, null, 2)}
                      </pre>
                    )}
                    {step.error_message && (
                      <pre className="text-rose-400 whitespace-pre-wrap text-[11px] bg-rose-950/20 p-2 rounded border border-rose-500/10">
                        {step.error_message}
                      </pre>
                    )}
                  </div>
                ))
              ) : stepLogs.length > 0 ? (
                stepLogs.map((log, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-white/5 bg-black/40 space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-purple-400 font-bold">[{log.event}]</span>
                      <span>Node: {log.data?.node_name || log.data?.node_id}</span>
                    </div>
                    {log.data?.thought_trace && (
                      <pre className="text-pink-300/90 whitespace-pre-wrap text-[11px] bg-pink-950/20 p-2 rounded border border-pink-500/10">
                        {log.data.thought_trace}
                      </pre>
                    )}
                    {log.data?.output && (
                      <pre className="text-emerald-300 whitespace-pre-wrap text-[11px] bg-emerald-950/20 p-2 rounded border border-emerald-500/10">
                        {JSON.stringify(log.data.output, null, 2)}
                      </pre>
                    )}
                    {log.data?.error && (
                      <pre className="text-rose-400 whitespace-pre-wrap text-[11px] bg-rose-950/20 p-2 rounded border border-rose-500/10">
                        {log.data.error}
                      </pre>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic text-center py-4">
                  No execution logs found for this run. Click 'Test Execute' or invoke the webhook URL to see execution logs.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Custom Node Dialog Modal */}
      <Dialog open={isCustomToolModalOpen} onOpenChange={setIsCustomToolModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" /> Create Custom Tool / Node
            </DialogTitle>
            <DialogDescription>
              Define a reusable custom tool to add to your Node Collection palette.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tool Name</Label>
              <Input
                placeholder="e.g. Lead Data Normalizer"
                value={customToolName}
                onChange={(e) => setCustomToolName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief summary of what this tool does..."
                value={customToolDesc}
                onChange={(e) => setCustomToolDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tool Type</Label>
              <Select
                value={customToolType}
                onValueChange={(val) => { if (val) setCustomToolType(val as any); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tool type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="python_code">Python Code Snippet</SelectItem>
                  <SelectItem value="http_api">HTTP REST API Endpoint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{customToolType === "python_code" ? "Python Code" : "REST Endpoint URL"}</Label>
              {customToolType === "python_code" ? (
                <textarea
                  rows={6}
                  className="w-full rounded-md border border-input bg-black/40 px-3 py-2 text-xs font-mono text-emerald-400"
                  value={customToolCodeOrUrl}
                  onChange={(e) => setCustomToolCodeOrUrl(e.target.value)}
                  placeholder="output = {'result': inputs}"
                />
              ) : (
                <Input
                  value={customToolCodeOrUrl}
                  onChange={(e) => setCustomToolCodeOrUrl(e.target.value)}
                  placeholder="https://api.example.com/v1/data"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomToolModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomTool} disabled={createCustomToolMutation.isPending} className="bg-purple-600 hover:bg-purple-500">
              {createCustomToolMutation.isPending ? "Saving..." : "Save Custom Node"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Secret & Trigger Protection Settings Modal */}
      <Dialog open={isWebhookModalOpen} onOpenChange={setIsWebhookModalOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" /> Inbound Webhook Secret Settings
            </DialogTitle>
            <DialogDescription>
              Trigger this workflow externally from GitHub, Stripe, Typeform, or cURL using your protected secret token.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Authenticated Webhook Trigger URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  className="font-mono text-xs bg-muted/40"
                  value={`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/webhook?secret=${(workflowData as any)?.webhook_secret || ""}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/webhook?secret=${(workflowData as any)?.webhook_secret || ""}`);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                >
                  {copiedWebhook ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copiedWebhook ? "Copied!" : "Copy URL"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Webhook Secret Token</Label>
                  <p className="text-xs text-muted-foreground">Keep this secret safe. If compromised, rotate it below.</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1 text-xs"
                  onClick={handleRegenerateSecret}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Rotate Secret
                </Button>
              </div>
              <Input
                readOnly
                className="font-mono text-xs bg-muted/40 text-purple-300"
                value={(workflowData as any)?.webhook_secret || "Loading secret..."}
              />
            </div>

            <div className="p-3 rounded-lg border bg-purple-950/20 border-purple-500/20 text-xs space-y-1.5 text-purple-200">
              <p className="font-bold">cURL Command Example:</p>
              <code className="block p-2 rounded bg-black/40 font-mono text-[11px] overflow-x-auto text-emerald-300">
                {`curl -X POST "${ENGINE_BASE_URL}/api/v1/workflows/${workflowId}/webhook?secret=${(workflowData as any)?.webhook_secret || "YOUR_SECRET"}" -H "Content-Type: application/json" -d '{"data": "payload"}'`}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWebhookModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
