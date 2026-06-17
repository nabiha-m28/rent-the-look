import { useState } from 'react';
import { signIn, signUp } from '../lib/auth';

function LoginPage({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isSignUp && (!fullName.trim() || !email.trim() || !password.trim())) {
      setError('Please enter your full name, email, and password.');
      return;
    }
    if (!isSignUp && (!email.trim() || !password.trim())) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        if (onClose) onClose();
      } else {
        await signIn(email, password);
        if (onClose) onClose();
      }
    } catch (err) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('invalid login credentials') || msg.includes('invalid credential')) {
        setError('Incorrect password or no account found with that email.');
      } else if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('An account with this email already exists. Try logging in.');
      } else {
        setError(err.message);
      }
    }

  }

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-page" onClick={e => e.stopPropagation()}>
        <div className="login-close">
          {onClose && <button className="close-button" onClick={onClose}>×</button>}
        </div>
        <div className="login-header">
          <h2>{isSignUp ? 'Sign Up' : 'Log In'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          {successMsg && <p className="success">{successMsg}</p>}
          <button type="submit" onClick={handleSubmit}>{isSignUp ? 'Sign Up' : 'Log In'}</button>
        </form>
        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg(''); setFullName(''); setEmail(''); setPassword(''); }}>
          {isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;