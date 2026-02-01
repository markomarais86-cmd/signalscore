export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 py-8">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <img 
          src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69497386bcff6817bd62fe29_light-01.svg" 
          alt="LaunchPulse" 
          className="h-6"
        />
        <p className="text-sm text-white/50">
          © {currentYear} LaunchPulse. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
