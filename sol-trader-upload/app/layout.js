export const metadata = {
  title: "SOL TRADER",
  description: "Autonomous Solana Trading Bot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#060709" }}>
        {children}
      </body>
    </html>
  );
}
