"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCredentialsApiV1CredentialsGetOptions,
  listCredentialsApiV1CredentialsGetQueryKey,
  createCredentialApiV1CredentialsPostMutation,
  deleteCredentialApiV1CredentialsCredentialIdDeleteMutation,
} from "@repo/api-client";
import { Key, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CredentialsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("openai");
  const [rawSecret, setRawSecret] = useState("");

  // TanStack React Query for listing credentials
  const { data: credentials = [], isLoading } = useQuery(
    listCredentialsApiV1CredentialsGetOptions()
  );

  // TanStack React Query mutation for creating credential
  const createMutation = useMutation({
    ...createCredentialApiV1CredentialsPostMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCredentialsApiV1CredentialsGetQueryKey() });
      setIsOpen(false);
      setName("");
      setRawSecret("");
    },
  });

  // TanStack React Query mutation for deleting credential
  const deleteMutation = useMutation({
    ...deleteCredentialApiV1CredentialsCredentialIdDeleteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCredentialsApiV1CredentialsGetQueryKey() });
    },
  });

  const handleCreateCredential = () => {
    if (!name.trim() || !rawSecret.trim()) return;
    createMutation.mutate({
      body: {
        name,
        service_type: serviceType,
        raw_secret: rawSecret,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete credential?")) return;
    deleteMutation.mutate({
      path: { credential_id: id },
    });
  };

  return (
    <div className="container mx-auto p-8 space-y-8 max-w-7xl">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Credentials Vault</h1>
          <p className="text-sm text-muted-foreground">Securely store Fernet-encrypted API keys and OAuth tokens for node tools.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-500">
          <Plus className="h-4 w-4" /> Add Credential
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Loading credentials vault via React Query...</div>
      ) : (credentials as any[]).length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <CardHeader>
            <ShieldCheck className="mx-auto h-10 w-10 text-purple-400 mb-2" />
            <CardTitle>No credentials stored yet</CardTitle>
            <CardDescription>Add API keys for OpenRouter, LinkedIn, or Facebook to use in workflow tools.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(credentials as any[]).map((c) => (
            <Card key={c.id} className="bg-card/40 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                    {c.service_type}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                    onClick={() => handleDelete(c.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg pt-2">{c.name}</CardTitle>
                <CardDescription className="font-mono text-xs text-emerald-400">
                  •••••••••••••••• (Fernet Encrypted)
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Secret Credential</DialogTitle>
            <DialogDescription>Store an API key or access token safely encrypted in the engine vault.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Credential Name</Label>
              <Input placeholder="e.g. OpenRouter Production Key" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={(val) => setServiceType(val || "openai")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter API</SelectItem>
                  <SelectItem value="openai">OpenAI API</SelectItem>
                  <SelectItem value="linkedin">LinkedIn OAuth</SelectItem>
                  <SelectItem value="facebook">Facebook OAuth</SelectItem>
                  <SelectItem value="generic">Generic API Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Secret API Key / Token</Label>
              <Input type="password" placeholder="sk-..." value={rawSecret} onChange={(e) => setRawSecret(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCredential} disabled={createMutation.isPending} className="bg-purple-600 hover:bg-purple-500">
              {createMutation.isPending ? "Encrypting..." : "Encrypt & Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
