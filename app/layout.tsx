import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';
import { VenturaProvider } from '@/lib/store';
import { ToastProvider } from '@/components/feedback/Toast';
import { AppLoadingWrapper } from '@/components/loading/AppLoadingWrapper';
import { NetworkStatusToast } from '@/components/feedback/NetworkStatusToast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'PITCH AND PROSPER by CSEA | Idea Investment Arena',
  description:
    'PITCH AND PROSPER by CSEA — an idea investment arena where participants use virtual coins to invest in anonymous innovations.',
  applicationName: 'PITCH AND PROSPER by CSEA',
  openGraph: {
    title: 'PITCH AND PROSPER by CSEA | Idea Investment Arena',
    description:
      'PITCH AND PROSPER by CSEA — an idea investment arena where participants use virtual coins to invest in anonymous innovations.',
    siteName: 'PITCH AND PROSPER by CSEA',
    images: [{ url: '/branding/tce-csea-logo.png' }],
  },
  twitter: {
    card: 'summary',
    title: 'PITCH AND PROSPER by CSEA | Idea Investment Arena',
    description:
      'PITCH AND PROSPER by CSEA — an idea investment arena where participants use virtual coins to invest in anonymous innovations.',
    images: ['/branding/tce-csea-logo.png'],
  },
  icons: {
    icon: '/branding/tce-csea-logo.png',
    shortcut: '/branding/tce-csea-logo.png',
    apple: '/branding/tce-csea-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link rel="icon" href="/branding/tce-csea-logo.png" type="image/png" />
      </head>
      <body className="min-h-screen bg-ventura-bg font-sans antialiased text-ventura-dark selection:bg-[#635BFF]/20 selection:text-[#635BFF]">
        <VenturaProvider>
          <ToastProvider>
            <AppLoadingWrapper>
              <NetworkStatusToast />
              {children}
            </AppLoadingWrapper>
          </ToastProvider>
        </VenturaProvider>
      </body>
    </html>
  );
}
