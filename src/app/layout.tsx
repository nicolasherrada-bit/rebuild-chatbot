export const metadata = { title: "REBUILD" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body style={{ fontFamily: "system-ui, sans-serif", background: "#0b1220", color: "#e8eef6", margin: 0 }}>{children}</body></html>);
}
