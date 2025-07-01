import { Header } from '@/components/header';
import ImageEditor from '@/components/image-editor';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-8">
        <ImageEditor />
      </main>
    </div>
  );
}
