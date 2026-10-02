'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f2b5c] text-white shadow-sm shadow-[#0f2b5c]/20">
            <span className="text-base font-black tracking-wider">BY</span>
          </div>
          <div>
            <span className="font-bold text-lg text-[#0f2b5c] tracking-tight group-hover:text-blue-700 transition-colors">
              Banyubiru
            </span>
            <p className="text-[11px] text-slate-500 font-medium leading-none">
              School Document Intelligence
            </p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-7">
          <a
            href="#document-intelligence"
            className="text-sm font-medium text-slate-600 hover:text-[#0f2b5c] transition-colors"
          >
            Apa itu Document Intelligence?
          </a>
          <a
            href="#cara-kerja"
            className="text-sm font-medium text-slate-600 hover:text-[#0f2b5c] transition-colors"
          >
            Cara Kerja
          </a>
          <a href="/" className="border border-transparent px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white rounded">
            Fitur
          </a>
          <a
            href="#dokumen"
            className="text-sm font-medium text-slate-600 hover:text-[#0f2b5c] transition-colors"
          >
            Dokumen
          </a>
          <a
            href="#perbandingan"
            className="text-sm font-medium text-slate-600 hover:text-[#0f2b5c] transition-colors"
          >
            Manual vs Banyubiru
          </a>
        </nav>

        {/* Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f2b5c] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
          >
            <span>Masuk ke Banyubiru</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-slate-600 hover:text-[#0f2b5c]"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          <a
            href="#document-intelligence"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Apa itu Document Intelligence?
          </a>
          <a
            href="#cara-kerja"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Cara Kerja
          </a>
          <a
            href="#contoh-kasus"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Contoh Kasus
          </a>
          <a
            href="#dokumen"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Dokumen
          </a>
          <a
            href="#perbandingan"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-slate-700 py-1.5"
          >
            Manual vs Banyubiru
          </a>
          <div className="pt-2 border-t border-slate-100">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#0f2b5c] px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
            >
              <span>Masuk ke Banyubiru</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
