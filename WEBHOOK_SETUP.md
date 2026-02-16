# Stripe Webhook Configuration Update

## ⚠️ IMPORTANT: Update Your Stripe Webhook Settings

The webhook handler now properly handles subscription lifecycle events. You need to update your Stripe webhook configuration to listen for these events.

## Steps to Update Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click on your existing webhook endpoint
3. Click "Add events" or "Configure events"
4. Ensure the following events are selected:

### Required Events:
- ✅ `customer.subscription.created` (already enabled)
- ✅ `customer.subscription.updated` (NEW - add this)
- ✅ `customer.subscription.deleted` (NEW - add this)
- ✅ `invoice.payment_failed` (NEW - add this)

5. Click "Add events" to save

## What Each Event Does:

| Event | Action | Pro Status |
|-------|--------|-----------|
| `customer.subscription.created` | User subscribes | ✅ Grants Pro |
| `customer.subscription.updated` | Status changes (canceled, past_due, etc.) | ❌ Revokes Pro if inactive |
| `customer.subscription.deleted` | Subscription ends | ❌ Revokes Pro |
| `invoice.payment_failed` | Payment fails | ❌ Revokes Pro |

## Security Fix Implemented:

**Before:** Users could cancel subscription but keep Pro access forever
**After:** Pro access is automatically revoked when:
- Subscription is canceled
- Subscription expires
- Payment fails
- Subscription status becomes inactive

## Testing:

1. Create a test subscription in Stripe test mode
2. Cancel it immediately
3. Verify that the user's Pro status is revoked
4. Check Clerk dashboard to confirm `publicMetadata.pro` is set to `false`

## Production Deployment:

After deploying this change:
1. Update webhook events in Stripe production dashboard
2. Consider auditing existing users with canceled subscriptions who still have Pro access
3. Run a cleanup script to sync Pro status with active Stripe subscriptions

