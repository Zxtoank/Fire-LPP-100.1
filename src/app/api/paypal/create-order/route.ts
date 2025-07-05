import { NextResponse } from 'next/server';

// **IMPORTANT CHANGE 1: Accessing Environment Variables**
// For server-side code (like Next.js API Routes or Netlify Functions),
// it's best practice to use environment variables WITHOUT the `NEXT_PUBLIC_` prefix for secrets.
// This ensures they are NEVER exposed to the client-side.
//
// You should set these variables directly in your Netlify Environment Variables:
// - PAYPAL_CLIENT_ID (You might keep NEXT_PUBLIC_ for this if it's used elsewhere publicly, but generally for server-side auth, stick to private)
// - PAYPAL_SECRET
// - PAYPAL_MODE (e.g., 'live' or 'sandbox')

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID; // Changed from NEXT_PUBLIC_PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_SECRET; // No change, but reinforcing it should be a private var

// Use the live URL if PAYPAL_MODE is 'live', otherwise default to sandbox
const base = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    // Check if credentials are set (this error indicates a Netlify env var configuration issue)
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        const errorMessage = "PayPal API credentials (PAYPAL_CLIENT_ID or PAYPAL_SECRET) are not configured on the server. Please check your Netlify environment variables.";
        console.error("MISSING_PAYPAL_API_CREDENTIALS:", errorMessage);
        throw new Error(errorMessage);
    }

    // Log that we are attempting to authenticate, showing a masked version of the client ID.
    console.log(`Attempting PayPal auth with Client ID ending in ...${PAYPAL_CLIENT_ID.slice(-4)} for ${process.env.PAYPAL_MODE || 'sandbox'} environment.`);

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        // Log the detailed error from PayPal on the server for debugging. This is CRUCIAL.
        console.error("PayPal Access Token API Error Response:", errorBody); // More specific log message

        // Attempt to parse JSON error for specific messages
        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error === 'invalid_client') {
                console.error("PayPal authentication failed: 'invalid_client'. This is almost always due to an incorrect PAYPAL_CLIENT_ID or PAYPAL_SECRET in your environment variables.");
                throw new Error("PayPal client authentication failed. Please check server configuration and credentials on Netlify.");
            }
            // If there's a different known PayPal error, you can add more specific handling here
            // e.g., if (errorJson.error_description) { throw new Error(...) }
            throw new Error(`Failed to get access token from PayPal: ${errorJson.error_description || errorJson.error || 'Unknown PayPal error'}. Check server logs for details.`);

        } catch (e) {
            // If the errorBody is not valid JSON or doesn't have expected structure
            console.error("Failed to parse PayPal error response as JSON:", e);
            throw new Error(`Failed to get access token from PayPal. Raw error: ${errorBody}. Check server logs for details.`);
        }
    }

    const data = await response.json();
    console.log("Successfully obtained PayPal access token.");
    return data.access_token;
}

async function createPayPalOrder(amount: string, description: string, requiresShipping: boolean) {
    const accessToken = await getPayPalAccessToken(); // Get token each time, or implement caching for efficiency
    const url = `${base}/v2/checkout/orders`;

    const body: any = {
        intent: 'CAPTURE',
        purchase_units: [
            {
                amount: {
                    currency_code: 'USD',
                    value: amount,
                },
                description: description,
            },
        ],
        application_context: {
            // You might want to consider returning_method, cancel_url, etc. here for a complete integration
            shipping_preference: requiresShipping ? 'GET_FROM_FILE' : 'NO_SHIPPING',
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error("Failed to create PayPal order:", errorData);
        // Attempt to parse the error for more specific messages to return to the client
        try {
            const errorJson = JSON.parse(errorData);
            throw new Error(`Failed to create order with PayPal: ${errorJson.details?.[0]?.description || errorJson.message || 'Unknown error'}.`);
        } catch (e) {
            throw new Error(`Failed to create order with PayPal. Raw error: ${errorData}.`);
        }
    }

    const orderData = await response.json();
    console.log("Successfully created PayPal order:", orderData.id); // Log the order ID for tracing
    return orderData;
}

export async function POST(request: Request) {
    try {
        const { amount, description, requiresShipping } = await request.json();

        if (!amount || !description) {
            return NextResponse.json({ error: "Missing amount or description in request body" }, { status: 400 });
        }

        const order = await createPayPalOrder(amount, description, !!requiresShipping);
        return NextResponse.json(order);
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred during PayPal order creation.";
        // Ensure the full error message from the helper functions is returned.
        console.error("Error in POST /api/paypal/create-order:", error); // Log the full error object for debugging
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
