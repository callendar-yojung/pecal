import {
  CTA,
  Features,
  Footer,
  Hero,
  Navbar,
  Pricing,
  Stats,
  TrustedBy,
} from "@/components/landing";

export default function Home() {
  return (
    <div className="min-h-screen bg-page-background">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <Features />
        <Stats />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
