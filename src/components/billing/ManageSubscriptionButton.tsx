"use client";

import { useRouter } from "next/navigation";

export default function ManageSubscriptionButton() {
  const router = useRouter();

  const handleClick = async () => {
    try {
      const res = await fetch("/api/create-portal-link", { method: "POST" });
      const text = await res.text();
      let data: { url?: string; error?: string } | null = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("Failed to parse portal link response", parseError);
        }
      }

      if (res.ok && data?.url) {
        router.push(data.url);
      } else {
        const message =
          data?.error || "Could not open Stripe billing portal";
        window.alert(message);
      }
    } catch (error) {
      console.error("Failed to open billing portal", error);
      window.alert("Could not open Stripe billing portal");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
    >
      Manage Subscription
    </button>
  );
}
