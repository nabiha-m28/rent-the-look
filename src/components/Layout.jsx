import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Search, Bookmark } from "lucide-react";
import useAuth from "../hooks/useAuth";
import ProfileMenu from "./ProfileMenu";
import LoginPage from "./LoginPage";
import Footer from "./Footer";

export default function Layout() {
  const session = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="layout">
      {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}

      <div className="app-header">
        <span className="logo-link" onClick={() => navigate("/")}>Rent the Look</span>

        {session === undefined ? (
          <div className="header-nav" />
        ) : session ? (
          <div className="header-nav">
            <button className="nav-tab" onClick={() => navigate("/")} title="Search" aria-label="Search">
              <Search size={20} />
            </button>
            <button className="nav-tab" onClick={() => navigate("/boards")} title="My Boards" aria-label="My Boards">
              <Bookmark size={20} />
            </button>
            <ProfileMenu session={session} />
          </div>
        ) : (
          <button className="login-btn" onClick={() => setShowLogin(true)}>Log In</button>
        )}
      </div>

      <main className="layout-main">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}