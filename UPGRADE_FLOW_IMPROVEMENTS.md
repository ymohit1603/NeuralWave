# Upgrade Flow Improvements

## What Was Fixed

### Problem
When a user had an active subscription (e.g., weekly or yearly), the upgrade page would show "Current Plan" and disable all buttons, preventing them from upgrading to a better plan like Lifetime Access.

### Solution
Added smart upgrade logic that allows users to upgrade to better plans while preventing downgrades.

## Changes Made

### 1. Added `canUpgrade` Logic
Each plan now has a `canUpgrade` property that determines if it's an upgrade option:

- **Weekly Plan**: `canUpgrade: false` - Can't upgrade to itself
- **Yearly Plan**: `canUpgrade: true` if user has weekly - Can upgrade from weekly
- **Lifetime Plan**: `canUpgrade: true` if user has weekly or yearly - Can upgrade from any plan

### 2. Updated Button Behavior
- **Current Plan**: Shows "Current Plan" and is disabled
- **Upgrade Available**: Shows "Upgrade to [Plan Name]" and is enabled
- **New Subscription**: Shows "Upgrade Now" or "Get Started"

### 3. Added Visual Indicators
- **Current Plan Badge**: Shows which plan the user currently has
- **Upgrade Available Badge**: Green badge on plans that are upgrades
- **90% OFF Badge**: Highlights the yearly plan savings

### 4. Dynamic Hero Section
- **For Free Users**: "Supercharge Your Brain with Pro"
- **For Subscribers**: "Upgrade Your Plan" with current plan info

### 5. Contextual FAQ Section
- **For Free Users**: Explains free vs pro differences
- **For Subscribers**: Explains upgrade process and lifetime benefits

## User Experience Flow

### Scenario 1: Free User
1. Sees all three plans
2. All plans show "Get Started" or "Upgrade Now"
3. Can purchase any plan

### Scenario 2: Weekly Subscriber
1. Sees "Current Plan" badge on Weekly
2. Sees "Upgrade Available" badge on Yearly and Lifetime
3. Can upgrade to Yearly or Lifetime
4. Weekly button is disabled

### Scenario 3: Yearly Subscriber
1. Sees "Current Plan" badge on Yearly
2. Sees "Upgrade Available" badge on Lifetime only
3. Can upgrade to Lifetime
4. Weekly and Yearly buttons are disabled

### Scenario 4: Lifetime Subscriber
1. Sees "Current Plan" badge on Lifetime
2. All buttons are disabled
3. Message shows they have the best plan

## Upgrade Logic

```typescript
// Weekly Plan
canUpgrade: false // Can't upgrade to itself

// Yearly Plan
canUpgrade: subscriptionPlan === 'weekly' // Only from weekly

// Lifetime Plan
canUpgrade: subscriptionPlan === 'weekly' || subscriptionPlan === 'yearly' // From any paid plan
```

## Benefits

✅ **Upsell Opportunity**: Users can easily upgrade to better plans
✅ **Clear Communication**: Visual badges show upgrade options
✅ **Prevent Confusion**: Current plan is clearly marked
✅ **Maximize Revenue**: Lifetime upgrades are always visible to paid users
✅ **Better UX**: Contextual messaging based on subscription status

## Testing Checklist

### As Free User
- [ ] Can see all three plans
- [ ] All buttons are enabled
- [ ] Can click any plan to purchase

### As Weekly Subscriber
- [ ] Weekly shows "Current Plan" (disabled)
- [ ] Yearly shows "Upgrade Available" (enabled)
- [ ] Lifetime shows "Upgrade Available" (enabled)
- [ ] Can click Yearly or Lifetime to upgrade

### As Yearly Subscriber
- [ ] Yearly shows "Current Plan" (disabled)
- [ ] Lifetime shows "Upgrade Available" (enabled)
- [ ] Weekly button is disabled (can't downgrade)
- [ ] Can click Lifetime to upgrade

### As Lifetime Subscriber
- [ ] Lifetime shows "Current Plan" (disabled)
- [ ] All other buttons are disabled
- [ ] Message confirms they have the best plan

## Future Enhancements

### Potential Additions
1. **Proration**: Calculate prorated pricing for upgrades
2. **Downgrade Option**: Allow downgrades at next billing cycle
3. **Plan Comparison**: Side-by-side feature comparison
4. **Usage Stats**: Show how much they've used to justify upgrade
5. **Limited Time Offers**: Special upgrade pricing for existing users

### DodoPayments Integration
When a user upgrades:
1. New payment is processed
2. Webhook receives `subscription.plan_changed` event
3. Database updates to new plan type
4. User immediately gets new features

## Notes

- Upgrades take effect immediately
- Old subscription is replaced with new one
- Webhook handles the database update
- No manual intervention needed
