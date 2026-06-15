/** Root layout — pass-through; the real <html> lives in [locale]/layout.tsx. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
