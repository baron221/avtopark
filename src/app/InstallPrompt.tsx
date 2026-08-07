"use client";

import { useEffect, useState } from "react";

// Not yet in TypeScript's DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "avtopark-install-dismissed-at";
const DISMISS_DAYS = 14;

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;

    // Safari on iOS never fires beforeinstallprompt — "Add to Home Screen"
    // is always a manual step via the Share sheet, so we show instructions
    // instead of waiting for an event that will never come. Must stay
    // effect-only (not derived during render) so the client's first render
    // matches the server's window-less one and avoids a hydration mismatch.
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setPlatform("ios");
      setVisible(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md bg-card border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
      <div className="flex-1 text-sm min-w-0">
        {platform === "ios" ? (
          <>
            <div className="font-extrabold text-heading">Иловани ўрнатиш</div>
            <div className="text-muted-2 text-xs mt-0.5">
              Улашиш <span aria-hidden>⎋</span> тугмасини босиб, «Бош экранга қўшиш» ни танланг
            </div>
          </>
        ) : (
          <div className="font-extrabold text-heading">Иловани телефонга ўрнатасизми?</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {platform === "android" && (
          <button
            type="button"
            onClick={install}
            className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-extrabold"
          >
            Ўрнатиш
          </button>
        )}
        <button type="button" onClick={dismiss} title="Ёпиш" className="text-muted-2 text-base font-bold px-2 py-1.5 leading-none">
          ✕
        </button>
      </div>
    </div>
  );
}
