"use client";

import { useState, useEffect } from "react";
import { Shield, Check, Cookie, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyModal } from "./PrivacyModal";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("gdpr_cookie_consent");
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("gdpr_cookie_consent", "all");
    setShowBanner(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem("gdpr_cookie_consent", "essential");
    setShowBanner(false);
  };

  if (!showBanner) return <PrivacyModal isOpen={isPrivacyModalOpen} onOpenChange={setIsPrivacyModalOpen} />;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 p-4 rounded-2xl bg-card/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl space-y-3 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-400 mt-0.5">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
              <Shield className="h-3.5 w-3.5 text-purple-400" /> Cookie Preferences & GDPR Consent
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We use essential session tokens and analytics cookies to secure workflow executions and enhance your experience. Read our{" "}
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(true)}
                className="text-purple-400 hover:underline font-medium inline-flex items-center gap-0.5"
              >
                Privacy Notice <ExternalLink className="h-2.5 w-2.5" />
              </button>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAcceptEssential}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            Essential Only
          </Button>
          <Button
            size="sm"
            onClick={handleAcceptAll}
            className="text-xs h-8 bg-purple-600 hover:bg-purple-500 text-white font-semibold gap-1"
          >
            <Check className="h-3.5 w-3.5" /> Accept All
          </Button>
        </div>
      </div>

      <PrivacyModal isOpen={isPrivacyModalOpen} onOpenChange={setIsPrivacyModalOpen} />
    </>
  );
}
