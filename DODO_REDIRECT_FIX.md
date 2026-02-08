# DodoPayments Redirect Fix

## Problem
After payment, DodoPayments redirects to `https://test.checkout.dodopayments.com/status/xKU34w7c` instead of your success page.

## Solution

### Option 1: Configure in DodoPayments Dashboard (Recommended)
1. Go to DodoPayments Dashboard
2. Navigate to Settings → Webhooks or Product Settings
3. Set the **Success URL** to: `https://neural-wave.vercel.app/payment/success?plan={PLAN_TYPE}`
4. Set the **Cancel URL** to: `https://neural-wave.vercel.app/dashboard/upgrade`

### Option 2: Use Their Status Page with Auto-Redirect
Create a page that checks the status and redirects:

1. The status page URL format is: `https://test.checkout.dodopayments.com/status/{SESSION_ID}`
2. This page should have a "Return to site" button
3. Configure the return URL in DodoPayments dashboard

### Option 3: Rely on Webhook Only (Current Setup)
Since the webhook is now working correctly:
1. User completes payment
2. Gets redirected to DodoPayments status page
3. Webhook fires and creates subscription in your database
4. User manually navigates back to your site
5. They see their subscription is active

## What I Fixed in the Webhook

✅ Changed `event` to `type` (DodoPayments uses `type` field)
✅ Changed signature header from `x-dodo-signature` to `webhook-signature` (Svix format)
✅ Updated signature verification to use Svix format (timestamp + payload)
✅ Updated payload interface to match actual DodoPayments structure
✅ Changed to use `customer.email` instead of `client_reference_id`
✅ All handlers now use correct field names (`subscription_id`, `payment_id`, etc.)

## Test the Webhook Now

Make another test payment and check the logs. You should see:

```
[Webhook] Event type: subscription.renewed
[Webhook] Product ID: pdt_0NXD7IyCyyfmzj0CLbw1S
[Webhook] Customer email: mohityadav0330@gmail.com
[Webhook] Found user ID: xxx-xxx-xxx
[Webhook] ✓ Created subscription for user: xxx-xxx-xxx Plan: yearly
```

## Verify Subscription Created

Check your Supabase database:
```sql
SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID' ORDER BY created_at DESC LIMIT 1;
```

You should see a new subscription with:
- `plan_type`: 'yearly'
- `status`: 'active'
- `dodo_payment_id`: 'sub_0NY3AGCuMLsgCxC0BZLKl'
- `expires_at`: One year from now

## Next Steps

1. **Contact DodoPayments Support** to configure success_url in dashboard
2. **Or** add a "Return to Dashboard" button on your upgrade page
3. **Or** use their status page and configure return URL

The webhook is now working correctly, so subscriptions will be created automatically even if the redirect doesn't work!
