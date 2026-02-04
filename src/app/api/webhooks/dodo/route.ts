import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// DodoPayments webhook secret for verification
const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';

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
  if (!WEBHOOK_SECRET || !signature) {
    // If no secret configured, skip verification (not recommended for production)
    console.warn('Webhook signature verification skipped - no secret configured');
    return true;
  }

  // DodoPayments typically uses HMAC-SHA256 for webhook signatures
  // Implement based on their documentation
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-dodo-signature') || request.headers.get('x-webhook-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookData: DodoWebhookPayload = JSON.parse(payload);
    console.log('Received DodoPayments webhook:', webhookData.event);

    // Handle different webhook events
    switch (webhookData.event) {
      case 'payment.completed':
      case 'payment.succeeded':
      case 'subscription.created':
        await handlePaymentSuccess(webhookData.data);
        break;

      case 'payment.failed':
        await handlePaymentFailed(webhookData.data);
        break;

      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionCancelled(webhookData.data);
        break;

      case 'refund.completed':
        await handleRefund(webhookData.data);
        break;

      default:
        console.log('Unhandled webhook event:', webhookData.event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(data: DodoWebhookPayload['data']) {
  const { payment_id, product_id, client_reference_id, customer_email } = data;

  // Get plan type from product ID
  const planType = PRODUCT_TO_PLAN[product_id];
  if (!planType) {
    console.error('Unknown product ID:', product_id);
    return;
  }

  // Get user ID from client_reference_id or look up by email
  let userId = client_reference_id;

  if (!userId && customer_email) {
    // Try to find user by email
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email === customer_email);
    userId = user?.id;
  }

  if (!userId) {
    console.error('Could not determine user ID for payment:', payment_id);
    // Store the payment for later reconciliation
    await supabaseAdmin.from('pending_payments').insert({
      payment_id,
      product_id,
      customer_email,
      plan_type: planType,
      created_at: new Date().toISOString(),
    });
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
  const { data: existingSubscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (existingSubscription) {
    // Update existing subscription
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_type: planType,
        dodo_payment_id: payment_id,
        expires_at: expiresAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSubscription.id);

    console.log('Updated subscription for user:', userId);
  } else {
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
      console.error('Error creating subscription:', error);
      return;
    }

    console.log('Created subscription for user:', userId, 'Plan:', planType);
  }
}

async function handlePaymentFailed(data: DodoWebhookPayload['data']) {
  console.log('Payment failed:', data.payment_id);
  // Optionally log failed payments for analytics
}

async function handleSubscriptionCancelled(data: DodoWebhookPayload['data']) {
  const { client_reference_id, payment_id } = data;

  if (client_reference_id) {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', client_reference_id)
      .eq('status', 'active');

    console.log('Cancelled subscription for user:', client_reference_id);
  } else if (payment_id) {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('dodo_payment_id', payment_id);

    console.log('Cancelled subscription for payment:', payment_id);
  }
}

async function handleRefund(data: DodoWebhookPayload['data']) {
  const { payment_id } = data;

  // Mark subscription as refunded/cancelled
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('dodo_payment_id', payment_id);

  console.log('Processed refund for payment:', payment_id);
}

// Also handle GET for webhook verification (some providers require this)
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return NextResponse.json({ challenge });
  }
  return NextResponse.json({ status: 'Webhook endpoint active' });
}
