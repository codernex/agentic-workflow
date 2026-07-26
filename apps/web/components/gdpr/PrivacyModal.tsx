"use client";

import { ShieldCheck, Lock, FileText, Download, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PrivacyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyModal({ isOpen, onOpenChange }: PrivacyModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-purple-500/20">
        <DialogHeader className="space-y-2 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2 text-purple-400">
            <ShieldCheck className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold">Privacy Policy & GDPR Compliance</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            EU General Data Protection Regulation (GDPR 2016/679) & Data Protection Notice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4 text-xs text-muted-foreground leading-relaxed">
          {/* Section 1: Data Controller */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-400" /> 1. Data Collection & Processing Principles
            </h4>
            <p>
              We process minimal personal data required to operate the Agentic Workflow Engine, including your email address, full name, and workspace preferences. All passwords are encrypted using bcrypt salt hashing, and authentication tokens are secured with JWT HS256 signatures.
            </p>
          </div>

          {/* Section 2: GDPR User Rights */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> 2. Your Rights Under GDPR
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Right to Access & Rectification:</strong> Inspect your profile and workflow configurations at any time.</li>
              <li><strong className="text-foreground">Right to Data Portability (Article 20):</strong> Export your full personal profile, workflows, and execution logs in machine-readable JSON format.</li>
              <li><strong className="text-foreground">Right to Erasure / "Right to be Forgotten" (Article 17):</strong> Permanently delete your account and all associated workflow assets directly from your Dashboard settings.</li>
            </ul>
          </div>

          {/* Section 3: Subprocess Security & Python Sandbox */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" /> 3. Code Execution & Subprocess Isolation
            </h4>
            <p>
              Custom Python snippets executed inside workflows run strictly inside isolated process sandbox containers with restricted builtins whitelist and 5.0s execution timeout limits. No personal or system data is stored outside your designated workspace database.
            </p>
          </div>

          {/* Section 4: Email Communications */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Download className="h-4 w-4 text-pink-400" /> 4. Transactional Mail Delivery via Mailtrap
            </h4>
            <p>
              Verification codes are dispatched via Mailtrap Official SDK using end-to-end encrypted TLS transport. We never send unsolicited marketing messages or share data with third-party advertising brokers.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border/40 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Close & Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
