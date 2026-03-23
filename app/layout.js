import './globals.css'

export const metadata = {
  title: 'Canaan Finance — Your Tax Dollars, Digitized',
  description: 'Public budget transparency tool for Canaan, NH. Salaries, departments, and budget history — all public record under NH RSA 91-A.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
