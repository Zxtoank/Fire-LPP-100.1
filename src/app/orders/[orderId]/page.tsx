"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Package, Home, CheckCircle, Truck, Circle } from 'lucide-react';

interface Order {
  id: string;
  orderedAt: any;
  total: number;
  status: 'processing' | 'shipped' | 'delivered';
  items: { description: string; amount: { value: string } }[];
  shippingAddress: {
    name: string;
    address_line_1: string;
    address_line_2?: string;
    admin_area_2: string;
    admin_area_1: string;
    postal_code: string;
    country: string;
  };
}

const statusSteps = [
    { id: 'processing', label: 'Processing', icon: Circle },
    { id: 'shipped', label: 'Shipped', icon: Truck },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && orderId) {
      const fetchOrder = async () => {
        try {
          const orderRef = doc(db, 'users', user.uid, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            setOrder({ id: orderSnap.id, ...orderSnap.data() } as Order);
          } else {
            setError('Order not found.');
          }
        } catch (err) {
          setError('Failed to fetch order details.');
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchOrder();
    }
  }, [user, orderId]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }
  
  if (error) {
     return (
       <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8 flex items-center justify-center">
            <p className="text-red-500">{error}</p>
        </main>
       </div>
    );
  }

  if (!order) {
    return (
       <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8 flex items-center justify-center">
            <p className="text-gray-500">Order not found.</p>
        </main>
       </div>
    )
  }

  const currentStatusIndex = statusSteps.findIndex(step => step.id === order.status);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8">
        <Button variant="link" onClick={() => router.push('/profile')} className="mb-4 pl-0">
            &larr; Back to Profile
        </Button>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              Order #{order.id.substring(0, 8).toUpperCase()} &bull; Placed on {order.orderedAt ? format(order.orderedAt.toDate(), "PPP") : 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <h3 className="font-semibold mb-6 text-lg">Order Status</h3>
              <div className="relative flex items-center justify-between w-full max-w-2xl mx-auto">
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-gray-200"></div>
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary" style={{width: `${(currentStatusIndex / (statusSteps.length - 1)) * 100}%`}}></div>
                {statusSteps.map((step, index) => {
                  const isActive = index <= currentStatusIndex;
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="z-10 flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${isActive ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-500'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className={`mt-2 text-sm font-medium text-center ${isActive ? 'text-primary' : 'text-gray-500'}`}>{step.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Package />Items Summary</h3>
                    <div className="p-4 border rounded-md bg-gray-50">
                        {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between">
                                <p>{item.description}</p>
                                <p>${Number(item.amount.value).toFixed(2)}</p>
                            </div>
                        ))}
                         <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                            <p>Total</p>
                            <p>${order.total.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                     <h3 className="font-semibold text-lg flex items-center gap-2"><Home />Shipping Address</h3>
                     <div className="p-4 border rounded-md bg-gray-50 leading-relaxed">
                        <p className="font-medium">{order.shippingAddress.name}</p>
                        <p>{order.shippingAddress.address_line_1}</p>
                        {order.shippingAddress.address_line_2 && <p>{order.shippingAddress.address_line_2}</p>}
                        <p>{order.shippingAddress.admin_area_2}, {order.shippingAddress.admin_area_1} {order.shippingAddress.postal_code}</p>
                        <p>{order.shippingAddress.country}</p>
                     </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
