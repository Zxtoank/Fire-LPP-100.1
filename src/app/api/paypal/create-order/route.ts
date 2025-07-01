import { NextResponse } from 'next/server';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const base = 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error("MISSING_PAYPAL_API_CREDENTIALS");
    }
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: {
            Authorization: `Basic ${auth}`,
        },
    });
    
    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to get access token: ${errorData}`);
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
        throw new Error(`Failed to create order: ${errorData}`);
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
        console.error("Failed to create PayPal order:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
