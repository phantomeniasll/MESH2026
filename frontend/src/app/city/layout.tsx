export const metadata = {
  title: "Karlsruhe · City Operations | BeTree",
  description: "Real-time urban sensor intelligence for city departments.",
};

export default function CityLayout({ children }: { children: React.ReactNode }) {
  return <div className="city-console min-h-screen">{children}</div>;
}
