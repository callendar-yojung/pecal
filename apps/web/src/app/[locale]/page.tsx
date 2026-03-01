import { Footer, HomeActions, Navbar } from "@/components/landing";

export default function Home() {
  return (
    <div className="min-h-screen bg-page-background">
      <Navbar />
      <main>
        <HomeActions />
      </main>
      <Footer />
    </div>
  );
}
