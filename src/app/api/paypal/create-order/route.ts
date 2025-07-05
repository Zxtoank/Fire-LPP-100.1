
import { NextResponse } from 'next/server';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Use the live URL if PAYPAL_MODE is 'live', otherwise default to sandbox
const base = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        const errorMessage = "PayPal API credentials (PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET) are not configured on the server. Please check your Netlify environment variables.";
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
        console.error("PayPal Access Token API Error Response:", errorBody);
        
        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error === 'invalid_client') {
                 console.error("PayPal authentication failed: 'invalid_client'. This is almost always due to an incorrect PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in your environment variables.");
                 throw new Error("PayPal client authentication failed. Please check server configuration and credentials on Netlify.");
            }
             throw new Error(`Failed to get access token from PayPal: ${errorJson.error_description || errorJson.error || 'Unknown PayPal error'}. Check server logs for details.`);

        } catch (e) {
            console.error("Failed to parse PayPal error response as JSON:", e);
            throw new Error(`Failed to get access token from PayPal. Raw error: ${errorBody}. Check server logs for details.`);
        }
    }

    const data = await response.json();
    console.log("Successfully obtained PayPal access token.");
    return data.access_token;
}

async function createPayPalOrder(amount: string, description: string, requiresShipping: boolean) {
    const accessToken = await getPayPalAccessToken();
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
         try {
            const errorJson = JSON.parse(errorData);
            throw new Error(`Failed to create order with PayPal: ${errorJson.details?.[0]?.description || errorJson.message || 'Unknown error'}.`);
        } catch (e) {
            throw new Error(`Failed to create order with PayPal. Raw error: ${errorData}.`);
        }
    }

    const orderData = await response.json();
    console.log("Successfully created PayPal order:", orderData.id);
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
        console.error("Error in POST /api/paypal/create-order:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
