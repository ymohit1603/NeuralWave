# DodoPayments Webhook Setup Guide

## Issues Fixed

### 1. Environment Variables Not Loading
**Problem:** `process.env.DODO_WEBHOOK_SECRET` was returning undefined
**Solution:** 
- Added `export const dynamic = 'force-dynamic'` to force runtime environment variable reading
- Changed from static constants to functions that read env vars at runtime
- Added detailed logging to verify env vars are loaded

### 2. Webhook Event Undefined
**Problem:** Webhook was receiving `undefined` for event type
**Solution:**
- Added comprehensive logging to see raw payload
- Added validation to check if event exists before processing
- Logs full webhook data structure for debugging

### 3. Success Redirect Not Working
**Problem:** After payment, user wasn't redirected to dashboard
**Solution:**
- Updated `initiateCheckout()` to properly set `success_url` parameter
- Success page already has auto-redirect after 3 seconds
- Added fallback base URL for server-side rendering

## Webhook URL

Configure this in your DodoPayments dashboard:

```
https://neural-wave.vercel.app/api/webhooks/dodo
```

## Environment Variables Required

Make sure these are set in **Vercel** (not just .env.local):

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://enbesxwtvgquiubwdznu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vbNvpn-4CqHMRs6-NsEBJw_fDSxuVSn
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DODO_WEBHOOK_SECRET=whsec_tRae7dpmIwqkZ24hCV2tmoOTn6cgeyg0
```

3. **Important:** After adding env vars, redeploy your app!

## Testing the Webhook

### 1. Check Webhook Logs

After making a test payment, check Vercel logs:

```bash
vercel logs --follow
```

You should see:
```
[Webhook] ========================================
[Webhook] Received webhook request
[Webhook] Secret configured: YES
[Webhook] Event type: payment.succeeded
[Webhook] Processing payment success...
```

### 2. Test Payment Flow

1. Go to `/dashboard/upgrade`
2. Click on a plan
3. Complete payment in DodoPayments
4. You should be redirected to `/payment/success?plan=weekly`
5. After 3 seconds, auto-redirect to `/dashboard`

### 3. Verify Subscription Created

Check your Supabase database:
```sql
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;
```

## Webhook Events Handled

✅ `payment.succeeded` - Creates/updates subscription
✅ `subscription.active` - Activates subscription
✅ `subscription.renewed` - Renews subscription
✅ `payment.failed` - Logs failure
✅ `payment.cancelled` - Cancels payment
✅ `subscription.cancelled` - Cancels subscription
✅ `subscription.expired` - Expires subscription
✅ `refund.succeeded` - Processes refund
✅ `subscription.on_hold` - Puts subscription on hold
✅ `subscription.plan_changed` - Updates plan type

## Troubleshooting

### Webhook Secret Not Found
**Symptom:** `[Webhook] Secret configured: NO`
**Fix:** 
1. Add `DODO_WEBHOOK_SECRET` to Vercel environment variables
2. Redeploy the app
3. Test again

### Event Type Undefined
**Symptom:** `[Webhook] Event type: undefined`
**Fix:**
1. Check DodoPayments webhook configuration
2. Ensure webhook is sending JSON payload
3. Check the raw payload in logs to see actual structure

### Subscription Not Created
**Symptom:** Payment succeeds but no subscription in database
**Fix:**
1. Check if `client_reference_id` is being passed (should be user ID)
2. Verify product IDs match in `PRODUCT_TO_PLAN` mapping
3. Check Supabase logs for database errors

### Redirect Not Working
**Symptom:** Stays on payment page after success
**Fix:**
1. Verify `success_url` parameter is set in checkout URL
2. Check browser console for JavaScript errors
3. Ensure user is logged in (auth context)

## Next Steps

1. **Deploy to Vercel** with environment variables
2. **Configure webhook** in DodoPayments dashboard
3. **Test with real payment** (use test mode first)
4. **Monitor logs** to ensure everything works
5. **Switch to production** mode when ready

## Support

If issues persist:
1. Check Vercel function logs
2. Check DodoPayments webhook delivery logs
3. Verify all environment variables are set correctly
4. Ensure Supabase tables exist and have correct permissions
