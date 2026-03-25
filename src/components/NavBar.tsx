'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, LogIn } from 'lucide-react';

interface UserInfo {
  id: number;
  discord_username: string;
  avatar_url: string | null;
  csa_name: string | null;
  coins: number;
}

export default function NavBar() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' });
    setUser(null);
    window.location.href = '/';
  };

  const links = [
    { href: '/', label: 'Home' },
    { href: '/packs', label: 'Open Packs' },
    { href: '/collection', label: 'Collection' },
    { href: '/marketplace', label: 'Marketplace' },
  ];

  return (
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
            <img
              src={user.avatar_url || '/default-avatar.png'}
              alt={user.discord_username}
              className="nav-avatar"
              onClick={handleLogout}
              title="Click to logout"
            />
          </>
        ) : (
          <a href="/api/auth/discord" className="login-btn">
            <LogIn size={16} /> Login with Discord
          </a>
        )}
      </div>
    </nav>
  );
}
