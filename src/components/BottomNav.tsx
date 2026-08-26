import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Aujourd’hui', icon: '☀' },
  { to: '/matieres', label: 'Matières', icon: '\u{1F4DA}' },
  { to: '/echeances', label: 'Échéances', icon: '\u{1F4C5}' },
  { to: '/importer', label: 'Importer', icon: '\u{1F4E5}' },
  { to: '/reglages', label: 'Réglages', icon: '⚙' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) => 'bottom-nav__link' + (isActive ? ' bottom-nav__link--active' : '')}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {link.icon}
          </span>
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
