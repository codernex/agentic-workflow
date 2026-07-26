"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWorkflowApiV1WorkflowsWorkflowIdGetOptions } from "@repo/api-client";
import { CanvasEditor } from "@/components/workflow/CanvasEditor";

export default function WorkflowCanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: workflow, isLoading } = useQuery(
    getWorkflowApiV1WorkflowsWorkflowIdGetOptions({
      path: { workflow_id: id }
    })
  );

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading Visual Canvas via React Query...</div>;
  }

  return (
    <CanvasEditor
      workflowId={id}
      initialNodes={(workflow as any)?.nodes || []}
      initialEdges={(workflow as any)?.edges || []}
      workflowName={(workflow as any)?.name || "Workflow Canvas"}
    />
  );
}
