# Deployment Checklist ✅

## Build Status
✅ **Build successful** - No compilation errors
✅ **TypeScript check passed** - No type errors
✅ **Webhook route fixed** - All syntax errors resolved

## What Was Fixed

### 1. Webhook Route (`src/app/api/webhooks/dodo/route.ts`)
- ✅ Removed duplicate code that was causing syntax errors
- ✅ Fixed event field from `event` to `type` (DodoPayments format)
- ✅ Updated signature verification to use Svix format
- ✅ Changed to use `customer.email` for user lookup
- ✅ Updated all handler functions with correct field names
- ✅ Added comprehensive logging for debugging

### 2. Environment Variables
- ✅ Changed from static constants to runtime functions
- ✅ Added `export const dynamic = 'force-dynamic'`
- ✅ Proper error handling for missing env vars

### 3. Payment Flow
- ✅ Updated `initiateCheckout()` to set success_url properly
- ✅ Success page has auto-redirect to dashboard

## Before Deploying to Vercel

### 1. Set Environment Variables in Vercel
Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Add these for **Production**:
```
NEXT_PUBLIC_SUPABASE_URL=https://enbesxwtvgquiubwdznu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vbNvpn-4CqHMRs6-NsEBJw_fDSxuVSn
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DODO_WEBHOOK_SECRET=whsec_tRae7dpmIwqkZ24hCV2tmoOTn6cgeyg0
```

### 2. Configure DodoPayments Webhook
In DodoPayments Dashboard:
- **Webhook URL**: `https://neural-wave.vercel.app/api/webhooks/dodo`
- **Events to subscribe**: All payment and subscription events
- **Secret**: Already configured (whsec_tRae7dpmIwqkZ24hCV2tmoOTn6cgeyg0)

### 3. Test the Webhook
After deployment:
1. Make a test payment
2. Check Vercel logs: `vercel logs --follow`
3. Look for: `[Webhook] ✓ Created subscription for user`
4. Verify in Supabase: Check `subscriptions` table

## Deployment Commands

```bash
# Option 1: Push to Git (if connected to Vercel)
git add .
git commit -m "Fix webhook and payment flow"
git push origin main

# Option 2: Deploy directly with Vercel CLI
vercel --prod
```

## After Deployment

### 1. Test Payment Flow
1. Go to `/dashboard/upgrade`
2. Click on a plan (use test mode)
3. Complete payment
4. Check Vercel logs for webhook processing
5. Verify subscription in Supabase
6. Check if user sees Pro features

### 2. Monitor Logs
```bash
# Watch real-time logs
vercel logs --follow

# Check specific function logs
vercel logs --function=api/webhooks/dodo
```

### 3. Verify Webhook Deliveries
In DodoPayments Dashboard:
- Go to Webhooks section
- Check delivery status
- View request/response logs
- Retry failed webhooks if needed

## Common Issues & Solutions

### Issue: Webhook returns 401 (Invalid signature)
**Solution**: 
- Verify `DODO_WEBHOOK_SECRET` is set correctly in Vercel
- Check it matches the secret in DodoPayments dashboard
- Redeploy after updating env vars

### Issue: Webhook returns 500 (Processing failed)
**Solution**:
- Check Vercel logs for detailed error
- Verify Supabase credentials are correct
- Ensure `subscriptions` table exists with correct schema

### Issue: Subscription not created
**Solution**:
- Check if user email matches between payment and Supabase auth
- Look for `[Webhook] ❌ Could not find user` in logs
- Check `pending_payments` table for unmatched payments

### Issue: User not redirected after payment
**Solution**:
- This is expected - DodoPayments redirects to their status page
- Webhook still creates subscription automatically
- User can manually navigate to `/dashboard` to see Pro features
- Contact DodoPayments support to configure custom success URL

## Success Indicators

✅ Webhook logs show: `[Webhook] ✓ Created subscription for user`
✅ Supabase `subscriptions` table has new entry
✅ User sees Pro badge in dashboard
✅ User can access Pro features
✅ No errors in Vercel logs

## Rollback Plan

If something goes wrong:
```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy specific commit
vercel --prod --force
```

## Support Resources

- **Vercel Logs**: https://vercel.com/dashboard → Your Project → Logs
- **DodoPayments Dashboard**: https://dodopayments.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Webhook Testing**: Use DodoPayments webhook testing tool

---

## Ready to Deploy? ✅

All checks passed! You're ready to deploy to production.

```bash
git add .
git commit -m "Fix webhook integration and payment flow"
git push origin main
```

Or deploy directly:
```bash
vercel --prod
```
