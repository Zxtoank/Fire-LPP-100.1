"use client";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
        console.error("Error signing out: ", error);
    }
  };

  return (
    <header className="p-2 sm:p-4 border-b shrink-0 flex justify-between items-center bg-card">
      <Link href="/" className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-primary cursor-pointer truncate">
          Locket Photo Print
        </h1>
      </Link>
      <div className="flex items-center gap-2 flex-shrink-0">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />}
                  <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/login')} className="px-3 sm:px-4">Log In</Button>
            <Button onClick={() => router.push('/signup')} className="px-3 sm:px-4">Sign Up</Button>
          </div>
        )}
      </div>
    </header>
  );
}
