"use client";
import { AuthForm } from "@/components/auth-form";
import Link from 'next/link';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!firebaseApiKey || firebaseApiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8 flex items-center justify-center">
            <Card className="w-full max-w-lg shadow-lg">
                <CardHeader>
                    <CardTitle>Firebase Configuration Error</CardTitle>
                    <CardDescription>
                        Authentication is currently disabled.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
                      <p className="font-semibold mb-2">Action Required</p>
                      <p>Firebase credentials are missing or incomplete. Please add your Firebase project's credentials to the <code>.env</code> file to enable user login and signup.</p>
                      <p className="mt-2 text-sm">You can find these keys in your Firebase project settings.</p>
                    </div>
                </CardContent>
            </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
        <Header/>
        <main className="flex-grow flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg border">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-center text-primary">Create an Account</h1>
                    <p className="text-center text-gray-600 mt-2">
                        Join Locket Photo Print to save and order your photos.
                    </p>
                </div>
                <AuthForm isSignUp={true} />
                <p className="text-sm text-center text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                    Log In
                </Link>
                </p>
            </div>
        </main>
    </div>
  );
}
