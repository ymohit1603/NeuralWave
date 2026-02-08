# Live Mode Migration - DodoPayments

## Changes Made

### 1. Updated Product IDs (Test → Live)

**Test Mode (OLD):**
- Weekly: `pdt_0NXD7Umc3hmVRX5zSaA60`
- Yearly: `pdt_0NXD7IyCyyfmzj0CLbw1S`
- Lifetime: `pdt_0NXD7B2s8C1xq86fGizyf`

**Live Mode (NEW):**
- Weekly: `pdt_0NY4WWfzpoe7TaaVa7MPa`
- Yearly: `pdt_0NY4WXOt0LVbL3MPY8HuR`
- Lifetime: `pdt_0NY4WYX9oEAwLgjqjmaGC`

### 2. Updated Checkout URLs

**Test Mode (OLD):**
```
https://test.checkout.dodopayments.com/buy/...
```

**Live Mode (NEW):**
```
https://checkout.dodopayments.com/buy/...
```

### 3. Files Updated

✅ `src/lib/payments.ts` - Updated all checkout URLs and product IDs
✅ `src/app/api/webhooks/dodo/route.ts` - Updated PRODUCT_TO_PLAN mapping
✅ `.env.example` - Updated documentation with new product IDs

### 4. Webhook Secret

⚠️ **IMPORTANT**: You need to update the webhook secret in Vercel environment variables!

The webhook secret has changed from test mode to live mode. Make sure to:
1. Get the new webhook secret from DodoPayments live mode dashboard
2. Update it in Vercel: Settings → Environment Variables → `DODO_WEBHOOK_SECRET`
3. Redeploy the app after updating

## Deployment Checklist

### Before Deploying

- [x] Update product IDs in `src/lib/payments.ts`
- [x] Update product IDs in `src/app/api/webhooks/dodo/route.ts`
- [x] Update `.env.local` with new webhook secret
- [ ] Update Vercel environment variables with new webhook secret
- [ ] Update DodoPayments webhook URL (should still be the same)

### Vercel Environment Variables

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Update these for **Production**:
```
DODO_WEBHOOK_SECRET=<your-new-live-mode-secret>
```

Keep these the same:
```
NEXT_PUBLIC_SUPABASE_URL=https://enbesxwtvgquiubwdznu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vbNvpn-4CqHMRs6-NsEBJw_fDSxuVSn
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### DodoPayments Configuration

In DodoPayments **Live Mode** Dashboard:

1. **Webhook URL**: `https://neural-wave.vercel.app/api/webhooks/dodo`
2. **Events to subscribe**: All payment and subscription events
3. **Secret**: Copy this and add to Vercel env vars

### After Deployment

1. **Test Payment Flow**
   - Go to `/dashboard/upgrade`
   - Click on a plan
   - Complete payment with real card (or test card in live mode)
   - Check Vercel logs for webhook processing
   - Verify subscription in Supabase

2. **Verify Webhook**
   ```bash
   vercel logs --follow
   ```
   Look for:
   ```
   [Webhook] ✓ Signature verified
   [Webhook] Using product ID: pdt_0NY4WYX9oEAwLgjqjmaGC
   [Webhook] Plan type: lifetime
   [Webhook] ✓ Created subscription for user
   ```

3. **Check Subscription**
   - User should see Pro badge in dashboard
   - "Manage Plan" link should be visible
   - Pro features should be unlocked

## Product URLs

### Weekly Plan
```
https://checkout.dodopayments.com/buy/pdt_0NY4WWfzpoe7TaaVa7MPa?quantity=1
```

### Yearly Plan
```
https://checkout.dodopayments.com/buy/pdt_0NY4WXOt0LVbL3MPY8HuR?quantity=1
```

### Lifetime Plan
```
https://checkout.dodopayments.com/buy/pdt_0NY4WYX9oEAwLgjqjmaGC?quantity=1
```

## Testing in Live Mode

### Test Cards (if DodoPayments supports test mode in live)
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`

### Real Payments
⚠️ **WARNING**: Live mode charges real money!
- Use your own card for testing
- Test with the cheapest plan first (weekly)
- Verify webhook processes correctly
- Check subscription is created in database
- Test upgrade flow (weekly → lifetime)

## Rollback Plan

If something goes wrong:

1. **Revert to test mode**:
   - Change URLs back to `test.checkout.dodopayments.com`
   - Change product IDs back to test mode IDs
   - Update webhook secret to test mode secret
   - Redeploy

2. **Or rollback deployment**:
   ```bash
   vercel rollback
   ```

## Common Issues

### Issue: Webhook signature verification fails
**Solution**: 
- Verify you updated `DODO_WEBHOOK_SECRET` in Vercel
- Make sure you're using the LIVE mode secret, not test mode
- Redeploy after updating env vars

### Issue: Product ID not found
**Solution**:
- Check the webhook logs for the actual product_id received
- Verify it matches one of the new live mode product IDs
- Update `PRODUCT_TO_PLAN` mapping if needed

### Issue: Payment succeeds but subscription not created
**Solution**:
- Check Vercel logs for webhook errors
- Verify webhook is configured in DodoPayments live mode
- Check Supabase for any database errors

## Success Indicators

✅ Payment completes successfully
✅ Webhook logs show: `[Webhook] ✓ Signature verified`
✅ Webhook logs show: `[Webhook] ✓ Created subscription for user`
✅ Supabase `subscriptions` table has new entry
✅ User sees Pro badge in dashboard
✅ User can access Pro features
✅ "Manage Plan" link is visible

## Next Steps

1. Deploy to Vercel with updated code
2. Update `DODO_WEBHOOK_SECRET` in Vercel env vars
3. Test with a real payment (use weekly plan for testing)
4. Monitor webhook logs
5. Verify subscription creation
6. Test upgrade flow
7. Monitor for any issues

---

## Ready to Deploy? ✅

All code changes are complete. Just need to:
1. Update Vercel environment variable: `DODO_WEBHOOK_SECRET`
2. Deploy to production
3. Test with real payment

```bash
git add .
git commit -m "Migrate to DodoPayments live mode"
git push origin main
```

Or deploy directly:
```bash
vercel --prod
```
