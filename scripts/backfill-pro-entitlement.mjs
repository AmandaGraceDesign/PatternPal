#!/usr/bin/env node
/**
 * One-off sweep: find paying Stripe subscribers whose Clerk `publicMetadata.pro`
 * is not `true`, and re-grant it.
 *
 * Why this exists: entitlement is a single Clerk boolean with no Stripe
 * fallback (src/lib/utils/checkProStatus.ts). Before 051cad3 the webhook's
 * revoke paths could write `pro: false` off a stale subscription belonging to a
 * customer whose live subscription was paid. That fix stops NEW lockouts but
 * does not heal anyone already stuck. This script heals them.
 *
 * Direction matters: we sweep Stripe -> Clerk, not Clerk -> Stripe. Anyone
 * entitled must own an active or trialing subscription, so the Stripe side is
 * the complete population and it is ~300 lookups instead of one per free user.
 *
 * Usage:
 *   node scripts/backfill-pro-entitlement.mjs            # dry run, writes nothing
 *   node scripts/backfill-pro-entitlement.mjs --apply    # actually re-grants Pro
 *
 * Reads STRIPE_SECRET_KEY and CLERK_SECRET_KEY from .env.local.
 * Writes a full report to scripts/backfill-report.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const APPLY = process.argv.includes("--apply");
const ENTITLED_STATUSES = ["active", "trialing"];

// --- env -------------------------------------------------------------------

function loadEnvLocal() {
  const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");

  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    // .trim() first: a CRLF file otherwise leaves \r on the end of the value,
    // which silently turns a valid secret into a 401.
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

for (const key of ["STRIPE_SECRET_KEY", "CLERK_SECRET_KEY"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} - cannot run.`);
    process.exit(1);
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const mode = process.env.STRIPE_SECRET_KEY.startsWith("sk_live")
  ? "LIVE"
  : "TEST";

// --- step 1: every entitling subscription in Stripe ------------------------

async function collectEntitledSubscribers() {
  /** @type {Map<string, {email: string, subscriptionId: string, customerId: string, status: string}>} */
  const byEmail = new Map();
  let noEmail = 0;

  for (const status of ENTITLED_STATUSES) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      expand: ["data.customer"],
    })) {
      const customer = sub.customer;
      const email =
        customer && typeof customer === "object" && !customer.deleted
          ? customer.email
          : null;

      if (!email) {
        noEmail += 1;
        console.warn(
          `  ! subscription ${sub.id} (${status}) has no usable customer email - skipping`
        );
        continue;
      }

      const key = email.trim().toLowerCase();

      // An email can own several entitling subscriptions. Prefer `active` over
      // `trialing` so the recorded pointer is the sturdier one.
      const existing = byEmail.get(key);
      if (existing && existing.status === "active") continue;

      byEmail.set(key, {
        email: email.trim(),
        subscriptionId: sub.id,
        customerId: customer.id,
        status: sub.status,
      });
    }
  }

  return { subscribers: [...byEmail.values()], noEmail };
}

// --- step 2: reconcile each one against Clerk ------------------------------

async function reconcile(subscriber) {
  const users = await clerk.users.getUserList({
    emailAddress: [subscriber.email],
  });

  if (!users.data.length) {
    return { ...subscriber, outcome: "no_clerk_account", userId: null };
  }

  const user = users.data[0];

  if (user.publicMetadata?.pro === true) {
    return { ...subscriber, outcome: "already_pro", userId: user.id };
  }

  if (!APPLY) {
    return { ...subscriber, outcome: "would_regrant", userId: user.id };
  }

  await clerk.users.updateUser(user.id, {
    publicMetadata: { ...(user.publicMetadata ?? {}), pro: true },
    privateMetadata: {
      ...(user.privateMetadata ?? {}),
      stripeCustomerId: subscriber.customerId,
      stripeSubscriptionId: subscriber.subscriptionId,
    },
  });

  return { ...subscriber, outcome: "regranted", userId: user.id };
}

// --- run -------------------------------------------------------------------

async function main() {
  console.log(
    `\nPro entitlement backfill - ${mode} mode - ${APPLY ? "APPLY (will write to Clerk)" : "DRY RUN (writes nothing)"}\n`
  );

  console.log("Listing active + trialing subscriptions in Stripe...");
  const { subscribers, noEmail } = await collectEntitledSubscribers();
  console.log(
    `Found ${subscribers.length} unique entitled email addresses.\n`
  );

  const results = [];

  for (const [index, subscriber] of subscribers.entries()) {
    const position = `[${index + 1}/${subscribers.length}]`;

    try {
      const result = await reconcile(subscriber);
      results.push(result);

      if (result.outcome === "already_pro") continue;

      console.log(`${position} ${result.outcome.toUpperCase()} ${subscriber.email} (${subscriber.status}, ${subscriber.subscriptionId})`);
    } catch (err) {
      console.error(`${position} ERROR ${subscriber.email}`, err.message);
      results.push({ ...subscriber, outcome: "error", error: err.message });
    }
  }

  const tally = results.reduce((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});

  const reportPath = resolve(HERE, "backfill-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      { mode, applied: APPLY, subscriptionsWithoutEmail: noEmail, tally, results },
      null,
      2
    )
  );

  console.log("\n--- summary ---");
  console.log(`already Pro, no action .... ${tally.already_pro ?? 0}`);
  console.log(
    `${APPLY ? "re-granted Pro ............" : "would re-grant Pro ........"} ${(APPLY ? tally.regranted : tally.would_regrant) ?? 0}`
  );
  console.log(`paid, no Clerk account .... ${tally.no_clerk_account ?? 0}`);
  console.log(`errors .................... ${tally.error ?? 0}`);
  console.log(`\nFull report: ${reportPath}`);

  if (!APPLY && (tally.would_regrant ?? 0) > 0) {
    console.log("\nRe-run with --apply to actually re-grant these users.");
  }
}

main().catch((err) => {
  console.error("\nSweep failed:", err);
  process.exit(1);
});
