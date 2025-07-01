"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import Link from "next/link";
import { format } from "date-fns";
import { Download, Package } from "lucide-react";

interface DownloadRecord {
  id: string;
  downloadedAt: any; // Firestore timestamp
  type: string;
}

interface OrderRecord {
  id: string;
  orderedAt: any; // Firestore timestamp
  total: number;
  status: string;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setIsDataLoading(true);
        try {
            // Fetch downloads
            const downloadsQuery = query(collection(db, "users", user.uid, "downloads"), orderBy("downloadedAt", "desc"));
            const downloadsSnapshot = await getDocs(downloadsQuery);
            setDownloads(downloadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DownloadRecord)));

            // Fetch orders
            const ordersQuery = query(collection(db, "users", user.uid, "orders"), orderBy("orderedAt", "desc"));
            const ordersSnapshot = await getDocs(ordersQuery);
            setOrders(ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderRecord)));
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setIsDataLoading(false);
        }
      };
      fetchData();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800">My Profile</h1>
            <p className="text-lg text-gray-600 mt-2">{user.displayName || user.email}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download /> My Downloads</CardTitle>
                <CardDescription>Your purchased high-resolution files.</CardDescription>
              </CardHeader>
              <CardContent>
                {isDataLoading ? <div className="flex justify-center p-8"><Spinner /></div> : downloads.length > 0 ? (
                  <ul className="space-y-4">
                    {downloads.map(d => (
                      <li key={d.id} className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border">
                        <div>
                          <p className="font-semibold">1200DPI {d.type.toUpperCase()}</p>
                          <p className="text-sm text-gray-500">
                            Purchased on {d.downloadedAt ? format(d.downloadedAt.toDate(), "PPP") : 'N/A'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" disabled>Re-download</Button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-500 text-center py-4">You haven&apos;t purchased any downloads yet.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package /> Order History</CardTitle>
                <CardDescription>Your physical print orders.</CardDescription>
              </CardHeader>
              <CardContent>
                 {isDataLoading ? <div className="flex justify-center p-8"><Spinner /></div> : orders.length > 0 ? (
                  <ul className="space-y-4">
                    {orders.map(o => (
                      <li key={o.id} className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border">
                        <div>
                          <p className="font-semibold">Order #{o.id.substring(0, 6).toUpperCase()}</p>
                          <p className="text-sm text-gray-500">
                             Placed on {o.orderedAt ? format(o.orderedAt.toDate(), "PPP") : 'N/A'} - <span className="font-medium capitalize">{o.status}</span>
                          </p>
                        </div>
                        <Link href={`/orders/${o.id}`} passHref>
                          <Button variant="outline" size="sm">View Details</Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-500 text-center py-4">You haven&apos;t placed any orders yet.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
