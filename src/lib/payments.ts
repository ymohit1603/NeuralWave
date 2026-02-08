import { supabase } from './supabase';

export const PAYMENT_PLANS = {
  weekly: {
    name: 'Weekly Pro',
    price: '$7.99',
    period: 'per week',
    checkoutUrl: 'https://test.checkout.dodopayments.com/buy/pdt_0NXD7Umc3hmVRX5zSaA60?quantity=1',
    productId: 'pdt_0NXD7Umc3hmVRX5zSaA60',
  },
  yearly: {
    name: 'Yearly Pro',
    price: '$39.99',
    period: 'per year',
    checkoutUrl: 'https://test.checkout.dodopayments.com/buy/pdt_0NXD7IyCyyfmzj0CLbw1S?quantity=1',
    productId: 'pdt_0NXD7IyCyyfmzj0CLbw1S',
    savings: 'Save 90%',
  },
  lifetime: {
    name: 'Lifetime Access',
    price: '$199.99',
    period: 'one-time',
    checkoutUrl: 'https://test.checkout.dodopayments.com/buy/pdt_0NXD7B2s8C1xq86fGizyf?quantity=1',
    productId: 'pdt_0NXD7B2s8C1xq86fGizyf',
    savings: 'Best Value',
  },
} as const;

export type PlanType = keyof typeof PAYMENT_PLANS;

export async function initiateCheckout(planType: PlanType, userId: string) {
  const plan = PAYMENT_PLANS[planType];
  
  // Add user_id as a custom parameter to the checkout URL
  const checkoutUrl = new URL(plan.checkoutUrl);
  checkoutUrl.searchParams.set('client_reference_id', userId);
  
  // Set success and cancel URLs
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://neural-wave.vercel.app';
  checkoutUrl.searchParams.set('success_url', `${baseUrl}/payment/success?plan=${planType}`);
  checkoutUrl.searchParams.set('cancel_url', `${baseUrl}/dashboard/upgrade`);
  
  console.log('[Payment] Checkout URL:', checkoutUrl.toString());
  console.log('[Payment] User ID:', userId);
  console.log('[Payment] Plan:', planType);
  
  // Open checkout in same window
  window.location.href = checkoutUrl.toString();
}

export async function createSubscription(
  userId: string,
  planType: PlanType,
  dodoPaymentId?: string
) {
  const now = new Date();
  let expiresAt: Date | null = null;

  // Calculate expiration date
  if (planType === 'weekly') {
    expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);
  } else if (planType === 'yearly') {
    expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }
  // lifetime has no expiration

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_type: planType,
      status: 'active',
      dodo_payment_id: dodoPaymentId || null,
      started_at: now.toISOString(),
      expires_at: expiresAt?.toISOString() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }

  return data;
}

export async function cancelSubscription(subscriptionId: string) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId);

  if (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
}

export async function getActiveSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows returned" which is fine
    console.error('Error fetching subscription:', error);
    throw error;
  }

  return data;
}
