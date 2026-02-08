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
  type: string; // DodoPayments uses 'type' not 'event'
  business_id: string;
  timestamp: string;
  data: {
    subscription_id?: string;
    payment_id?: string;
    product_id?: string;
    product?: {
      product_id: string;
      name?: string;
      price?: number;
    };
    subscription?: {
      product_id: string;
      subscription_id: string;
      status: string;
    };
    customer: {
      customer_id: string;
      email: string;
      name: string;
      phone_number?: string;
      metadata?: Record<string, string>;
    };
    status: string;
    created_at: string;
    metadata?: Record<string, string>;
    payment_method_id?: string;
    currency?: string;
    recurring_pre_tax_amount?: number;
    quantity?: number;
    expires_at?: string;
    next_billing_date?: string;
    cancelled_at?: string;
  };
}

// Verify webhook signature using Svix format (DodoPayments uses Svix)
function verifyWebhookSignature(
  payload: string, 
  signature: string | null, 
  timestamp: string | null,
  webhookId: string | null
): boolean {
  const WEBHOOK_SECRET = getWebhookSecret();
  
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] ⚠️ Webhook signature verification skipped - no secret configured');
    console.warn('[Webhook] Set DODO_WEBHOOK_SECRET in your environment variables');
    return true; // Allow in development, but log warning
  }
  
  if (!signature || !timestamp) {
    console.warn('[Webhook] ⚠️ No signature or timestamp provided in request');
    return true; // Some webhooks might not send signature initially
  }

  try {
    const crypto = require('crypto');
    
    // Svix signed content format: {webhook-id}.{timestamp}.{payload}
    const signedContent = `${webhookId}.${timestamp}.${payload}`;
    
    // Svix secret format: whsec_xxxxx - decode the base64 part after whsec_
    let secretBytes: Buffer;
    if (WEBHOOK_SECRET.startsWith('whsec_')) {
      secretBytes = Buffer.from(WEBHOOK_SECRET.substring(6), 'base64');
    } else {
      // If secret doesn't have whsec_ prefix, use it as-is
      secretBytes = Buffer.from(WEBHOOK_SECRET);
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent, 'utf8')
      .digest('base64');

    // Svix signature format: v1,signature1 v1,signature2 (space-separated)
    const signatures = signature.split(' ');
    
    for (const sig of signatures) {
      const parts = sig.split(',');
      if (parts.length !== 2) continue;
      
      const [version, sigValue] = parts;
      if (version === 'v1' && sigValue === expectedSignature) {
        console.log('[Webhook] ✓ Signature verified');
        return true;
      }
    }
    
    console.error('[Webhook] ❌ Invalid signature');
    console.error('[Webhook] Expected:', expectedSignature);
    console.error('[Webhook] Received signatures:', signatures);
    console.error('[Webhook] Webhook ID:', webhookId);
    console.error('[Webhook] Timestamp:', timestamp);
    console.error('[Webhook] Payload length:', payload.length);
    
    return false;
  } catch (error) {
    console.error('[Webhook] ❌ Signature verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  console.log('[Webhook] ========================================');
  console.log('[Webhook] Received webhook request');
  
  try {
    const payload = await request.text();
    console.log('[Webhook] Payload length:', payload.length);
    
    // DodoPayments uses Svix, which sends these headers
    const signature = request.headers.get('webhook-signature');
    const timestamp = request.headers.get('webhook-timestamp');
    const webhookId = request.headers.get('webhook-id');
    
    console.log('[Webhook] Signature:', signature ? 'Present' : 'Missing');
    console.log('[Webhook] Timestamp:', timestamp);
    console.log('[Webhook] Webhook ID:', webhookId);

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, timestamp, webhookId)) {
      console.error('[Webhook] ❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookData: DodoWebhookPayload = JSON.parse(payload);
    console.log('[Webhook] Event type:', webhookData.type);
    console.log('[Webhook] Full data:', JSON.stringify(webhookData.data, null, 2));
    console.log('[Webhook] Product ID:', webhookData.data.product_id);
    console.log('[Webhook] Product object:', webhookData.data.product);
    console.log('[Webhook] Subscription object:', webhookData.data.subscription);
    console.log('[Webhook] Customer email:', webhookData.data.customer?.email);

    if (!webhookData.type) {
      console.error('[Webhook] ❌ No event type in webhook payload');
      return NextResponse.json({ error: 'No event type provided' }, { status: 400 });
    }

    // Handle different webhook events (using 'type' field)
    switch (webhookData.type) {
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
        console.log('[Webhook] Refund failed:', webhookData.data.payment_id);
        break;

      case 'subscription.on_hold':
        await handleSubscriptionOnHold(webhookData.data);
        break;

      case 'subscription.plan_changed':
        await handleSubscriptionPlanChanged(webhookData.data);
        break;

      case 'payment.processing':
        console.log('[Webhook] Payment processing:', webhookData.data.payment_id);
        break;

      case 'license_key.created':
        console.log('[Webhook] License key created:', webhookData.data);
        break;

      case 'dispute.opened':
      case 'dispute.challenged':
      case 'dispute.accepted':
      case 'dispute.cancelled':
      case 'dispute.expired':
      case 'dispute.won':
      case 'dispute.lost':
        console.log('[Webhook] Dispute event:', webhookData.type, webhookData.data);
        break;

      default:
        console.log('[Webhook] ⚠️ Unhandled webhook event:', webhookData.type);
    }

    console.log('[Webhook] ✓ Webhook processed successfully');
    console.log('[Webhook] ========================================');
    return NextResponse.json({ received: true, event: webhookData.type });
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
  const { subscription_id, payment_id, product_id, product, subscription, customer } = data;
  
  console.log('[Webhook] Subscription ID:', subscription_id);
  console.log('[Webhook] Payment ID:', payment_id);
  console.log('[Webhook] Product ID (direct):', product_id);
  console.log('[Webhook] Product object:', product);
  console.log('[Webhook] Subscription object:', subscription);
  console.log('[Webhook] Customer email:', customer.email);

  // Get product_id from multiple possible locations
  const actualProductId = product_id || product?.product_id || subscription?.product_id;
  
  if (!actualProductId) {
    console.error('[Webhook] ❌ No product ID found in any field');
    console.error('[Webhook] Full data:', JSON.stringify(data, null, 2));
    return;
  }

  console.log('[Webhook] Using product ID:', actualProductId);

  // Get plan type from product ID
  const planType = PRODUCT_TO_PLAN[actualProductId];
  if (!planType) {
    console.error('[Webhook] ❌ Unknown product ID:', actualProductId);
    console.error('[Webhook] Available products:', Object.keys(PRODUCT_TO_PLAN));
    return;
  }
  
  console.log('[Webhook] Plan type:', planType);

  // Find user by email since DodoPayments doesn't pass client_reference_id
  const customerEmail = customer.email;
  
  if (!customerEmail) {
    console.error('[Webhook] ❌ No customer email in webhook data');
    return;
  }

  console.log('[Webhook] Looking up user by email:', customerEmail);
  const supabaseAdmin = getSupabaseAdmin();
  
  // Get user by email
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (userError) {
    console.error('[Webhook] ❌ Error fetching users:', userError);
    return;
  }
  
  const user = userData?.users?.find(u => u.email === customerEmail);
  
  if (!user) {
    console.error('[Webhook] ❌ Could not find user with email:', customerEmail);
    // Store the payment for later reconciliation
    await supabaseAdmin.from('pending_payments').insert({
      payment_id: payment_id || subscription_id,
      product_id,
      customer_email: customerEmail,
      plan_type: planType,
      created_at: new Date().toISOString(),
    });
    console.log('[Webhook] Stored as pending payment');
    return;
  }
  
  const userId = user.id;
  console.log('[Webhook] Found user ID:', userId);

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

  console.log('[Webhook] Expiration date:', expiresAt?.toISOString() || 'Never (lifetime)');

  // Check if user already has an active subscription
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
        dodo_payment_id: payment_id || subscription_id,
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
      dodo_payment_id: payment_id || subscription_id,
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
  const { subscription_id, payment_id, customer } = data;
  const supabaseAdmin = getSupabaseAdmin();

  // Try to find subscription by dodo_payment_id
  if (subscription_id || payment_id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('dodo_payment_id', subscription_id || payment_id);

    if (error) {
      console.error('[Webhook] ❌ Error cancelling subscription:', error);
      throw error;
    }

    console.log('[Webhook] ✓ Cancelled subscription for payment:', subscription_id || payment_id);
  } else if (customer?.email) {
    // Fallback: find by email
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email === customer.email);
    
    if (user) {
      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) {
        console.error('[Webhook] ❌ Error cancelling subscription:', error);
        throw error;
      }

      console.log('[Webhook] ✓ Cancelled subscription for user:', user.id);
    }
  }
}

async function handleRefund(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing refund...');
  const { subscription_id, payment_id } = data;
  const supabaseAdmin = getSupabaseAdmin();

  // Mark subscription as refunded/cancelled
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('dodo_payment_id', subscription_id || payment_id);

  if (error) {
    console.error('[Webhook] ❌ Error processing refund:', error);
    throw error;
  }

  console.log('[Webhook] ✓ Processed refund for payment:', subscription_id || payment_id);
}

async function handleSubscriptionOnHold(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing subscription on hold...');
  const { subscription_id, payment_id } = data;
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'on_hold', updated_at: new Date().toISOString() })
    .eq('dodo_payment_id', subscription_id || payment_id);

  if (error) {
    console.error('[Webhook] ❌ Error putting subscription on hold:', error);
    throw error;
  }

  console.log('[Webhook] ✓ Put subscription on hold for payment:', subscription_id || payment_id);
}

async function handleSubscriptionPlanChanged(data: DodoWebhookPayload['data']) {
  console.log('[Webhook] Processing subscription plan change...');
  const { product_id, product, subscription, subscription_id, payment_id } = data;

  // Get product_id from multiple possible locations
  const actualProductId = product_id || product?.product_id || subscription?.product_id;
  
  if (!actualProductId) {
    console.error('[Webhook] ❌ No product ID found');
    return;
  }

  // Get new plan type from product ID
  const planType = PRODUCT_TO_PLAN[actualProductId];
  if (!planType) {
    console.error('[Webhook] ❌ Unknown product ID:', actualProductId);
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

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      plan_type: planType,
      expires_at: expiresAt?.toISOString() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('dodo_payment_id', subscription_id || payment_id);

  if (error) {
    console.error('[Webhook] ❌ Error changing subscription plan:', error);
    throw error;
  }

  console.log('[Webhook] ✓ Changed subscription plan for payment:', subscription_id || payment_id, 'to:', planType);
}

// Also handle GET for webhook verification (some providers require this)
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return NextResponse.json({ challenge });
  }
  return NextResponse.json({ status: 'Webhook endpoint active' });
}
