
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "./spinner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const signUpSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters."}),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

const logInSchema = z.object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z.string().min(1, { message: "Password is required." }),
});


export function AuthForm({ isSignUp }: { isSignUp: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(isSignUp ? signUpSchema : logInSchema),
    defaultValues: isSignUp ? { name: "", email: "", password: ""} : { email: "", password: "" },
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        await updateProfile(userCredential.user, { displayName: data.name });
      } else {
        await signInWithEmailAndPassword(auth, data.email, data.password);
      }
      router.push("/");
      toast({ title: "Success!", description: isSignUp ? "Your account has been created." : "You are now logged in." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Authentication Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/");
      toast({ title: "Success!", description: "You are now logged in with Google." });
    } catch (error: any) {
      let description = error.message;
      switch (error.code) {
        case 'auth/operation-not-allowed':
          description = "Google Sign-In is not enabled for this app. Please enable it in your Firebase console's Authentication section.";
          break;
        case 'auth/unauthorized-domain':
          description = "This website's domain is not authorized for Google Sign-In. Please add it to the authorized domains in your Firebase and Google Cloud consoles.";
          break;
        case 'auth/popup-blocked-by-browser':
           description = "The sign-in pop-up was blocked by your browser. Please allow pop-ups for this site and try again.";
           break;
        case 'auth/popup-closed-by-user':
           description = "The sign-in window was closed before completing. Please try again.";
           break;
        default:
           description = "An unexpected error occurred during Google Sign-In. Please check your configuration.";
           break;
      }
      toast({ variant: "destructive", title: "Google Sign-In Error", description });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isSignUp && (
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Your Name" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}
            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input type="email" placeholder="your@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading && <Spinner className="mr-2 h-4 w-4" />}
            {isSignUp ? "Sign Up" : "Log In"}
          </Button>
        </form>
      </Form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading}>
        {isGoogleLoading ? (
            <Spinner className="mr-2 h-4 w-4" />
        ) : (
            <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.3 1.84-4.32 1.84-5.24 0-9.48-4.24-9.48-9.48s4.24-9.48 9.48-9.48c2.84 0 4.96 1.12 6.56 2.64l-2.32 2.32c-.8-.76-1.84-1.32-3.24-1.32-3.16 0-5.72 2.56-5.72 5.72s2.56 5.72 5.72 5.72c2.2 0 3.32-1.04 3.48-2.32H12.48z"></path></svg>
        )}
        Google
      </Button>
    </div>
  );
}
