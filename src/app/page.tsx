import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Sections from '@/components/landing/Sections';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header />
      <main className="flex-1">
        <Hero />
        <Sections />
      </main>
    </div>
  );
}
