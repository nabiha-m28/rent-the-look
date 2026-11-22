import { useNavigate } from "react-router-dom";

export default function Footer() {
    const navigate = useNavigate();
    return (
        <footer className="site-footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <span className="footer-logo">Rent the Look</span>
                    <p>Find any look on the rental sites, in your size, in one search.</p>
                </div>

                <nav className="footer-links">
                    <span className="footer-title">Explore</span>
                    <button onClick={() => navigate("/")}>Search</button>
                    <button onClick={() => navigate("/boards")}>My Boards</button>
                </nav>

            </div>

            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} Rent the Look</span>
                <span>
                    Not affiliated with Pickle, Nuuly or Rent the Runway. Prices and availability come
                    from those sites and may change.
                </span>
            </div>
        </footer>
    );
}