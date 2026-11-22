import { Link2, Search, SlidersHorizontal, Bookmark } from "lucide-react";

const STEPS = [
  {
    icon: Link2,
    title: "Paste a link",
    text: "Found a dress you love? Paste the product link from any retailer.",
  },
  {
    icon: Search,
    title: "We search for you",
    text: "We look for the exact piece, or the closest match, across Pickle, Nuuly and Rent the Runway.",
  },
  {
    icon: SlidersHorizontal,
    title: "Filter to fit",
    text: "Narrow by your size, budget and platform so you only see what works.",
  },
  {
    icon: Bookmark,
    title: "Save and rent",
    text: "Save favorites to boards, then head to the platform to rent.",
  },
];

export default function HowItWorks() {
  return (
    <section className="how">
      <span className="how-eyebrow">How it works</span>

      <div className="how-grid">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="how-step">
            <div className="how-icon">
              <Icon size={22} strokeWidth={1.6} />
            </div>
            <span className="how-num">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="how-platforms">
        <span>Searching across</span>
        <strong>Pickle</strong>
        <strong>Nuuly</strong>
        <strong>Rent the Runway</strong>
      </div>
    </section>
  );
}