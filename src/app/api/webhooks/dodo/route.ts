import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic route to ensure environment variables are read at runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create a Supabase client with service role for server-side operations
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Missing Supabase environment variables');
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(url, key);
};

// DodoPayments webhook secret for verification
const getWebhookSecret = () => {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  console.log('[Webhook] Secret configured:', secret ? 'YES' : 'NO');
  console.log('[Webhook] Secret length:', secret?.length || 0);
  return secret || '';
};

// Product ID to plan type mapping
const PRODUCT_TO_PLAN: Record<string, 'weekly' | 'yearly' | 'lifetime'> = {
  'pdt_0NXD7Umc3hmVRX5zSaA60': 'weekly',
  'pdt_0NXD7IyCyyfmzj0CLbw1S': 'yearly',
  'pdt_0NXD7B2s8C1xq86fGizyf': 'lifetime',
};

interface DodoWebhookPayload {
  event: string;
  data: {
    payment_id: string;
    product_id: string;
    customer_email?: string;
    customer_id?: string;
    client_reference_id?: string; // This is the user_id we pass
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    metadata?: Record<string, string>;
  };
}

// Verify webhook signature (if DodoPayments provides one)
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const WEBHOOK_SECRET = getWebhookSecret();
  
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] ⚠️ Webhook signature verification skipped - no secret configured');
    console.warn('[Webhook] Set DODO_WEBHOOK_SECRET in your environment variables');
    return true; // Allow in development, but log warning
  }
  
  if (!signature) {
    console.warn('[Webhook] ⚠️ No signature provided in request');
    return true; // Some webhooks might not send signature initially
  }

  // DodoPayments typically uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const isValid = signature === expectedSignature || signature === `sha256=${expectedSignature}`;
  
  if (!isValid) {
    console.error('[Webhook] ❌ Invalid signature');
    console.error('[Webhook] Expected:', expectedSignature.substring(0, 20) + '...');
    console.error('[Webhook] Received:', signature.substring(0, 20) + '...');
  } else {
    console.log('[Webhook] ✓ Signature verified');
  }
  
  return isValid;
}

export async function POST(request: NextRequest) {
  console.log('[Webhook] ========================================');
  console.log('[Webhook] Received webhook request');
  
  try {
    const payload = await request.text();
    console.log('[Webhook] Payload length:', payload.length);
    console.log('[Webhook] Raw payload:', payload.substring(0, 200));
    
    const signature = request.headers.get('x-dodo-signature') || 
                     request.headers.get('x-webhook-signature') ||
                     request.headers.get('dodo-signature');
    
    console.log('[Webhook] Signature header:', signature ? 'Present' : 'Missing');
    console.log('[Webhook] All headers:', Object.fromEntries(request.headers.entries()));

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('[Webhook] ❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookData: DodoWebhookPayload = JSON.parse(payload);
    console.log('[Webhook] Parsed webhook data:', JSON.stringify(webhookData, null, 2));
    console.log('[Webhook] Event type:', webhookData.event);
    console.log('[Webhook] Event data:', webhookData.data);

    if (!webhookData.event) {
      console.error('[Webhook] ❌ No event type in webhook payload');
      console.error('[Webhook] Full payload:', webhookData);
      return NextResponse.json({ error: 'No event type provided' }, { status: 400 });
    }

    // Handle different webhook events
    switch (webhookData.event) {
      case 'payment.succeeded':
      case 'subscription.active':
      case 'subscription.renewed':
        await handlePaymentSuccess(webhookData.data);
        break;

      case 'payment.failed':
      case 'subscription.failed':
        await handlePaymentFailed(webhookData.data);
        break;

      case 'payment.cancelled':
      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionCancelled(webhookData.data);
        break;

      case 'refund.succeeded':
        await handleRefund(webhookData.data);
        break;

      case 'refund.failed':
        console.log('Refund failed:', webhookData.data.payment_id);
        break;

      case 'subscription.on_hold':
        await handleSubscriptionOnHold(webhookData.data);
        break;

      case 'subscription.plan_changed':
        await handleSubscriptionPlanChanged(webhookData.data);
        break;

      case 'payment.processing':
        console.log('Payment processing:', webhookData.data.payment_id);
        break;

      case 'license_key.created':
        console.log('License key created:', webhookData.data);
        break;

      case 'dispute.opened':
      case 'dispute.challenged':
      case 'dispute.accepted':
      case 'dispute.cancelled':
      case 'dispute.expired':
      case 'dispute.won':
      case 'dispute.lost':
        console.log('Dispute event:', webhookData.event, webhookData.data);
        break;

      default:
        console.log('[Webhook] ⚠️ Unhandled webhook event:', webhookData.event);
    }

    console.log('[Webhook] ✓ Webhook processed successfully');
    console.log('[Webhook] ========================================');
    return NextResponse.json({ received: true, event: webhookData.event });
  } catch (error) {
    console.error('[Webhook] ========================================');
    console.error('[Webhook] ❌ Webhook processing error:', error);
    console.error('[Webhook] Error details:', error instanceof Error ? error.message : String(error));
    console.error('[Webhook] ========================================');
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing payment success...');
  const { payment_id, product_id, client_reference_id, customer_email } = data;
  
  console.log('[Webhook] Payment ID:', payment_id);
  console.log('[Webhook] Product ID:', product_id);
  console.log('[Webhook] Client Reference ID:', client_reference_id);
  console.log('[Webhook] Customer Email:', customer_email);

  // Get plan type from product ID
  const planType = PRODUCT_TO_PLAN[product_id];
  if (!planType) {
    console.error('[Webhook] ❌ Unknown product ID:', product_id);
    console.error('[Webhook] Available products:', Object.keys(PRODUCT_TO_PLAN));
    return;
  }
  
  console.log('[Webhook] Plan type:', planType);

  // Get user ID from client_reference_id or look up by email
  let userId = client_reference_id;

  if (!userId && customer_email) {
    console.log('[Webhook] Looking up user by email:', customer_email);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email === customer_email);
    userId = user?.id;
    console.log('[Webhook] Found user ID:', userId);
  }

  if (!userId) {
    console.error('[Webhook] ❌ Could not determine user ID for payment:', payment_id);
    const supabaseAdmin = getSupabaseAdmin();
    // Store the payment for later reconciliation
    await supabaseAdmin.from('pending_payments').insert({
      payment_id,
      product_id,
      customer_email,
      plan_type: planType,
      created_at: new Date().toISOString(),
    });
    console.log('[Webhook] Stored as pending payment');
    return;
  }

  // Calculate expiration date
  const now = new Date();
  let expiresAt: Date | null = null;

  if (planType === 'weekly') {
    expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);
  } else if (planType === 'yearly') {
    expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }
  // lifetime has no expiration

  // Check if user already has an active subscription
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingSubscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (existingSubscription) {
    console.log('[Webhook] Updating existing subscription:', existingSubscription.id);
    // Update existing subscription
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_type: planType,
        dodo_payment_id: payment_id,
        expires_at: expiresAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSubscription.id);

    if (error) {
      console.error('[Webhook] ❌ Error updating subscription:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Updated subscription for user:', userId);
  } else {
    console.log('[Webhook] Creating new subscription');
    // Create new subscription
    const { error } = await supabaseAdmin.from('subscriptions').insert({
      user_id: userId,
      plan_type: planType,
      status: 'active',
      dodo_payment_id: payment_id,
      started_at: now.toISOString(),
      expires_at: expiresAt?.toISOString() || null,
    });

    if (error) {
      console.error('[Webhook] ❌ Error creating subscription:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Created subscription for user:', userId, 'Plan:', planType);
  }
}

async function handlePaymentFailed(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Payment failed:', data.payment_id);
  // Optionally log failed payments for analytics
}

async function handleSubscriptionCancelled(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing subscription cancellation...');
  const { client_reference_id, payment_id } = data;
  const supabaseAdmin = getSupabaseAdmin();

  if (client_reference_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', client_reference_id)
      .eq('status', 'active');

    if (error) {
      console.error('[Webhook] ❌ Error cancelling subscription:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Cancelled subscription for user:', client_reference_id);
  } else if (payment_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('dodo_payment_id', payment_id);

    if (error) {
      console.error('[Webhook] ❌ Error cancelling subscription:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Cancelled subscription for payment:', payment_id);
  }
}

async function handleRefund(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing refund...');
  const { payment_id } = data;
  const supabaseAdmin = getSupabaseAdmin();

  // Mark subscription as refunded/cancelled
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('dodo_payment_id', payment_id);

  if (error) {
    console.error('[Webhook] ❌ Error processing refund:', error);
    throw error;
  }

  console.log('[Webhook] ✓ Processed refund for payment:', payment_id);
}

async function handleSubscriptionOnHold(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing subscription on hold...');
  const { client_reference_id, payment_id } = data;
  const supabaseAdmin = getSupabaseAdmin();

  if (client_reference_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'on_hold', updated_at: new Date().toISOString() })
      .eq('user_id', client_reference_id)
      .eq('status', 'active');

    if (error) {
      console.error('[Webhook] ❌ Error putting subscription on hold:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Put subscription on hold for user:', client_reference_id);
  } else if (payment_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'on_hold', updated_at: new Date().toISOString() })
      .eq('dodo_payment_id', payment_id);

    if (error) {
      console.error('[Webhook] ❌ Error putting subscription on hold:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Put subscription on hold for payment:', payment_id);
  }
}

async function handleSubscriptionPlanChanged(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing subscription plan change...');
  const { product_id, client_reference_id, payment_id } = data;

  // Get new plan type from product ID
  const planType = PRODUCT_TO_PLAN[product_id];
  if (!planType) {
    console.error('[Webhook] ❌ Unknown product ID:', product_id);
    return;
  }

  // Calculate new expiration date
  const now = new Date();
  let expiresAt: Date | null = null;

  if (planType === 'weekly') {
    expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);
  } else if (planType === 'yearly') {
    expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (client_reference_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_type: planType,
        expires_at: expiresAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', client_reference_id)
      .eq('status', 'active');

    if (error) {
      console.error('[Webhook] ❌ Error changing subscription plan:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Changed subscription plan for user:', client_reference_id, 'to:', planType);
  } else if (payment_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_type: planType,
        expires_at: expiresAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('dodo_payment_id', payment_id);

    if (error) {
      console.error('[Webhook] ❌ Error changing subscription plan:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Changed subscription plan for payment:', payment_id, 'to:', planType);
  }
}

// Also handle GET for webhook verification (some providers require this)
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return NextResponse.json({ challenge });
  }
  return NextResponse.json({ status: 'Webhook endpoint active' });
}
