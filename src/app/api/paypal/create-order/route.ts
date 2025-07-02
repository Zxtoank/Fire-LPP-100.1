import { NextResponse } from 'next/server';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const base = 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        console.error("MISSING_PAYPAL_API_CREDENTIALS: Make sure PAYPAL_CLIENT_SECRET and NEXT_PUBLIC_PAYPAL_CLIENT_ID are set in your environment variables.");
        throw new Error("PayPal API credentials are not configured on the server.");
    }
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
        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error === 'invalid_client') {
                console.error("PayPal authentication failed: 'invalid_client'. This is likely due to incorrect PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variables in your deployment environment (e.g., Netlify).");
                throw new Error("PayPal client authentication failed. Please check server configuration.");
            }
        } catch (e) {
            // Not a JSON error or different structure, fall through
        }
        // Log the raw error for debugging but don't expose it to the client
        console.error("Failed to get PayPal access token:", errorBody);
        throw new Error(`Failed to get access token from PayPal.`);
    }

    const data = await response.json();
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
        throw new Error(`Failed to create order with PayPal.`);
    }

    return await response.json();
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
        // The console.error calls are now inside the helper functions for more specific context.
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
