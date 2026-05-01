// --- ADDED START ---
// Phase 24 backend routes for Stripe Terminal, repair order signatures, and future MOTOR lookup.
// Add this file to your backend folder and mount it from your Express server with:
//   const integrationRoutes = require("./integrationRoutes");
//   app.use(integrationRoutes);
//
// Environment variables:
//   STRIPE_SECRET_KEY=sk_test_...
//   STRIPE_TERMINAL_LOCATION_ID=tml_...
//   STRIPE_TERMINAL_MOCK=true
//   MOTOR_API_BASE_URL=
//   MOTOR_API_KEY=
//   MOTOR_MOCK=true

const express = require("express");
const router = express.Router();

let stripe = null;

function getStripe() {
  if (stripe) return stripe;

  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  const Stripe = require("stripe");
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

function useMockStripe() {
  return process.env.STRIPE_TERMINAL_MOCK !== "false" || !process.env.STRIPE_SECRET_KEY;
}

function mockReader() {
  return {
    id: "tmr_mock_reader_001",
    label: "Mock Stripe Reader",
    device_type: "simulated_wisepos_e",
    status: "online",
    location: process.env.STRIPE_TERMINAL_LOCATION_ID || "tml_mock_location"
  };
}

router.get("/api/integrations/status", (req, res) => {
  res.json({
    ok: true,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeTerminalMock: useMockStripe(),
    stripeLocationId: process.env.STRIPE_TERMINAL_LOCATION_ID || "",
    motorConfigured: Boolean(process.env.MOTOR_API_KEY && process.env.MOTOR_API_BASE_URL),
    motorMock: process.env.MOTOR_MOCK !== "false",
    timestamp: new Date().toISOString()
  });
});

router.post("/api/stripe-terminal/connection-token", async (req, res) => {
  try {
    if (useMockStripe()) {
      return res.json({
        mock: true,
        secret: "mock_connection_token_secret"
      });
    }

    const stripeClient = getStripe();
    const params = {};

    if (process.env.STRIPE_TERMINAL_LOCATION_ID) {
      params.location = process.env.STRIPE_TERMINAL_LOCATION_ID;
    }

    const connectionToken = await stripeClient.terminal.connectionTokens.create(params);
    res.json(connectionToken);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/stripe-terminal/readers", async (req, res) => {
  try {
    if (useMockStripe()) {
      return res.json({
        mock: true,
        readers: [mockReader()]
      });
    }

    const stripeClient = getStripe();
    const params = { limit: 100 };

    if (process.env.STRIPE_TERMINAL_LOCATION_ID) {
      params.location = process.env.STRIPE_TERMINAL_LOCATION_ID;
    }

    const readers = await stripeClient.terminal.readers.list(params);

    res.json({
      mock: false,
      readers: readers.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/stripe-terminal/create-payment-intent", async (req, res) => {
  try {
    const {
      amount,
      currency = "usd",
      invoiceId,
      documentNumber,
      customerName,
      metadata = {}
    } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Amount is required and must be greater than zero." });
    }

    if (useMockStripe()) {
      return res.json({
        mock: true,
        paymentIntent: {
          id: `pi_mock_${Date.now()}`,
          client_secret: `pi_mock_secret_${Date.now()}`,
          amount,
          currency,
          status: "requires_payment_method",
          metadata: {
            invoice_id: invoiceId || "",
            document_number: documentNumber || "",
            customer_name: customerName || "",
            ...metadata
          }
        }
      });
    }

    const stripeClient = getStripe();

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Number(amount),
      currency,
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: {
        invoice_id: invoiceId || "",
        document_number: documentNumber || "",
        customer_name: customerName || "",
        ...metadata
      }
    });

    res.json({
      mock: false,
      paymentIntent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/stripe-terminal/process-reader-payment", async (req, res) => {
  try {
    const { readerId, paymentIntentId } = req.body || {};

    if (!readerId || !paymentIntentId) {
      return res.status(400).json({ error: "readerId and paymentIntentId are required." });
    }

    if (useMockStripe()) {
      return res.json({
        mock: true,
        status: "Sent To Reader",
        reader: {
          ...mockReader(),
          action: {
            type: "process_payment_intent",
            status: "succeeded",
            payment_intent: paymentIntentId
          }
        }
      });
    }

    const stripeClient = getStripe();

    const reader = await stripeClient.terminal.readers.processPaymentIntent(readerId, {
      payment_intent: paymentIntentId
    });

    res.json({
      mock: false,
      status: "Sent To Reader",
      reader
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/stripe-terminal/cancel-reader-action", async (req, res) => {
  try {
    const { readerId } = req.body || {};

    if (!readerId) {
      return res.status(400).json({ error: "readerId is required." });
    }

    if (useMockStripe()) {
      return res.json({
        mock: true,
        reader: {
          ...mockReader(),
          action: null
        }
      });
    }

    const stripeClient = getStripe();
    const reader = await stripeClient.terminal.readers.cancelAction(readerId);

    res.json({
      mock: false,
      reader
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/stripe-terminal/collect-repair-order-signature", async (req, res) => {
  try {
    const { readerId, label, description } = req.body || {};

    if (!readerId) {
      return res.status(400).json({ error: "readerId is required." });
    }

    if (useMockStripe()) {
      return res.json({
        mock: true,
        signature: "Mock Customer Signature",
        reader: {
          ...mockReader(),
          action: {
            type: "collect_inputs",
            status: "succeeded"
          }
        }
      });
    }

    const stripeClient = getStripe();

    const reader = await stripeClient.terminal.readers.collectInputs(readerId, {
      inputs: [
        {
          type: "signature",
          custom_text: {
            title: label || "Repair Order Authorization",
            description: description || "Please sign to authorize this repair order."
          }
        }
      ]
    });

    res.json({
      mock: false,
      reader
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/motor/repair-info/search", async (req, res) => {
  try {
    const payload = req.body || {};
    const useMockMotor = process.env.MOTOR_MOCK !== "false" || !process.env.MOTOR_API_KEY || !process.env.MOTOR_API_BASE_URL;

    if (useMockMotor) {
      return res.json({
        mock: true,
        request: payload,
        results: [
          {
            type: "labor_operation",
            title: "Sample labor operation placeholder",
            labor_hours: 1.2,
            notes: "Replace this mock response with MOTOR provider response after credentials/API contract are available."
          },
          {
            type: "repair_information",
            title: "Sample repair procedure placeholder",
            notes: "Future MOTOR integration endpoint is wired here."
          }
        ]
      });
    }

    // MOTOR providers/accounts vary by contract. Keep this as a safe adapter point.
    // Replace the endpoint path and authorization style to match your MOTOR agreement.
    const response = await fetch(`${process.env.MOTOR_API_BASE_URL}/repair-info/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOTOR_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || data.message || "MOTOR lookup failed",
        details: data
      });
    }

    res.json({
      mock: false,
      results: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADDED START ---
// Phase 25: Stripe webhooks, refunds, Twilio-ready SMS, and invoice finalization helpers.

router.post("/api/stripe-terminal/refund-payment", async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = "requested_by_customer" } = req.body || {};

    if (!paymentIntentId) {
      return res.status(400).json({ error: "paymentIntentId is required." });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "amount is required and must be greater than zero." });
    }

    if (useMockStripe()) {
      return res.json({
        mock: true,
        refund: {
          id: `re_mock_${Date.now()}`,
          payment_intent: paymentIntentId,
          amount: Number(amount),
          reason,
          status: "succeeded"
        }
      });
    }

    const stripeClient = getStripe();

    const refund = await stripeClient.refunds.create({
      payment_intent: paymentIntentId,
      amount: Number(amount),
      reason
    });

    res.json({
      mock: false,
      refund
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/stripe-terminal/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const stripeClient = getStripe();

    if (!stripeClient || useMockStripe()) {
      return res.json({
        received: true,
        mock: true,
        note: "Webhook received in mock mode. Configure STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY for live verification."
      });
    }

    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(400).json({ error: "STRIPE_WEBHOOK_SECRET is not configured." });
    }

    const event = stripeClient.webhooks.constructEvent(req.body, signature, webhookSecret);

    // Your Supabase service-role webhook posting can be added here if you want
    // the backend to update invoice_payments automatically.
    // Recommended events:
    // - payment_intent.succeeded
    // - payment_intent.payment_failed
    // - charge.refunded

    res.json({
      received: true,
      type: event.type,
      id: event.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/api/sms/send", async (req, res) => {
  try {
    const { to, body } = req.body || {};

    if (!to || !body) {
      return res.status(400).json({ error: "to and body are required." });
    }

    const useMockSms = process.env.TWILIO_MOCK !== "false" || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER;

    if (useMockSms) {
      return res.json({
        mock: true,
        message: {
          sid: `SM_mock_${Date.now()}`,
          to,
          from: process.env.TWILIO_FROM_NUMBER || "+15555550100",
          body,
          status: "sent"
        }
      });
    }

    const twilio = require("twilio");
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const message = await client.messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER,
      body
    });

    res.json({
      mock: false,
      message
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// --- ADDED END ---
