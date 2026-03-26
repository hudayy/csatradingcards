'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, LogIn, User, LogOut } from 'lucide-react';

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
  const [bonusToast, setBonusToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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
            <LogIn size={16} /> Login with Discord
          </a>
        )}
      </div>
    </nav>
    </>
  );
}
