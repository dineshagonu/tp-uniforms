import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { STORE_NAME } from '@/lib/constants';

export const metadata = {
  title: { default: `${STORE_NAME} — School, College, Industrial & Hospital Uniforms`, template: `%s | ${STORE_NAME}` },
  description: 'Order school uniforms online by school and class. Shirts, pants, shorts, skirts, chudidhars delivered to your door. Pay online or Cash on Delivery.',
  appleWebApp: { capable: true, title: 'T&P Uniforms', statusBarStyle: 'default' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#15284a' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header />
          <main>{children}</main>
          <BottomNav />
        </CartProvider>
      </body>
    </html>
  );
}
