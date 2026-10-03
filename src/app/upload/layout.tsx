import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unggah Dokumen - BANYUBIRU',
  description: 'Portal Pengunggahan Dokumen Internal BANYUBIRU',
};

export default function UploadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
