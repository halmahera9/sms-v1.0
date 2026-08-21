import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Sections from '@/components/landing/Sections';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070c18] text-slate-100 selection:bg-sky-500 selection:text-white">
      <Header />
      <main>
        <Hero />
        <Sections />
      </main>
    </div>
  );
}
