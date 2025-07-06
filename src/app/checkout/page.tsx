"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { PayPalButtons } from "@paypal/react-paypal-js";
import type { OnApproveData, OnApproveActions, OrderResponseBody } from "@paypal/paypal-js";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const PHYSICAL_PRINT_PRICE = "7.99";

const shippingAddressSchema = z.object({
  name: z.string().min(2, { message: "A full name is required." }),
  address1: z.string().min(5, { message: "A street address is required." }),
  address2: z.string().optional(),
  city: z.string().min(2, { message: "A city is required." }),
  state: z.string().min(2, { message: "A state or province is required." }),
  zip: z.string().min(3, { message: "A postal or ZIP code is required." }),
  country: z.string().min(2, { message: "A country name is required." }),
});
type ShippingAddress = z.infer<typeof shippingAddressSchema>;


export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const form = useForm<ShippingAddress>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: {
      name: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
    },
  });

  const handleShippingSubmit = (values: ShippingAddress) => {
    setShippingAddress(values);
  };

  useEffect(() => {
    const dataUrl = localStorage.getItem("printPreviewDataUrl");
    if (dataUrl) {
      setPrintPreviewUrl(dataUrl);
    } else {
        toast({variant: "destructive", title: "No print preview found", description: "Please generate a print preview first."});
        router.push("/");
    }
  }, [router, toast]);
  
  useEffect(() => {
    if (!loading && !user) {
      toast({ title: "Please log in", description: "You must be logged in to check out."});
      router.push("/login");
    }
  }, [user, loading, router, toast]);
  
  const createOrder = useCallback(async () => {
     try {
        const response = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: PHYSICAL_PRINT_PRICE,
                description: 'Locket Photo Print Physical Print (4x6)',
                requiresShipping: true
            })
        });
        const order = await response.json();
        if (response.ok) {
            return order.id;
        }
        const errorData = order.error || 'Failed to create PayPal order.';
        toast({ variant: "destructive", title: "Error", description: errorData });
        throw new Error(errorData);
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        if (!(error instanceof Error && error.message.includes('PayPal'))) {
           toast({ variant: "destructive", title: "Error", description: message });
        }
        throw error;
    }
  }, [toast]);

  const onApprove = useCallback(async (data: OnApproveData, actions: OnApproveActions) => {
    if (!actions.order || !user) {
      toast({ variant: "destructive", title: "Order Error", description: "An issue occurred. Please try again." });
      throw new Error("PayPal actions not available or user not logged in");
    }
    
    if (!shippingAddress) {
      toast({ variant: "destructive", title: "Shipping Address Missing", description: "Please complete the shipping address form." });
      throw new Error("Shipping address is missing.");
    }

    setIsSubmitting(true);
    toast({ title: "Processing Payment...", description: "Please wait." });
    
    try {
        const details: OrderResponseBody = await actions.order.capture();
        
        if (!details.purchase_units || details.purchase_units.length === 0) {
          throw new Error("Could not retrieve purchase details from PayPal.");
        }
        
        const purchaseUnit = details.purchase_units[0];

        await addDoc(collection(db, "users", user.uid, "orders"), {
            paypalOrderId: details.id,
            orderedAt: serverTimestamp(),
            status: "processing",
            total: parseFloat(PHYSICAL_PRINT_PRICE),
            items: [{
                description: "Locket Photo Print Physical Print (4x6)",
                amount: {
                    currency_code: purchaseUnit.amount.currency_code,
                    value: purchaseUnit.amount.value,
                },
            }],
            shippingAddress: {
                name: shippingAddress.name,
                address_line_1: shippingAddress.address1,
                address_line_2: shippingAddress.address2 || "",
                admin_area_2: shippingAddress.city,
                admin_area_1: shippingAddress.state,
                postal_code: shippingAddress.zip,
                country: shippingAddress.country,
            },
        });

        localStorage.removeItem("printPreviewDataUrl");
        toast({ title: "Order Placed!", description: "Your order has been successfully placed. You will be redirected to your profile." });
        router.push("/profile");
    } catch (error) {
        console.error("Order processing error:", error);
        const message = error instanceof Error ? error.message : "There was an issue placing your order. Please contact support.";
        toast({ variant: "destructive", title: "Order Error", description: message });
    } finally {
        setIsSubmitting(false);
    }
  }, [user, router, toast, shippingAddress]);

  const onCancel = useCallback(() => {
    toast({
      variant: "default",
      title: "Payment Cancelled",
      description: "You have cancelled the payment process.",
    });
  }, [toast]);

  const onError = useCallback((err: any) => {
    console.error("PayPal Error:", err);
    toast({ variant: "destructive", title: "PayPal Error", description: "A PayPal script error occurred. This is often due to an incorrect Client ID. Please double-check your credentials." });
  }, [toast]);


  if (loading || !user || !printPreviewUrl) {
    return <div className="flex items-center justify-center h-screen"><Spinner className="w-12 h-12" /></div>;
  }
  
  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8 flex items-center justify-center">
            <Card>
                <CardHeader>
                    <CardTitle>Configuration Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-red-500">PayPal Client ID is not configured. Please set the NEXT_PUBLIC_PAYPAL_CLIENT_ID environment variable.</p>
                </CardContent>
            </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8">
        <h1 className="text-4xl font-bold text-primary text-center mb-8">Checkout</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border rounded-md p-2 bg-gray-100">
                            {printPreviewUrl && <Image src={printPreviewUrl} alt="Print Preview" width={400} height={600} className="w-full h-auto rounded-md" />}
                        </div>
                         <div className="flex justify-between items-center text-lg">
                            <p>4"x6" Physical Print</p>
                            <p className="font-semibold">${PHYSICAL_PRINT_PRICE}</p>
                        </div>
                        <div className="flex justify-between items-center text-xl font-bold pt-4 border-t">
                            <p>Total</p>
                            <p>${PHYSICAL_PRINT_PRICE}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <div>
                <Card className="shadow-lg">
                    {shippingAddress ? (
                        <>
                            <CardHeader>
                                <CardTitle>Payment & Shipping</CardTitle>
                                <CardDescription>Please confirm your details and complete your purchase.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6 p-4 border rounded-md bg-gray-50">
                                    <h4 className="font-semibold mb-2">Shipping To:</h4>
                                    <div className="text-sm text-gray-700 leading-relaxed">
                                        <p className="font-medium">{shippingAddress.name}</p>
                                        <p>{shippingAddress.address1}</p>
                                        {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
                                        <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}</p>
                                        <p>{shippingAddress.country}</p>
                                    </div>
                                    <Button variant="link" className="p-0 h-auto mt-2 text-sm" onClick={() => setShippingAddress(null)}>
                                        Edit Address
                                    </Button>
                                </div>

                                <PayPalButtons
                                    style={{ layout: "vertical", label: 'pay' }}
                                    createOrder={createOrder}
                                    onApprove={onApprove}
                                    onCancel={onCancel}
                                    onError={onError}
                                    disabled={isSubmitting}
                                />
                                {isSubmitting && <div className="flex items-center justify-center mt-4"><Spinner /><p className="ml-2">Finalizing your order...</p></div>}
                            </CardContent>
                        </>
                    ) : (
                        <>
                            <CardHeader>
                                <CardTitle>Shipping Address</CardTitle>
                                <CardDescription>Please enter your shipping information to proceed.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleShippingSubmit)} className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Full Name</FormLabel>
                                                    <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="address1"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Address Line 1</FormLabel>
                                                    <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="address2"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Address Line 2 <span className="text-gray-500">(Optional)</span></FormLabel>
                                                    <FormControl><Input placeholder="Apt, suite, etc." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="city" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>City</FormLabel>
                                                    <FormControl><Input placeholder="Anytown" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                            <FormField control={form.control} name="state" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>State / Province</FormLabel>
                                                    <FormControl><Input placeholder="CA" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="zip" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>ZIP / Postal Code</FormLabel>
                                                    <FormControl><Input placeholder="12345" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                            <FormField control={form.control} name="country" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Country</FormLabel>
                                                    <FormControl><Input placeholder="United States" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        </div>
                                        <Button type="submit" className="w-full">Continue to Payment</Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>
        </div>
      </main>
    </div>
  );
}
