import { useState, useRef, useEffect } from "react";
import { signOut } from "../lib/auth";
import { useNavigate } from "react-router-dom";

function ProfileMenu({ session }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu');
  const timeoutRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const fullName = session?.user?.user_metadata?.full_name;
  const initials = fullName
    ? fullName[0].toUpperCase()
    : session?.user?.email?.[0].toUpperCase();

  const memberSince = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  function handleEnter() {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
      setView('menu');
    }, 150);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setView('menu');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="profile-menu" ref={menuRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div className="profile-icon" onClick={() => setOpen(true)}>
        {initials}
      </div>
      {open && (
        <div className="profile-dropdown">
          {view === 'menu' ? (
            <>
              <button onClick={() => { navigate('/'); setOpen(false); }}>Home</button>
              <button onClick={() => { navigate("/boards"); setOpen(false); }}>My Boards</button>
              <button onClick={() => setView('account')}>My Account</button>
              <button onClick={signOut}>Log Out</button>
            </>
          ) : (
            <>
              <button className="back-btn" onClick={() => setView('menu')}>← Back</button>
              <div className="account-row"><span>{fullName || '—'}</span></div>
              <div className="account-row"><span>{session.user.email}</span></div>
              {memberSince && (
                <div className="account-row"><span>Member since {memberSince}</span></div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileMenu;