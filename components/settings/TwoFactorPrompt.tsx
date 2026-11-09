"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { dismissTwoFactorPrompt } from "@/lib/actions/security";

/**
 * Optional 2FA offer, shown in the app (never on the sign-in screen) to
 * people without 2FA. Either answer is saved on the server, so it doesn't
 * come back for 30 days on any device. 2FA itself stays optional.
 */
export function TwoFactorPrompt() {
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function answer(setUp: boolean) {
    setOpen(false);
    startTransition(async () => {
      await dismissTwoFactorPrompt();
      if (setUp) router.push("/settings#two-factor");
    });
  }

  return (
    <Modal open={open} onClose={() => answer(false)} title="Protect your account">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Turn on two-factor authentication: when you sign in, you&apos;ll also enter a code from an authenticator app
          (Google Authenticator, 1Password, Authy…). It&apos;s optional, and you can change it any time in Settings.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => answer(false)}>
            Not now
          </Button>
          <Button onClick={() => answer(true)}>Set it up</Button>
        </div>
      </div>
    </Modal>
  );
}
