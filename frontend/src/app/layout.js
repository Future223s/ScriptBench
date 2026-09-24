import { Inter } from "next/font/google";
import "./styles/app.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Economic Upheaval",
  description: "Workflow and transcription dashboard for ScriptBench samples.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
