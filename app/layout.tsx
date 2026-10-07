import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import TooltipLayer from "@/components/TooltipLayer";

export const metadata: Metadata = {
  title: "UNICEF Deck Builder",
  description:
    "Generate branded UNICEF / Digital Impact Division slide decks from a prompt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // before React hydrates, and that difference is the point.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        {/* Hotjar (site 6786608, "deckgen"): production only, so local runs stay out of the data. */}
        {process.env.NODE_ENV === "production" && (
          <Script id="hotjar" strategy="afterInteractive">
            {`(function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:6786608,hjsv:6};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
          </Script>
        )}
        <TooltipLayer />
      </body>
    </html>
  );
}
