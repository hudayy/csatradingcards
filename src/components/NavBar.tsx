'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, LogIn, User, LogOut, Menu, X } from 'lucide-react';

interface UserInfo {
  id: number;
  discord_username: string;
  avatar_url: string | null;
  csa_name: string | null;
  coins: number;
  is_admin: boolean;
}

export default function NavBar() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [bonusToast, setBonusToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          fetch('/api/auth/daily-bonus', { method: 'POST' })
            .then(r => r.json())
            .then(bonus => {
              if (bonus.claimed) {
                setUser(u => u ? { ...u, coins: bonus.newBalance } : u);
                setBonusToast(`+${bonus.amount} daily bonus!`);
                setTimeout(() => setBonusToast(null), 4000);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const balance = (e as CustomEvent<{ balance: number }>).detail?.balance;
      if (balance !== undefined) setUser(u => u ? { ...u, coins: balance } : u);
    }
    window.addEventListener('coinsUpdated', handler);
    return () => window.removeEventListener('coinsUpdated', handler);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    setMobileNavOpen(false);
    await fetch('/api/auth/me', { method: 'DELETE' });
    setUser(null);
    window.location.href = '/';
  };

  const links = [
    { href: '/', label: 'Home' },
    { href: '/packs', label: 'Open Packs' },
    { href: '/shop', label: 'Shop' },
    { href: '/collection', label: 'Collection' },
    { href: '/collection/binders', label: 'Binders' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/trades', label: 'Trades' },
    { href: '/leaderboard', label: 'Leaderboard' },
    ...(user?.is_admin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <>
    {bonusToast && (
      <div className="daily-bonus-toast">
        <Coins size={16} /> {bonusToast}
      </div>
    )}
    <nav className="nav">
      <Link href="/" className="nav-logo">
        <img src="/csacardslogo.png" alt="CSA Cards" className="logo-img" />
        CSA Cards
      </Link>

      <ul className="nav-links">
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={pathname === link.href ? 'active' : ''}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="nav-user">
        {user ? (
          <>
            <div className="nav-coins">
              <Coins size={16} />
              <span>{user.coins.toLocaleString()}</span>
            </div>
            <div className="nav-avatar-wrapper" ref={menuRef}>
              <img
                src={user.avatar_url || '/default-avatar.png'}
                alt={user.discord_username}
                className="nav-avatar"
                onClick={() => setMenuOpen(o => !o)}
              />
              {menuOpen && (
                <div className="nav-dropdown">
                  <Link
                    href="/profile"
                    className="nav-dropdown-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User size={14} /> My Profile
                  </Link>
                  <button className="nav-dropdown-item nav-dropdown-logout" onClick={handleLogout}>
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <a href="/api/auth/discord" className="login-btn">
            <LogIn size={16} /> <span className="login-btn-text">Login with Discord</span>
          </a>
        )}
        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileNavOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>

    {mobileNavOpen && (
      <div className="mobile-nav-drawer">
        <ul className="mobile-nav-links">
          {links.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={pathname === link.href ? 'active' : ''}
                onClick={() => setMobileNavOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mobile-nav-footer">
          {user ? (
            <>
              <div className="mobile-nav-coins">
                <Coins size={14} /> {user.coins.toLocaleString()} coins
              </div>
              <button className="mobile-nav-logout" onClick={handleLogout}>
                <LogOut size={14} /> Log out
              </button>
            </>
          ) : (
            <a href="/api/auth/discord" className="mobile-nav-login">
              <LogIn size={14} /> Login with Discord
            </a>
          )}
        </div>
      </div>
    )}
    </>
  );
}
